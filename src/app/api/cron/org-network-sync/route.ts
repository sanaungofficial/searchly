import { NextResponse } from "next/server";
import { syncAllPooledOrgNetworkSources } from "@/lib/org-contact-graph";

function authorizeCron(req: Request) {
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAllPooledOrgNetworkSources();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAllPooledOrgNetworkSources();
  return NextResponse.json({ ok: true, ...result });
}
