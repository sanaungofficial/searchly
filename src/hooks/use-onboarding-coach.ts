"use client";

import { useCallback, useMemo, useState } from "react";
import {
  activeCoachQuestion,
  coachStepByField,
  labelForCoachValue,
  type OnboardingCoachStep,
} from "@/lib/onboarding-coach/steps";
import type { OnboardingCompanyPick } from "@/lib/onboarding-coach/types";
import { resolveCompanyByName } from "@/lib/onboarding-coach/resolve-company";
import { applyVoiceAgentField, type VoiceAgentFieldPatch } from "@/lib/voice-intake";

export type OnboardingCoachPhase = "ready" | "confirming" | "complete";

export type OnboardingCoachProposed = {
  field: string;
  raw: string;
  display: string;
  companyPick?: OnboardingCompanyPick | null;
};

type UseOnboardingCoachOptions = {
  steps: OnboardingCoachStep[];
  onApplyPatch: (patch: VoiceAgentFieldPatch) => void;
  onApplyCompany?: (company: OnboardingCompanyPick) => void;
  getMultiCount?: (field: string) => number;
  onTranscriptComplete?: (transcript: string) => void;
};

export function useOnboardingCoach({
  steps,
  onApplyPatch,
  onApplyCompany,
  getMultiCount,
  onTranscriptComplete,
}: UseOnboardingCoachOptions) {
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<OnboardingCoachPhase>("ready");
  const [proposed, setProposed] = useState<OnboardingCoachProposed | null>(null);
  const [draftText, setDraftText] = useState("");
  const [resolving, setResolving] = useState(false);

  const currentStep = steps[stepIndex] ?? null;
  const isComplete = stepIndex >= steps.length;

  const multiCount = currentStep ? (getMultiCount?.(currentStep.field) ?? 0) : 0;
  const displayQuestion = currentStep ? activeCoachQuestion(currentStep, multiCount) : "";

  const resetProposing = useCallback(() => {
    setProposed(null);
    setDraftText("");
    setPhase("ready");
  }, []);

  const advanceStep = useCallback(() => {
    resetProposing();
    setStepIndex((i) => i + 1);
  }, [resetProposing]);

  const maybeStayOnMultiStep = useCallback(
    (step: OnboardingCoachStep) => {
      const max = step.multiMax ?? 1;
      const count = getMultiCount?.(step.field) ?? 0;
      if (step.kind === "multi_add" && count > 0 && count < max) {
        resetProposing();
        return true;
      }
      if (step.kind === "company" && count > 0 && count < max) {
        resetProposing();
        return true;
      }
      advanceStep();
      return false;
    },
    [advanceStep, getMultiCount, resetProposing],
  );

  const proposeRaw = useCallback(
    (field: string, rawValue: string, displayOverride?: string) => {
      const value = rawValue.trim();
      if (!value) return;

      const step = coachStepByField(steps, field) ?? currentStep;
      if (!step || step.field !== field) return;

      setProposed({
        field,
        raw: value,
        display: displayOverride ?? labelForCoachValue(step, value),
      });
      setDraftText(displayOverride ?? labelForCoachValue(step, value));
      setPhase("confirming");
    },
    [currentStep, steps],
  );

  const proposeFromText = useCallback(async () => {
    if (!currentStep || !draftText.trim()) return;

    if (currentStep.kind === "company") {
      setResolving(true);
      try {
        const pick = await resolveCompanyByName(draftText.trim());
        if (!pick) {
          proposeRaw("company", draftText.trim());
          return;
        }
        setProposed({
          field: "company",
          raw: pick.name,
          display: pick.name,
          companyPick: pick,
        });
        setDraftText(pick.name);
        setPhase("confirming");
      } finally {
        setResolving(false);
      }
      return;
    }

    if (currentStep.field === "targetRoles" || currentStep.field === "priorities") {
      proposeRaw(currentStep.field, draftText.trim());
      return;
    }

    const patch = applyVoiceAgentField(
      currentStep.field as Parameters<typeof applyVoiceAgentField>[0],
      draftText.trim(),
    );
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

  const confirmProposed = useCallback(async () => {
    const step = currentStep;
    const field = proposed?.field ?? step?.field;
    if (!step || !field) return;

    const rawInput = draftText.trim() || proposed?.raw || "";
    if (!rawInput) return;

    if (step.kind === "company") {
      setResolving(true);
      try {
        const pick = proposed?.companyPick ?? (await resolveCompanyByName(rawInput));
        if (!pick) return;
        onApplyCompany?.(pick);
        maybeStayOnMultiStep(step);
      } finally {
        setResolving(false);
      }
      return;
    }

    const patch = applyVoiceAgentField(
      field as Parameters<typeof applyVoiceAgentField>[0],
      rawInput,
    );
    if (Object.keys(patch).length) onApplyPatch(patch);
    maybeStayOnMultiStep(step);
  }, [
    currentStep,
    draftText,
    maybeStayOnMultiStep,
    onApplyCompany,
    onApplyPatch,
    proposed,
  ]);

  const reviseProposed = useCallback(() => {
    resetProposing();
  }, [resetProposing]);

  const skipCurrentStep = useCallback(() => {
    if (!currentStep?.optional) return;
    advanceStep();
  }, [advanceStep, currentStep]);

  const syncToScreenAnchor = useCallback((anchor: number) => {
    setStepIndex((i) => (i < anchor ? anchor : i));
  }, []);

  const finishMultiStep = useCallback(() => {
    if (!currentStep) return;
    advanceStep();
  }, [advanceStep, currentStep]);

  const handleVoicePropose = useCallback(
    (field: string, value: string) => {
      if (field === "company") {
        void (async () => {
          const pick = await resolveCompanyByName(value);
          proposeRaw("company", pick?.name ?? value, pick?.name ?? value);
          if (pick) {
            setProposed((prev) =>
              prev ? { ...prev, companyPick: pick } : { field: "company", raw: value, display: pick.name, companyPick: pick },
            );
          }
        })();
        return;
      }
      proposeRaw(field, value);
    },
    [proposeRaw],
  );

  const handleVoiceConfirm = useCallback(
    (field: string) => {
      if (proposed?.field === field || currentStep?.field === field) {
        void confirmProposed();
      }
    },
    [confirmProposed, currentStep, proposed],
  );

  const coachQuery = useMemo(() => {
    if (!currentStep) return "";
    const params = new URLSearchParams();
    params.set("coachStep", currentStep.id);
    params.set("coachField", currentStep.field);
    params.set("coachQuestion", displayQuestion);
    params.set("coachKind", currentStep.kind ?? "field");
    if (currentStep.hint) params.set("coachHint", currentStep.hint);
    if (currentStep.multiMax) params.set("coachMultiMax", String(currentStep.multiMax));
    params.set("coachMultiCount", String(multiCount));
    params.set("coachIndex", String(stepIndex));
    params.set("coachTotal", String(steps.length));
    return `&${params.toString()}`;
  }, [currentStep, displayQuestion, multiCount, stepIndex, steps.length]);

  return {
    currentStep,
    displayQuestion,
    multiCount,
    stepIndex,
    stepTotal: steps.length,
    phase,
    proposed,
    draftText,
    setDraftText,
    isComplete,
    resolving,
    coachQuery,
    proposeFromText,
    proposeFromOption,
    confirmProposed,
    reviseProposed,
    skipCurrentStep,
    syncToScreenAnchor,
    finishMultiStep,
    handleVoicePropose,
    handleVoiceConfirm,
    onTranscriptComplete,
  };
}
