import { getActingUser } from "@/lib/acting-user";
import { upsertProfileFields } from "@/lib/profile-write";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Append voice debrief or chat context to career strategy intake — available to all signed-in users. */
export async function POST(request: Request) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    block?: string;
    presetTitle?: string;
    summary?: string;
  };

  const block = body.block?.trim();
  if (!block) return NextResponse.json({ error: "block required" }, { status: 400 });

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const existing = profile?.strategyIntakeNotes?.trim() ?? "";
  const header = body.presetTitle
    ? `[Kimchi voice · ${body.presetTitle} · ${new Date().toLocaleDateString()}]`
    : `[Kimchi · ${new Date().toLocaleDateString()}]`;
  const excerpt = body.summary?.trim() ? `${body.summary}\n\n${block}` : block;
  const merged = existing ? `${existing}\n\n---\n\n${header}\n${excerpt}` : `${header}\n${excerpt}`;
  const saved = merged.slice(0, 24000);

  await upsertProfileFields(dbUser.id, { strategyIntakeNotes: saved });

  return NextResponse.json({
    ok: true,
    savedExcerpt: excerpt.slice(0, 600),
    intakeLength: saved.length,
    profilePath: "/profile/career-strategy",
  });
}
