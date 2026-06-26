import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  DEFAULT_KIMCHI_AI_SETTINGS,
  getKimchiAiSettings,
  patchKimchiAiSettings,
} from "@/lib/kimchi-ai-settings";
import { usesAiGateway } from "@/lib/llm";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await getKimchiAiSettings();
  return NextResponse.json({
    settings,
    defaults: DEFAULT_KIMCHI_AI_SETTINGS,
    gatewayConfigured: usesAiGateway(),
    recommendations: {
      talk: "openai/gpt-4o-mini (chat, voice debrief, mail — cheapest)",
      analyze: "anthropic/claude-haiku-4.5 (scoring, matching)",
      create: "anthropic/claude-sonnet-4.6 (strategy docs, resumes, cover letters)",
      parse: "anthropic/claude-haiku-4.5 (resume parse, intake extraction)",
    },
  });
}

export async function PATCH(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<typeof DEFAULT_KIMCHI_AI_SETTINGS>;
  const settings = await patchKimchiAiSettings(body, admin.email ?? admin.id);
  return NextResponse.json({ settings });
}
