import Anthropic from "@anthropic-ai/sdk";
import { Prisma, UserRole, type User } from "@prisma/client";
import { logAiUsage } from "@/lib/ai-usage";
import {
  buildResumeTextFromParsed,
  isApifyConfigured,
  mapApifyProfileToLinkedInDraft,
  mapApifyProfileToParsedData,
  scrapeLinkedInProfile,
} from "@/lib/apify-linkedin";
import { mergeLinkedInImportParsed } from "@/lib/merge-parsed-data";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { getPrompt } from "@/lib/prompts";
import { prisma } from "@/lib/prisma";
import { PARSE_MODEL, parseResumeFile } from "@/lib/resume-extract";
import { normalizeParsedResumeData, shouldReplaceNameWithResumeName } from "@/lib/resume-parse";
import { syncPrimaryResumeToProfile } from "@/lib/sync-primary-resume";
import { findSupabaseAuthUserIdByEmail, getSupabaseAdmin } from "@/lib/supabase-admin";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export type ProvisionClientInput = {
  email: string;
  name?: string | null;
  resumeFile?: File | null;
  linkedinUrl?: string | null;
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

async function ensureAuthUser(email: string, name: string | null): Promise<{ authUserId: string; invited: boolean }> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name ?? "" },
  });

  if (data?.user?.id) {
    return { authUserId: data.user.id, invited: true };
  }

  if (error && !error.message.includes("already been registered")) {
    throw new Error(error.message);
  }

  const authUserId = await findSupabaseAuthUserIdByEmail(email);
  if (!authUserId) {
    throw new Error("Could not find or create auth account for this email.");
  }

  return { authUserId, invited: false };
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
  authUserId: string;
  file: File;
}): Promise<void> {
  const { dbUser, authUserId, file } = input;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["pdf", "docx", "txt"].includes(ext)) {
    throw new Error("Upload a PDF, DOCX, or TXT resume");
  }

  const path = `${authUserId}/resume-${Date.now()}.${ext}`;
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

  const anthropic = process.env.ANTHROPIC_API_KEY ? getAnthropic() : null;
  const structuredPrompt = anthropic ? await getPrompt("RESUME_PARSE") : "";
  const { text: resumeText, parsed: parsedRaw, tokensIn, tokensOut } = await parseResumeFile(
    anthropic,
    bytes,
    ext,
    structuredPrompt,
    file.name,
  );

  if (!resumeText) {
    throw new Error("Could not read text from this resume. Try PDF, DOCX, or TXT.");
  }

  if (tokensIn > 0) {
    logAiUsage(dbUser.id, "RESUME_PARSE", PARSE_MODEL, tokensIn, tokensOut);
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
  const scraped = await scrapeLinkedInProfile(linkedinUrl);
  const incomingParsed = mapApifyProfileToParsedData(scraped);
  const existingParsed = normalizeParsedResumeData(profile?.parsedData ?? null);
  const mergedParsed = mergeLinkedInImportParsed(existingParsed, incomingParsed);
  const linkedInDraft = mapApifyProfileToLinkedInDraft(scraped);
  const resumeText = buildResumeTextFromParsed(mergedParsed);

  const fullName = mergedParsed.name?.trim();
  if (fullName && !dbUser.name?.trim()) {
    await prisma.user.update({ where: { id: dbUser.id }, data: { name: fullName } });
  }

  await prisma.profile.upsert({
    where: { userId: dbUser.id },
    update: {
      linkedinUrl,
      headline: scraped.headline?.trim() || profile?.headline || null,
      summary: mergedParsed.summary ?? profile?.summary ?? null,
      parsedData: mergedParsed as unknown as Prisma.InputJsonValue,
      resumeText: resumeText || profile?.resumeText || null,
      linkedInDraft: linkedInDraft as unknown as Prisma.InputJsonValue,
      linkedInDraftUpdatedAt: new Date(),
    },
    create: {
      userId: dbUser.id,
      linkedinUrl,
      headline: scraped.headline?.trim() || null,
      summary: mergedParsed.summary ?? null,
      parsedData: mergedParsed as unknown as Prisma.InputJsonValue,
      resumeText,
      linkedInDraft: linkedInDraft as unknown as Prisma.InputJsonValue,
      linkedInDraftUpdatedAt: new Date(),
      targetRoles: [],
      priorities: [],
    },
  });

  const primaryAsset = await prisma.userAsset.findFirst({
    where: { userId: dbUser.id, type: "RESUME", isPrimary: true },
    orderBy: { createdAt: "desc" },
  });
  if (primaryAsset) {
    await prisma.userAsset.update({
      where: { id: primaryAsset.id },
      data: {
        parsedData: mergedParsed as unknown as Prisma.InputJsonValue,
        resumeText: resumeText || primaryAsset.resumeText,
      },
    });
  }
}

export async function provisionClient(input: ProvisionClientInput): Promise<ProvisionClientResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim() || null;
  const warnings: string[] = [];

  if (!email) throw new Error("Email is required");

  const { authUserId, invited } = await ensureAuthUser(email, name);
  let user = await upsertClientUser(email, name);

  let resumeUploaded = false;
  let linkedinImported = false;

  if (input.resumeFile) {
    await uploadResumeForClient({ dbUser: user, authUserId, file: input.resumeFile });
    resumeUploaded = true;
    user = (await prisma.user.findUnique({ where: { id: user.id } })) ?? user;
  }

  if (input.linkedinUrl?.trim()) {
    try {
      await importLinkedInForClient({ dbUser: user, linkedinUrl: input.linkedinUrl.trim() });
      linkedinImported = true;
      user = (await prisma.user.findUnique({ where: { id: user.id } })) ?? user;
    } catch (err) {
      if (resumeUploaded) {
        warnings.push(err instanceof Error ? err.message : "LinkedIn import failed.");
      } else {
        throw err;
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

  if (invited) {
    warnings.push("Invite email sent — client can sign in with the magic link.");
  } else {
    warnings.push("Account already existed in auth — no new invite sent.");
  }

  return { user, invited, resumeUploaded, linkedinImported, warnings };
}

export async function fetchAdminClientById(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, role: UserRole.USER },
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
    },
  });
}
