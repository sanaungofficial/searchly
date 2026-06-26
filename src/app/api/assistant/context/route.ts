import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { buildAssistantContext } from "@/lib/kimchi-assistant/context";
import type { AssistantPageHint } from "@/lib/kimchi-assistant/types";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function parsePageHint(searchParams: URLSearchParams): AssistantPageHint | undefined {
  const pathname = searchParams.get("pathname") ?? undefined;
  const jobDbId = searchParams.get("jobDbId") ?? undefined;
  const jobRole = searchParams.get("jobRole") ?? undefined;
  const jobCompany = searchParams.get("jobCompany") ?? undefined;
  const chatView = searchParams.get("chatView") ?? undefined;
  if (!pathname && !jobDbId && !jobRole && !chatView) return undefined;
  return { pathname, jobDbId, jobRole, jobCompany, chatView };
}

export async function GET(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: dbUser.id },
    include: { profile: true, subscription: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const pageHint = parsePageHint(searchParams);

  const context = await buildAssistantContext({ user, pageHint });

  return NextResponse.json(context, { headers: { "Cache-Control": "no-store" } });
}
