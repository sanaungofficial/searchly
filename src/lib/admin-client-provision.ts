import { logAiUsage } from "@/lib/ai-usage";
import { isApifyConfigured, scrapeLinkedInProfile } from "@/lib/apify-linkedin";
import { applyLinkedInImportForUser } from "@/lib/linkedin-import-apply";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { getLegacyAnthropicClient, hasLegacyAnthropicClient, isKimchiAiConfigured, kimchiModelId } from "@/lib/llm";
import { getPrompt } from "@/lib/prompts";
import { prisma } from "@/lib/prisma";
import { parseResumeFile } from "@/lib/resume-extract";
import { normalizeParsedResumeData, shouldReplaceNameWithResumeName } from "@/lib/resume-parse";
import { syncPrimaryResumeToProfile } from "@/lib/sync-primary-resume";
import { findSupabaseAuthUserIdByEmail, getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  inviteClientAuthUser,
  setClientAuthPassword,
} from "@/lib/admin-client-auth";
import { ADMIN_ROSTER_CLIENT_ROLES, adminRosterClientWhere } from "@/lib/admin-client-roles";
import { getOrgAssignmentsForClient } from "@/lib/client-assignment";
import { Prisma, UserRole, type User } from "@prisma/client";

export type ProvisionClientInput = {
  email: string;
  name?: string | null;
  resumeFile?: File | null;
  linkedinUrl?: string | null;
  /** Send Supabase magic-link invite email (default false) */
  sendInvite?: boolean;
  /** Create/update Supabase auth with this password (no email sent) */
  initialPassword?: string | null;
  /** When true, mark onboarding complete after resume/LinkedIn setup */
  markOnboardingComplete?: boolean;
};

export type ProvisionClientResult = {
  user: User;
  invited: boolean;
  resumeUploaded: boolean;
  linkedinImported: boolean;
  warnings: string[];
};

export function parseProvisionClientFormData(formData: FormData): ProvisionClientInput {
  const email = String(formData.get("email") ?? "").trim();
  const nameRaw = formData.get("name");
  const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : null;
  const linkedinRaw = formData.get("linkedinUrl");
  const linkedinUrl = typeof linkedinRaw === "string" && linkedinRaw.trim() ? linkedinRaw.trim() : null;
  const resumeFile = formData.get("resume");
  const file = resumeFile instanceof File && resumeFile.size > 0 ? resumeFile : null;
  const sendInviteRaw = formData.get("sendInvite");
  const sendInvite =
    sendInviteRaw === "true" ||
    sendInviteRaw === "1" ||
    sendInviteRaw === "on";
  const initialPasswordRaw = formData.get("initialPassword");
  const initialPassword =
    typeof initialPasswordRaw === "string" && initialPasswordRaw.trim()
      ? initialPasswordRaw.trim()
      : null;

  return {
    email,
    name,
    resumeFile: file,
    linkedinUrl,
    sendInvite: initialPassword ? false : sendInvite,
    initialPassword,
  };
}

async function upsertClientUser(email: string, name: string | null): Promise<User> {
  return prisma.user.upsert({
    where: { email },
    update: { name: name ?? undefined, role: UserRole.USER },
    create: { email, name, role: UserRole.USER },
  });
}

