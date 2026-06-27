import { NextResponse } from "next/server";
import { getAuthedUserForAi } from "@/lib/ai-guard";
import { runVoiceDebrief, type DebriefContextHint } from "@/lib/kimchi-assistant/debrief";
import { isVoicePresetId, type VoicePresetId } from "@/lib/kimchi-assistant/voice-presets";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getAuthedUserForAi(request);
  if ("error" in auth) {
    return auth.error;
  }
  const { dbUser } = auth;

  let body: {
    presetId?: string;
    transcript?: string;
    contextHint?: DebriefContextHint;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json({ error: "Transcript required" }, { status: 400 });
  }

  const presetId: VoicePresetId =
    body.presetId && isVoicePresetId(body.presetId) ? body.presetId : "general";

  const debrief = await runVoiceDebrief({
    userId: dbUser.id,
    presetId,
    transcript,
    contextHint: body.contextHint,
  });

  return NextResponse.json({
    presetId,
    rawTranscript: transcript,
    ...debrief,
  });
}
