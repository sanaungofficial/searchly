import type { OrgContact, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  EMPTY_STRENGTH_FACTORS,
  mergeRecentStrings,
  parseStrengthFactors,
  type OrgContactStrengthFactors,
} from "@/lib/org-contact-graph/types";
import { companyFromEmailDomain, normalizeOrgContactEmail } from "@/lib/org-contact-graph/normalize-email";

function mergeContactFields(
  existing: Pick<OrgContact, "name" | "company" | "title" | "phone" | "linkedinUrl">,
  incoming: {
    name?: string | null;
    company?: string | null;
    title?: string | null;
    phone?: string | null;
    linkedinUrl?: string | null;
  },
) {
  return {
    name: incoming.name?.trim() || existing.name,
    company: incoming.company?.trim() || existing.company,
    title: incoming.title?.trim() || existing.title,
    phone: incoming.phone?.trim() || existing.phone,
    linkedinUrl: incoming.linkedinUrl?.trim() || existing.linkedinUrl,
  };
}

export async function upsertOrgContact(params: {
  orgId: string;
  email: string;
  name?: string | null;
  company?: string | null;
  title?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  activityAt?: Date | null;
}) {
  const emailNormalized = normalizeOrgContactEmail(params.email);
  if (!emailNormalized) return null;

  const inferredCompany = params.company?.trim() || companyFromEmailDomain(emailNormalized);
  const incoming = {
    name: params.name?.trim() || null,
    company: inferredCompany,
    title: params.title?.trim() || null,
    phone: params.phone?.trim() || null,
    linkedinUrl: params.linkedinUrl?.trim() || null,
  };

  const existing = await prisma.orgContact.findUnique({
    where: { orgId_emailNormalized: { orgId: params.orgId, emailNormalized } },
  });

  if (existing) {
    const merged = mergeContactFields(existing, incoming);
    return prisma.orgContact.update({
      where: { id: existing.id },
      data: {
        ...merged,
        ...(params.activityAt
          ? {
              lastActivityAt: existing.lastActivityAt
                ? new Date(Math.max(existing.lastActivityAt.getTime(), params.activityAt.getTime()))
                : params.activityAt,
            }
          : {}),
      },
    });
  }

  return prisma.orgContact.create({
    data: {
      orgId: params.orgId,
      email: params.email.trim(),
      emailNormalized,
      ...incoming,
      lastActivityAt: params.activityAt ?? null,
    },
  });
}

export async function touchOrgContactKnownBy(params: {
  orgContactId: string;
  networkSourceId: string;
  seenAt: Date;
  patch?: Partial<OrgContactStrengthFactors> & {
    subject?: string | null;
    meetingTitle?: string | null;
    oneOnOneMeetingCount?: number;
    groupMeetingCount?: number;
  };
}) {
  const existing = await prisma.orgContactKnownBy.findUnique({
    where: {
      orgContactId_networkSourceId: {
        orgContactId: params.orgContactId,
        networkSourceId: params.networkSourceId,
      },
    },
  });

  const prev = parseStrengthFactors(existing?.strengthFactors);
  const patch = params.patch ?? {};
  const next: OrgContactStrengthFactors = {
    emailCount: prev.emailCount + (patch.emailCount ?? 0),
    meetingCount: prev.meetingCount + (patch.meetingCount ?? 0),
    inboundCount: prev.inboundCount + (patch.inboundCount ?? 0),
    outboundCount: prev.outboundCount + (patch.outboundCount ?? 0),
    oneOnOneMeetingCount: prev.oneOnOneMeetingCount + (patch.oneOnOneMeetingCount ?? 0),
    groupMeetingCount: prev.groupMeetingCount + (patch.groupMeetingCount ?? 0),
    recentSubjects: patch.subject
      ? mergeRecentStrings(prev.recentSubjects, patch.subject)
      : prev.recentSubjects,
    recentMeetings: patch.meetingTitle
      ? mergeRecentStrings(prev.recentMeetings, patch.meetingTitle)
      : prev.recentMeetings,
    lastEmailAt: patch.lastEmailAt ?? prev.lastEmailAt,
    lastMeetingAt: patch.lastMeetingAt ?? prev.lastMeetingAt,
  };

  const data: Prisma.OrgContactKnownByUpsertArgs["create"] = {
    orgContactId: params.orgContactId,
    networkSourceId: params.networkSourceId,
    strengthScore: 0,
    strengthFactors: next as Prisma.InputJsonValue,
    firstSeenAt: params.seenAt,
    lastSeenAt: params.seenAt,
  };

  if (existing) {
    return prisma.orgContactKnownBy.update({
      where: { id: existing.id },
      data: {
        strengthFactors: next as Prisma.InputJsonValue,
        firstSeenAt: existing.firstSeenAt
          ? new Date(Math.min(existing.firstSeenAt.getTime(), params.seenAt.getTime()))
          : params.seenAt,
        lastSeenAt: existing.lastSeenAt
          ? new Date(Math.max(existing.lastSeenAt.getTime(), params.seenAt.getTime()))
          : params.seenAt,
      },
    });
  }

  return prisma.orgContactKnownBy.create({ data });
}

export async function seedOrgContactKnownBy(params: {
  orgContactId: string;
  networkSourceId: string;
  seenAt?: Date;
}) {
  const seenAt = params.seenAt ?? new Date();
  return prisma.orgContactKnownBy.upsert({
    where: {
      orgContactId_networkSourceId: {
        orgContactId: params.orgContactId,
        networkSourceId: params.networkSourceId,
      },
    },
    create: {
      orgContactId: params.orgContactId,
      networkSourceId: params.networkSourceId,
      strengthScore: 0,
      strengthFactors: EMPTY_STRENGTH_FACTORS as Prisma.InputJsonValue,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
    },
    update: {},
  });
}