async function uploadResumeForClient(input: {
  dbUser: User;
  storageUserId: string;
  file: File;
}): Promise<void> {
  const { dbUser, storageUserId, file } = input;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["pdf", "docx", "txt"].includes(ext)) {
    throw new Error("Upload a PDF, DOCX, or TXT resume");
  }

  const path = `${storageUserId}/resume-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const admin = getSupabaseAdmin();

  const { error: uploadError } = await admin.storage.from("resumes").upload(path, bytes, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: signedData, error: signedError } = await admin.storage
    .from("resumes")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signedError || !signedData) {
    throw new Error("Could not generate resume file URL");
  }

  const anthropic = hasLegacyAnthropicClient() ? getLegacyAnthropicClient() : null;
  const structuredPrompt = isKimchiAiConfigured() || anthropic ? await getPrompt("RESUME_PARSE") : "";
  const { text: resumeText, parsed: parsedRaw, tokensIn, tokensOut } = await parseResumeFile(
    anthropic,
    bytes,
    ext,
    structuredPrompt,
    file.name,
    dbUser.id,
  );

  if (!resumeText) {
    throw new Error("Could not read text from this resume. Try PDF, DOCX, or TXT.");
  }

  if (tokensIn > 0) {
    logAiUsage(dbUser.id, "RESUME_PARSE", await kimchiModelId("parse"), tokensIn, tokensOut);
  }

  const parsedData = parsedRaw;
  const extractedName = parsedData?.name;
  if (
    extractedName &&
    shouldReplaceNameWithResumeName(dbUser.name, dbUser.email, dbUser.name ?? undefined)
  ) {
    await prisma.user.update({ where: { id: dbUser.id }, data: { name: extractedName } });
  }

  await prisma.userAsset.updateMany({
    where: { userId: dbUser.id, type: "RESUME", isPrimary: true },
    data: { isPrimary: false },
  });

  await prisma.userAsset.create({
    data: {
      userId: dbUser.id,
      type: "RESUME",
      name: file.name.replace(/\.[^/.]+$/, "") || "Resume",
      url: signedData.signedUrl,
      isPrimary: true,
      resumeText,
      parsedData: (parsedData ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
    },
  });

  await syncPrimaryResumeToProfile(dbUser.id);
}

async function importLinkedInForClient(input: {
  dbUser: User;
  linkedinUrl: string;
}): Promise<void> {
  const { dbUser, linkedinUrl: rawUrl } = input;
  const linkedinUrl = normalizeLinkedInUrl(rawUrl);
  if (!linkedinUrl) {
    throw new Error("A valid LinkedIn profile URL is required.");
  }

  if (!isApifyConfigured()) {
    throw new Error("LinkedIn import is not configured on this environment.");
  }

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const scraped = await scrapeLinkedInProfile(linkedinUrl, { userId: dbUser.id });
  await applyLinkedInImportForUser({ dbUser, profile, linkedinUrl, scraped });
}

export async function provisionClient(input: ProvisionClientInput): Promise<ProvisionClientResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim() || null;
  const warnings: string[] = [];

  if (!email) throw new Error("Email is required");

  let user = await upsertClientUser(email, name);
  let invited = false;
  let authUserId: string | null = null;

  const initialPassword = input.initialPassword?.trim();
  if (initialPassword) {
    await setClientAuthPassword({ email, password: initialPassword, name });
    authUserId = await findSupabaseAuthUserIdByEmail(email);
    warnings.push("Sign-in account created with the password you set.");
  } else if (input.sendInvite) {
    const authResult = await inviteClientAuthUser(email, name);
    invited = authResult.invited;
    authUserId = await findSupabaseAuthUserIdByEmail(email);
    if (authResult.invited) {
      warnings.push(authResult.message);
    } else {
      warnings.push(authResult.message);
    }
  } else {
    authUserId = await findSupabaseAuthUserIdByEmail(email);
  }

  const storageUserId = authUserId ?? user.id;

  let resumeUploaded = false;
  let linkedinImported = false;

  if (input.resumeFile) {
    await uploadResumeForClient({ dbUser: user, storageUserId, file: input.resumeFile });
    resumeUploaded = true;
    user = (await prisma.user.findUnique({ where: { id: user.id } })) ?? user;
  }

  if (input.linkedinUrl?.trim()) {
    const linkedinUrl = normalizeLinkedInUrl(input.linkedinUrl.trim());
    try {
      await importLinkedInForClient({ dbUser: user, linkedinUrl: input.linkedinUrl.trim() });
      linkedinImported = true;
      user = (await prisma.user.findUnique({ where: { id: user.id } })) ?? user;
    } catch (err) {
      const message = err instanceof Error ? err.message : "LinkedIn import failed.";
      warnings.push(message);
      if (linkedinUrl) {
        await prisma.profile.upsert({
          where: { userId: user.id },
          update: { linkedinUrl },
          create: {
            userId: user.id,
            linkedinUrl,
            targetRoles: [],
            priorities: [],
          },
        });
      }
    }
  }

  const shouldCompleteOnboarding =
    input.markOnboardingComplete ?? (resumeUploaded || linkedinImported);
  if (shouldCompleteOnboarding) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { onboardingCompletedAt: new Date() },
    });
  }

  return { user, invited, resumeUploaded, linkedinImported, warnings };
}

export async function fetchAdminClientById(userId: string) {
  const client = await prisma.user.findFirst({
    where: adminRosterClientWhere(userId),
    include: {
      profile: {
        select: {
          headline: true,
          targetRoles: true,
          targetSalary: true,
          resumeUrl: true,
          linkedinUrl: true,
        },
      },
      subscription: { select: { status: true, stripeCurrentPeriodEnd: true } },
      jobs: {
        select: { id: true, company: true, role: true, stage: true, appliedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: { select: { jobs: true, tailoredResumes: true } },
      coachAssignments: {
        include: {
          coachProfile: {
            select: {
              id: true,
              displayName: true,
              slug: true,
              photoUrl: true,
              headline: true,
              isInternal: true,
              nylasSchedulerConfigId: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) return null;

  const orgAssignments = await getOrgAssignmentsForClient(userId);
  return { ...client, orgAssignments };
}
