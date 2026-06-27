import type { NetworkJobListing } from "@/lib/network-job-display";
import { networkAgencyDisplayName } from "@/lib/network-job-display";
import { networkSourceChannelCode } from "@/lib/network-source-labels";
import { prisma } from "@/lib/prisma";
import type { NetworkJobRequestStatus, NetworkJobRequestType } from "@prisma/client";

export type CreateNetworkJobRequestInput = {
  userId: string;
  job: Pick<
    NetworkJobListing,
    "id" | "externalId" | "source" | "positionTitle" | "recruiter" | "recruiters"
  >;
  requestType: NetworkJobRequestType;
  clientNotes?: string | null;
};

export async function createNetworkJobRequest(input: CreateNetworkJobRequestInput) {
  const externalId = input.job.externalId || input.job.id;
  const recruiter = input.job.recruiter ?? input.job.recruiters?.[0] ?? null;

  const existing = await prisma.networkJobRequest.findFirst({
    where: {
      userId: input.userId,
      jobExternalId: externalId,
      jobSource: input.job.source,
      requestType: input.requestType,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    select: { id: true, status: true, createdAt: true },
  });

  if (existing) {
    return { request: existing, duplicate: true as const };
  }

  const request = await prisma.networkJobRequest.create({
    data: {
      userId: input.userId,
      jobSource: input.job.source,
      jobExternalId: externalId,
      requestType: input.requestType,
      jobTitle: input.job.positionTitle,
      companyName: networkAgencyDisplayName(input.job),
      channelCode: networkSourceChannelCode(input.job.source),
      recruiterName: recruiter?.name ?? null,
      clientNotes: input.clientNotes?.trim() || null,
    },
    select: { id: true, status: true, createdAt: true },
  });

  return { request, duplicate: false as const };
}

export const NETWORK_JOB_REQUEST_STATUS_LABELS: Record<NetworkJobRequestStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const NETWORK_JOB_REQUEST_TYPE_LABELS: Record<NetworkJobRequestType, string> = {
  INTRO: "Introduction",
  SEND_PROFILE: "Send profile",
};
