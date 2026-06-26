import { getActingUser } from "@/lib/acting-user";
import { deepgramConfigured } from "@/lib/deepgram";
import {
  buildOnboardingVoiceAgentSettings,
  buildWorkspaceVoiceAgentSettings,
} from "@/lib/voice-agent-config";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const context = searchParams.get("context") === "onboarding" ? "onboarding" : "workspace";

  return NextResponse.json(
    {
      agentAvailable: deepgramConfigured(),
      transcriptionAvailable: deepgramConfigured(),
      extractionAvailable: !!process.env.ANTHROPIC_API_KEY,
      context,
      thinkModel: "gpt-4o-mini",
      agent: deepgramConfigured()
        ? context === "onboarding"
          ? buildOnboardingVoiceAgentSettings()
          : buildWorkspaceVoiceAgentSettings()
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
