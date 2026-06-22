import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PROMPT_META, PROMPT_DEFAULTS, invalidatePromptCache } from "@/lib/prompts";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = admin;

  const { key } = await params;
  if (!PROMPT_META[key]) return NextResponse.json({ error: "Unknown prompt key" }, { status: 400 });

  const { content } = await request.json();
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const defaultContent = PROMPT_DEFAULTS[key] ?? "";
  const meta = PROMPT_META[key];

  const row = await prisma.promptConfig.upsert({
    where: { key },
    create: {
      key,
      label: meta.label,
      description: meta.description,
      category: meta.category,
      content,
      defaultContent,
      updatedBy: user.email,
    },
    update: {
      content,
      updatedBy: user.email,
    },
  });

  invalidatePromptCache(key);

  return NextResponse.json({
    key: row.key,
    content: row.content,
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await params;

  // Check if this is the /reset sub-route (handled by reset/route.ts)
  // This handler is only for PATCH; POST here is a no-op fallback
  return NextResponse.json({ error: "Use POST /api/admin/prompts/[key]/reset" }, { status: 404 });
}
