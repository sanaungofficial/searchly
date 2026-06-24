import { requireAdmin } from "@/lib/auth";
import { TopEchelonClient, getTopEchelonCredentials } from "@/lib/topechelon/client";
import { TopEchelonMfaRequiredError, TopEchelonSessionExpiredError } from "@/lib/topechelon/errors";
import { mapTopEchelonNetworkJob } from "@/lib/topechelon/map-network-job";
import { loadTopEchelonSession, saveTopEchelonSession } from "@/lib/topechelon/session-store";
import { NextResponse } from "next/server";

type PreviewBody = {
  mfaCode?: string;
  limit?: number;
};

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: PreviewBody = {};
  try {
    body = (await request.json()) as PreviewBody;
  } catch {
    /* optional body */
  }

  const limit = Math.min(Math.max(body.limit ?? 3, 1), 10);

  try {
    const stored = await loadTopEchelonSession();
    const creds = getTopEchelonCredentials();
    if (!creds) {
      return NextResponse.json({ error: "TOPECHELON_EMAIL / TOPECHELON_PASSWORD not set" }, { status: 500 });
    }

    let client: TopEchelonClient;
    if (stored?.tokenPayload && !body.mfaCode) {
      client = new TopEchelonClient(stored);
      try {
        await client.refreshSession();
      } catch (err) {
        if (!(err instanceof TopEchelonSessionExpiredError)) throw err;
        client = new TopEchelonClient();
        await client.login({ ...creds, newDeviceMfaCode: body.mfaCode, mfaCode: body.mfaCode });
      }
    } else {
      client = new TopEchelonClient(stored);
      await client.login({
        ...creds,
        newDeviceMfaCode: body.mfaCode,
        mfaCode: body.mfaCode,
      });
    }

    await saveTopEchelonSession(client.getSession());
    const jobs = await client.fetchNetworkJobsWithDetails(limit);

    return NextResponse.json({
      ok: true,
      count: jobs.length,
      jobs: jobs.map((job) => ({
        mapped: mapTopEchelonNetworkJob(job),
        raw: job,
      })),
    });
  } catch (err) {
    if (err instanceof TopEchelonMfaRequiredError) {
      return NextResponse.json(
        {
          ok: false,
          code: err.code,
          error: err.message,
          hint: 'POST { "mfaCode": "123456", "limit": 3 } after checking your email.',
        },
        { status: 428 }
      );
    }
    console.error("[admin topechelon preview]", err);
    const message = err instanceof Error ? err.message : "Preview failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
