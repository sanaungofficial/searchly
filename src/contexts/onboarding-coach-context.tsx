"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useOnboardingCoach } from "@/hooks/use-onboarding-coach";
import {
  useVoiceAgentSession,
  type VoiceAgentSessionResult,
} from "@/hooks/use-voice-agent-session";
import {
  ONBOARDING_COACH_ALL_STEPS,
  ONBOARDING_COACH_SCREEN_ANCHORS,
  ONBOARDING_COACH_SCREENS,
} from "@/lib/onboarding-coach/steps";
import type { OnboardingCompanyPick } from "@/lib/onboarding-coach/types";
import type { Screen } from "@/components/scout/screens";
import {
  buildOnboardingCoachPrompt,
  type OnboardingCoachContext,
} from "@/lib/onboarding-coach/voice-prompt";
import type { VoiceAgentFieldPatch } from "@/lib/voice-intake";

type OnboardingCoachContextValue = {
  coach: ReturnType<typeof useOnboardingCoach>;
  voice: ReturnType<typeof useVoiceAgentSession>;
  showPanel: boolean;
};

const Ctx = createContext<OnboardingCoachContextValue | null>(null);

export function useOnboardingCoachContext() {
  return useContext(Ctx);
}

type ProviderProps = {
  screen: Screen;
  children: ReactNode;
  onApplyPatch: (patch: VoiceAgentFieldPatch) => void;
  onApplyCompany: (company: OnboardingCompanyPick) => void;
  getMultiCount: (field: string) => number;
  onVoiceComplete?: (result: VoiceAgentSessionResult) => void;
};

function coachContextPayload(
  coach: ReturnType<typeof useOnboardingCoach>,
): OnboardingCoachContext | null {
  const step = coach.currentStep;
  if (!step) return null;
  return {
    stepId: step.id,
    field: step.field,
    question: coach.displayQuestion,
    hint: step.hint,
    kind: step.kind ?? "field",
    stepIndex: coach.stepIndex,
    stepTotal: ONBOARDING_COACH_ALL_STEPS.length,
    multiCount: coach.multiCount,
    multiMax: step.multiMax,
  };
}

export function OnboardingCoachProvider({
  screen,
  children,
  onApplyPatch,
  onApplyCompany,
  getMultiCount,
  onVoiceComplete,
}: ProviderProps) {
  const coach = useOnboardingCoach({
    steps: ONBOARDING_COACH_ALL_STEPS,
    onApplyPatch,
    onApplyCompany,
    getMultiCount,
  });

  const initialCoachQuery = useMemo(() => {
    const step = ONBOARDING_COACH_ALL_STEPS[0];
    if (!step) return "";
    const params = new URLSearchParams();
    params.set("coachStep", step.id);
    params.set("coachField", step.field);
    params.set("coachQuestion", step.question);
    params.set("coachKind", step.kind ?? "field");
    if (step.hint) params.set("coachHint", step.hint);
    if (step.multiMax) params.set("coachMultiMax", String(step.multiMax));
    params.set("coachMultiCount", "0");
    params.set("coachIndex", "0");
    params.set("coachTotal", String(ONBOARDING_COACH_ALL_STEPS.length));
    return `&${params.toString()}`;
  }, []);

  const voice = useVoiceAgentSession({
    context: "onboarding",
    disabled: coach.isComplete,
    continuousOnboarding: true,
    onboardingCoachQuery: initialCoachQuery,
    onOnboardingPropose: coach.handleVoicePropose,
    onOnboardingConfirm: coach.handleVoiceConfirm,
    onComplete: onVoiceComplete,
  });

  const showPanel = ONBOARDING_COACH_SCREENS.has(screen) && !coach.isComplete;

  useEffect(() => {
    const anchor = ONBOARDING_COACH_SCREEN_ANCHORS[screen];
    if (anchor !== undefined) coach.syncToScreenAnchor(anchor);
  }, [coach.syncToScreenAnchor, screen]);

  useEffect(() => {
    if (!voice.sessionActive) return;
    const payload = coachContextPayload(coach);
    if (!payload) return;
    voice.updateCoachPrompt(buildOnboardingCoachPrompt(payload));
  }, [
    coach.currentStep?.id,
    coach.displayQuestion,
    coach.multiCount,
    coach.stepIndex,
    coach.isComplete,
    voice.sessionActive,
    voice.updateCoachPrompt,
  ]);

  const value = useMemo(
    () => ({ coach, voice, showPanel }),
    [coach, voice, showPanel],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
