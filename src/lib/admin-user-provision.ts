import {
  inviteClientAuthUser,
  setClientAuthPassword,
} from "@/lib/admin-client-auth";
import { fetchAdminClientById, provisionClient } from "@/lib/admin-client-provision";
import { prisma } from "@/lib/prisma";
import { UserRole, type User } from "@prisma/client";

export type ProvisionUserInput = {
  email: string;
  name?: string | null;
  role?: UserRole;
  resumeFile?: File | null;
  linkedinUrl?: string | null;
  sendInvite?: boolean;
  initialPassword?: string | null;
};

export type ProvisionUserResult = {
  user: User;
  invited: boolean;
  resumeUploaded: boolean;
  linkedinImported: boolean;
  warnings: string[];
};

async function upsertUserWithRole(
  email: string,
  name: string | null,
  role: UserRole,
): Promise<User> {
  return prisma.user.upsert({
    where: { email },
    update: { name: name ?? undefined, role },
    create: { email, name, role },
  });
}

export async function provisionUser(input: ProvisionUserInput): Promise<ProvisionUserResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim() || null;
  const role = input.role ?? UserRole.USER;
  const initialPassword = input.initialPassword?.trim() || null;
  const sendInvite = initialPassword ? false : Boolean(input.sendInvite);
  const hasClientExtras = Boolean(input.resumeFile || input.linkedinUrl?.trim());

  if (!email) throw new Error("Email is required");

  if (role === UserRole.USER && hasClientExtras) {
    const result = await provisionClient({
      email,
      name,
      resumeFile: input.resumeFile,
      linkedinUrl: input.linkedinUrl,
      sendInvite,
      initialPassword,
    });
    return {
      user: result.user,
      invited: result.invited,
      resumeUploaded: result.resumeUploaded,
      linkedinImported: result.linkedinImported,
      warnings: result.warnings,
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== role) {
    throw new Error(`An account with this email already exists as ${existing.role.toLowerCase()}.`);
  }

  let user = await upsertUserWithRole(email, name, role);
  const warnings: string[] = [];
  let invited = false;

  if (initialPassword) {
    const authResult = await setClientAuthPassword({ email, password: initialPassword, name });
    warnings.push(authResult.message);
  } else if (sendInvite) {
    const authResult = await inviteClientAuthUser(email, name);
    invited = authResult.invited;
    warnings.push(authResult.message);
  }

  return {
    user,
    invited,
    resumeUploaded: false,
    linkedinImported: false,
    warnings,
  };
}

export async function fetchAdminUserById(userId: string) {
  const currentMonth = new Date().toISOString().slice(0, 7);

  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: { select: { status: true, stripeCurrentPeriodEnd: true } },
      monthlyUsage: { where: { month: currentMonth } },
      profile: {
        select: {
          headline: true,
          summary: true,
          linkedinUrl: true,
          targetRoles: true,
          targetSalary: true,
          employmentStatus: true,
          currentSalary: true,
          careerMotivation: true,
          jobTimeline: true,
          attribution: true,
          resumeUrl: true,
        },
      },
      jobs: {
        select: { id: true, company: true, role: true, stage: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      _count: { select: { jobs: true } },
    },
  });
}

/** Full client row shape for admin client list after USER provisioning. */
export async function fetchProvisionedUserPayload(userId: string, role: UserRole) {
  if (role === UserRole.USER) {
    return fetchAdminClientById(userId);
  }
  return fetchAdminUserById(userId);
}
