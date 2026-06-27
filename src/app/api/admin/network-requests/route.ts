import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  NETWORK_JOB_REQUEST_STATUS_LABELS,
  NETWORK_JOB_REQUEST_TYPE_LABELS,
} from "@/lib/network-job-request";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const view = url.searchParams.get("view") ?? "open";
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));

  const where =
    view === "done"
      ? { status: { in: ["COMPLETED", "CANCELLED"] as const } }
      : { status: { in: ["PENDING", "IN_PROGRESS"] as const } };

  const [requests, pendingCount] = await Promise.all([
    prisma.networkJobRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.networkJobRequest.count({ where: { status: "PENDING" } }),
  ]);

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      requestType: r.requestType,
      requestTypeLabel: NETWORK_JOB_REQUEST_TYPE_LABELS[r.requestType],
      status: r.status,
      statusLabel: NETWORK_JOB_REQUEST_STATUS_LABELS[r.status],
      jobTitle: r.jobTitle,
      companyName: r.companyName,
      channelCode: r.channelCode,
      recruiterName: r.recruiterName,
      jobExternalId: r.jobExternalId,
      jobSource: r.jobSource,
      clientNotes: r.clientNotes,
      adminNotes: r.adminNotes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      handledAt: r.handledAt?.toISOString() ?? null,
      user: r.user,
    })),
    pendingCount,
  });
}
