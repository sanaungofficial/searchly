import { getActingUser } from "@/lib/acting-user";
import { buildAssistantContext } from "@/lib/kimchi-assistant/context";
import type { AssistantPageHint } from "@/lib/kimchi-assistant/types";
import { deepgramConfigured } from "@/lib/deepgram";
import { isKimchiAiConfigured } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import {
  buildOnboardingVoiceAgentSettings,
  buildWorkspaceVoiceAgentSettings,
  resolveVoicePresetId,
  type OnboardingCoachContext,
} from "@/lib/voice-agent-config";
import { NextResponse } from "next/server";

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
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const context = searchParams.get("context") === "onboarding" ? "onboarding" : "workspace";
  const pageHint = parsePageHint(searchParams);
  const voicePreset = resolveVoicePresetId(searchParams.get("preset"));

  let onboardingCoach: OnboardingCoachContext | null = null;
  if (context === "onboarding") {
    const coachField = searchParams.get("coachField");
    const coachQuestion = searchParams.get("coachQuestion");
    const coachStep = searchParams.get("coachStep");
    if (coachField && coachQuestion && coachStep) {
      onboardingCoach = {
        stepId: coachStep,
        field: coachField,
        question: coachQuestion,
        hint: searchParams.get("coachHint") ?? undefined,
        stepIndex: Math.max(0, Number(searchParams.get("coachIndex") ?? 0)),
        stepTotal: Math.max(1, Number(searchParams.get("coachTotal") ?? 1)),
      };
    }
  }

  let assistantContext = null;
  if (context === "workspace" && deepgramConfigured()) {
    const user = await prisma.user.findUnique({
      where: { id: dbUser.id },
      include: { profile: true, subscription: true },
    });
    if (user) {
      assistantContext = await buildAssistantContext({ user, pageHint });
    }
  }

  return NextResponse.json(
    {
      agentAvailable: deepgramConfigured(),
      transcriptionAvailable: deepgramConfigured(),
      extractionAvailable: isKimchiAiConfigured(),
      context,
      thinkModel: "gpt-4o-mini",
      agent: deepgramConfigured()
        ? context === "onboarding"
          ? buildOnboardingVoiceAgentSettings(onboardingCoach)
          : await buildWorkspaceVoiceAgentSettings(assistantContext, voicePreset)
        : null,
      assistantSummary: assistantContext?.summary ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
