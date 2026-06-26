import { getActingUser } from "@/lib/acting-user";
import { deepgramConfigured } from "@/lib/deepgram";
import { buildOnboardingVoiceAgentSettings } from "@/lib/voice-agent-config";
import { NextResponse } from "next/server";

export async function GET() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    agentAvailable: deepgramConfigured(),
    transcriptionAvailable: deepgramConfigured(),
    extractionAvailable: !!process.env.ANTHROPIC_API_KEY,
    agent: deepgramConfigured() ? buildOnboardingVoiceAgentSettings() : null,
  });
}
