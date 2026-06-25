import { prisma } from "@/lib/prisma";
import { coachProfileSlug } from "@/lib/coach-slug";
import { ensureCoachSchedulerConfig, isNylasConfigured, schedulerSlugForCoach } from "@/lib/nylas";

export async function syncCoachSchedulerFromProfile(profileId: string) {
  if (!isNylasConfigured()) return null;

  const profile = await prisma.coachProfile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      displayName: true,
      email: true,
      slug: true,
      nylasGrantId: true,
      nylasSchedulerConfigId: true,
      nylasSchedulerSlug: true,
      schedulerDurationMinutes: true,
    },
  });

  if (!profile?.nylasGrantId) return null;

  const slug = profile.slug ?? coachProfileSlug(profile.displayName, profile.id);
  const schedulerSlug = profile.nylasSchedulerSlug ?? schedulerSlugForCoach(slug, profile.id);

  const result = await ensureCoachSchedulerConfig({
    grantId: profile.nylasGrantId,
    configId: profile.nylasSchedulerConfigId,
    coachName: profile.displayName,
    coachEmail: profile.email ?? "",
    slug: schedulerSlug,
    durationMinutes: profile.schedulerDurationMinutes ?? 30,
  });

  if (result.created || result.configId !== profile.nylasSchedulerConfigId) {
    await prisma.coachProfile.update({
      where: { id: profile.id },
      data: {
        nylasSchedulerConfigId: result.configId,
        ...(result.slug ? { nylasSchedulerSlug: result.slug } : {}),
      },
    });
  }

  return result;
}
