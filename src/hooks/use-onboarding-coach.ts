"use client";

import { useCallback, useMemo, useState } from "react";
import {
  coachStepByField,
  labelForCoachValue,
  type OnboardingCoachStep,
} from "@/lib/onboarding-coach/steps";
import { applyVoiceAgentField, type VoiceAgentFieldPatch } from "@/lib/voice-intake";

export type OnboardingCoachPhase = "ready" | "confirming" | "complete";

export type OnboardingCoachProposed = {
  field: string;
  raw: string;
  display: string;
};

type UseOnboardingCoachOptions = {
  steps: OnboardingCoachStep[];
  onApplyPatch: (patch: VoiceAgentFieldPatch) => void;
  onTranscriptComplete?: (transcript: string) => void;
};

export function useOnboardingCoach({ steps, onApplyPatch, onTranscriptComplete }: UseOnboardingCoachOptions) {
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<OnboardingCoachPhase>("ready");
  const [proposed, setProposed] = useState<OnboardingCoachProposed | null>(null);
  const [draftText, setDraftText] = useState("");

  const currentStep = steps[stepIndex] ?? null;
  const isComplete = stepIndex >= steps.length;

  const advanceStep = useCallback(() => {
    setProposed(null);
    setDraftText("");
    setPhase("ready");
    setStepIndex((i) => i + 1);
  }, []);

  const proposeRaw = useCallback(
    (field: string, rawValue: string) => {
      const value = rawValue.trim();
      if (!value) return;

      const step = coachStepByField(steps, field) ?? currentStep;
      if (!step || step.field !== field) return;

      setProposed({
        field,
        raw: value,
        display: labelForCoachValue(step, value),
      });
      setDraftText(labelForCoachValue(step, value));
      setPhase("confirming");
    },
    [currentStep, steps],
  );

  const proposeFromText = useCallback(() => {
    if (!currentStep || !draftText.trim()) return;
    const patch = applyVoiceAgentField(currentStep.field, draftText.trim());
    const normalized =
      (patch[currentStep.field as keyof VoiceAgentFieldPatch] as string | undefined) ??
      draftText.trim();
    proposeRaw(currentStep.field, String(normalized));
  }, [currentStep, draftText, proposeRaw]);

  const proposeFromOption = useCallback(
    (value: string) => {
      if (!currentStep) return;
      proposeRaw(currentStep.field, value);
    },
    [currentStep, proposeRaw],
  );

  const confirmProposed = useCallback(() => {
    const field = proposed?.field ?? currentStep?.field;
    if (!field) return;
    const rawInput = draftText.trim() || proposed?.raw || "";
    if (!rawInput) return;
    const patch = applyVoiceAgentField(
      field as Parameters<typeof applyVoiceAgentField>[0],
      rawInput,
    );
    if (Object.keys(patch).length) onApplyPatch(patch);
    advanceStep();
  }, [advanceStep, currentStep, draftText, onApplyPatch, proposed]);

  const reviseProposed = useCallback(() => {
    setPhase("ready");
    setProposed(null);
  }, []);

  const skipCurrentStep = useCallback(() => {
    if (!currentStep?.optional) return;
    advanceStep();
  }, [advanceStep, currentStep]);

  const handleVoicePropose = useCallback(
    (field: string, value: string) => {
      proposeRaw(field, value);
    },
    [proposeRaw],
  );

  const handleVoiceConfirm = useCallback(
    (field: string) => {
      if (proposed?.field === field) {
        confirmProposed();
        return;
      }
      if (currentStep?.field === field && phase === "confirming") {
        confirmProposed();
      }
    },
    [confirmProposed, currentStep, phase, proposed],
  );

  const coachQuery = useMemo(() => {
    if (!currentStep) return "";
    const params = new URLSearchParams();
    params.set("coachStep", currentStep.id);
    params.set("coachField", currentStep.field);
    params.set("coachQuestion", currentStep.question);
    if (currentStep.hint) params.set("coachHint", currentStep.hint);
    params.set("coachIndex", String(stepIndex));
    params.set("coachTotal", String(steps.length));
    return `&${params.toString()}`;
  }, [currentStep, stepIndex, steps.length]);

  return {
    currentStep,
    stepIndex,
    stepTotal: steps.length,
    phase,
    proposed,
    draftText,
    setDraftText,
    isComplete,
    coachQuery,
    proposeFromText,
    proposeFromOption,
    confirmProposed,
    reviseProposed,
    skipCurrentStep,
    handleVoicePropose,
    handleVoiceConfirm,
    onTranscriptComplete,
  };
}
