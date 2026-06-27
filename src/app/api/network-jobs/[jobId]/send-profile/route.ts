import { resolveProfileApiSubject } from "@/lib/admin-client-subject";
import {
  canViewNetworkJobInternalFromSession,
  sanitizeNetworkJobListing,
} from "@/lib/network-job-access";
import { networkJobShowSendProfile } from "@/lib/network-job-client-actions";
import { createNetworkJobRequest } from "@/lib/network-job-request";
import { loadNetworkJobListingById } from "@/lib/network-jobs-load";
import { NextResponse } from "next/server";

type SendProfileBody = {
  notes?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const externalId = decodeURIComponent(jobId ?? "").trim();
  if (!externalId) {
    return NextResponse.json({ error: "Missing job id." }, { status: 400 });
  }

  const resolved = await resolveProfileApiSubject(request);
  if ("error" in resolved) return resolved.error;

  const { dbUser, acting } = resolved;
  if (!dbUser?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const internalView = canViewNetworkJobInternalFromSession(
    acting.realDbUser,
    acting.realDbUser?.role === "ADMIN",
    acting.isImpersonating,
  );
  if (internalView) {
    return NextResponse.json({ error: "Send profile is for clients only." }, { status: 400 });
  }

  const listing = await loadNetworkJobListingById(externalId);
  if (!listing) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const job = sanitizeNetworkJobListing(listing, false);
  if (!networkJobShowSendProfile(job, false)) {
    return NextResponse.json(
      { error: "This role uses a direct application link instead of profile send." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as SendProfileBody;

  try {
    const { request: row, duplicate } = await createNetworkJobRequest({
      userId: dbUser.id,
      job,
      requestType: "SEND_PROFILE",
      clientNotes: body.notes,
    });
    return NextResponse.json({ ok: true, id: row.id, duplicate });
  } catch (e) {
    console.error("[network-send-profile]", e);
    return NextResponse.json({ error: "Could not queue profile send. Try again shortly." }, { status: 500 });
  }
}
