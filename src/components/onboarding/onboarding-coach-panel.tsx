"use client";

import { useEffect, useRef } from "react";
import { VoiceOrb } from "@/components/voice/voice-orb";
import { useOnboardingCoach } from "@/hooks/use-onboarding-coach";
import { useVoiceAgentSession, type VoiceAgentSessionResult } from "@/hooks/use-voice-agent-session";
import type { OnboardingCoachStep } from "@/lib/onboarding-coach/steps";
import type { OnboardingCompanyPick } from "@/lib/onboarding-coach/types";
import type { VoiceAgentFieldPatch } from "@/lib/voice-intake";

type Props = {
  steps: OnboardingCoachStep[];
  onApplyPatch: (patch: VoiceAgentFieldPatch) => void;
  onApplyCompany?: (company: OnboardingCompanyPick) => void;
  getMultiCount?: (field: string) => number;
  onVoiceComplete?: (result: VoiceAgentSessionResult) => void;
  disabled?: boolean;
};

export function OnboardingCoachPanel({
  steps,
  onApplyPatch,
  onApplyCompany,
  getMultiCount,
  onVoiceComplete,
  disabled,
}: Props) {
  const coach = useOnboardingCoach({ steps, onApplyPatch, onApplyCompany, getMultiCount });
  const prevStepIdRef = useRef<string | null>(null);

  const {
    available,
    agentSettings,
    orbState,
    error,
    agentLine,
    audioLevel,
    sessionActive,
    toggleSession,
    endSession,
    resetSession,
  } = useVoiceAgentSession({
    context: "onboarding",
    disabled: disabled || coach.isComplete,
    onboardingCoachQuery: coach.coachQuery,
    onOnboardingPropose: coach.handleVoicePropose,
    onOnboardingConfirm: coach.handleVoiceConfirm,
    onComplete: onVoiceComplete,
  });

  useEffect(() => {
    const stepId = coach.currentStep?.id ?? null;
    if (!stepId || stepId === prevStepIdRef.current) return;
    prevStepIdRef.current = stepId;
    if (sessionActive) resetSession();
  }, [coach.currentStep?.id, resetSession, sessionActive]);

  if (available === false) {
    return (
      <div className="onboarding-coach anim-fade-up">
        <OnboardingCoachStyles />
        <p className="onboarding-coach__unavailable">
          Voice isn&apos;t set up here — use the picks below. On production, you can talk to Kimchi instead.
        </p>
      </div>
    );
  }

  const hint =
    coach.phase === "confirming"
      ? "Say yes to confirm, or tell Kimchi what to change."
      : orbState === "idle" || orbState === "error"
        ? "Optional — tap the orb and answer out loud, or use the picks below."
        : orbState === "connecting" || orbState === "thinking"
          ? "Connecting…"
          : sessionActive
            ? "Just start speaking — Kimchi is listening."
            : undefined;

  const multiMax = coach.currentStep?.multiMax ?? 0;
  const showMultiDone =
    coach.phase !== "confirming" &&
    (coach.currentStep?.kind === "multi_add" || coach.currentStep?.kind === "company") &&
    coach.multiCount > 0 &&
    coach.multiCount < multiMax;

  return (
    <div className="onboarding-coach anim-fade-up">
      <OnboardingCoachStyles />

      <p className="onboarding-coach__eyebrow">Talk it out · optional</p>

      <div className="onboarding-coach__orb-block">
        <VoiceOrb
          variant="hero"
          state={coach.isComplete ? "done" : orbState}
          audioLevel={audioLevel}
          onClick={coach.isComplete ? undefined : toggleSession}
          disabled={disabled || available !== true || !agentSettings || coach.phase === "confirming" || coach.resolving}
          label={
            coach.isComplete
              ? "All set"
              : orbState === "idle"
                ? "Tap to talk"
                : orbState === "live"
                  ? "Listening"
                  : undefined
          }
        />
      </div>

      {coach.isComplete ? (
        <div className="onboarding-coach__complete">
          <p className="onboarding-coach__question">Nice — that covers these questions.</p>
          <p className="onboarding-coach__hint">Keep going with the picks below, or continue when you&apos;re ready.</p>
        </div>
      ) : coach.currentStep ? (
        <>
          <p className="onboarding-coach__progress">
            Question {coach.stepIndex + 1} of {coach.stepTotal}
            {coach.currentStep.optional ? " · optional" : ""}
            {multiMax > 1 && coach.multiCount > 0 ? ` · ${coach.multiCount}/${multiMax} added` : ""}
          </p>
          <h3 className="onboarding-coach__question">{coach.displayQuestion}</h3>
          {coach.currentStep.hint && coach.phase !== "confirming" && (
            <p className="onboarding-coach__hint">{coach.currentStep.hint}</p>
          )}

          {coach.phase === "confirming" && coach.proposed ? (
            <div className="onboarding-coach__confirm">
              <p className="onboarding-coach__confirm-label">
                {coach.currentStep.confirmPrompt ?? "Does this look right?"}
              </p>
              <input
                type="text"
                className="onboarding-coach__confirm-input"
                value={coach.draftText}
                disabled={coach.resolving}
                onChange={(e) => coach.setDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void coach.proposeFromText();
                  }
                }}
              />
              <div className="onboarding-coach__confirm-actions">
                <button
                  type="button"
                  className="onboarding-coach__btn onboarding-coach__btn--primary"
                  disabled={coach.resolving}
                  onClick={() => void coach.confirmProposed()}
                >
                  {coach.resolving ? "Adding…" : "Yes, that's right"}
                </button>
                <button
                  type="button"
                  className="onboarding-coach__btn onboarding-coach__btn--ghost"
                  disabled={coach.resolving}
                  onClick={coach.reviseProposed}
                >
                  Change it
                </button>
              </div>
            </div>
          ) : (
            <div className="onboarding-coach__type-row">
              <input
                type="text"
                className="onboarding-coach__type-input"
                placeholder={coach.currentStep.kind === "company" ? "Or type a company name…" : "Or type your answer…"}
                value={coach.draftText}
                disabled={coach.resolving}
                onChange={(e) => coach.setDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void coach.proposeFromText();
                  }
                }}
              />
              <button
                type="button"
                className="onboarding-coach__btn onboarding-coach__btn--secondary"
                disabled={!coach.draftText.trim() || coach.resolving}
                onClick={() => void coach.proposeFromText()}
              >
                {coach.resolving ? "…" : "Use this"}
              </button>
            </div>
          )}

          {coach.currentStep.options && coach.phase !== "confirming" && (
            <div className="onboarding-coach__quick-picks">
              {coach.currentStep.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="onboarding-coach__quick-pick"
                  onClick={() => coach.proposeFromOption(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {showMultiDone && (
            <button type="button" className="onboarding-coach__skip" onClick={coach.finishMultiStep}>
              Done adding — continue below
            </button>
          )}

          {coach.currentStep.optional && coach.phase !== "confirming" && !showMultiDone && (
            <button type="button" className="onboarding-coach__skip" onClick={coach.skipCurrentStep}>
              Skip this question
            </button>
          )}
        </>
      ) : null}

      {agentLine && sessionActive && coach.phase !== "confirming" && (
        <div className="onboarding-coach__bubble" aria-live="polite">
          <span className="onboarding-coach__bubble-label">Kimchi</span>
          <p>{agentLine}</p>
        </div>
      )}

      {hint && <p className="onboarding-coach__voice-hint">{hint}</p>}

      {sessionActive && coach.phase !== "confirming" && (
        <button type="button" className="onboarding-coach__done-talking" onClick={endSession}>
          Done talking for now
        </button>
      )}

      {error && <p className="onboarding-coach__error">{error}</p>}
    </div>
  );
}

function OnboardingCoachStyles() {
  return (
    <style>{`
      .onboarding-coach {
        width: 100%;
        margin-bottom: 8px;
        padding: clamp(20px, 4vw, 28px) clamp(16px, 4vw, 24px) clamp(22px, 4vw, 28px);
        background:
          radial-gradient(circle at 20% 0%, rgba(61, 170, 156, 0.12), transparent 42%),
          radial-gradient(circle at 80% 100%, rgba(196, 168, 106, 0.1), transparent 38%),
          linear-gradient(180deg, #eef5f2 0%, #f7f5f2 100%);
        border: 1.5px solid rgba(26, 58, 47, 0.12);
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 8px;
      }

      .onboarding-coach__eyebrow {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(26, 58, 47, 0.5);
      }

      .onboarding-coach__orb-block {
        margin: 4px 0 8px;
      }

      .onboarding-coach__orb-block .voice-orb-wrap {
        margin: 0 auto;
      }

      .onboarding-coach__progress {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 12px;
        color: rgba(26, 58, 47, 0.55);
      }

      .onboarding-coach__question {
        margin: 0;
        max-width: 420px;
        font-family: var(--font-display);
        font-size: clamp(18px, 3vw, 22px);
        line-height: 1.3;
        font-weight: 600;
        color: #1A3A2F;
      }

      .onboarding-coach__hint,
      .onboarding-coach__voice-hint,
      .onboarding-coach__unavailable {
        margin: 0;
        max-width: 400px;
        font-family: var(--font-ui);
        font-size: 14px;
        line-height: 1.5;
        color: rgba(26, 58, 47, 0.68);
      }

      .onboarding-coach__type-row {
        display: flex;
        gap: 8px;
        width: 100%;
        max-width: 420px;
        margin-top: 6px;
      }

      .onboarding-coach__type-input,
      .onboarding-coach__confirm-input {
        flex: 1;
        min-width: 0;
        padding: 11px 14px;
        border: 1px solid rgba(26, 58, 47, 0.18);
        border-radius: var(--scout-radius);
        background: rgba(255, 255, 255, 0.85);
        font-family: var(--font-ui);
        font-size: 15px;
        color: #1A3A2F;
      }

      .onboarding-coach__confirm {
        width: 100%;
        max-width: 420px;
        margin-top: 8px;
        padding: 14px;
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(26, 58, 47, 0.12);
        text-align: left;
      }

      .onboarding-coach__confirm-label {
        margin: 0 0 8px;
        font-family: var(--font-ui);
        font-size: 14px;
        font-weight: 600;
        color: #1A3A2F;
      }

      .onboarding-coach__confirm-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }

      .onboarding-coach__btn {
        font-family: var(--font-ui);
        font-size: 14px;
        font-weight: 600;
        padding: 10px 14px;
        border-radius: var(--scout-radius);
        cursor: pointer;
        border: none;
      }

      .onboarding-coach__btn--primary {
        background: #1A3A2F;
        color: #E8D5A3;
      }

      .onboarding-coach__btn--secondary {
        background: rgba(26, 58, 47, 0.1);
        color: #1A3A2F;
        flex-shrink: 0;
      }

      .onboarding-coach__btn--ghost {
        background: transparent;
        color: rgba(26, 58, 47, 0.65);
        text-decoration: underline;
        padding-left: 0;
      }

      .onboarding-coach__btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .onboarding-coach__quick-picks {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
        max-width: 440px;
        margin-top: 4px;
      }

      .onboarding-coach__quick-pick {
        padding: 7px 12px;
        border: 1px solid rgba(26, 58, 47, 0.16);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.72);
        font-family: var(--font-ui);
        font-size: 13px;
        color: #1A3A2F;
        cursor: pointer;
      }

      .onboarding-coach__quick-pick:hover {
        background: rgba(26, 58, 47, 0.06);
      }

      .onboarding-coach__skip {
        margin-top: 2px;
        background: none;
        border: none;
        font-family: var(--font-ui);
        font-size: 13px;
        color: rgba(26, 58, 47, 0.55);
        text-decoration: underline;
        cursor: pointer;
      }

      .onboarding-coach__bubble {
        max-width: 420px;
        width: 100%;
        margin-top: 6px;
        padding: 12px 14px;
        background: rgba(15, 36, 28, 0.92);
        border: 1px solid rgba(91, 196, 184, 0.25);
        text-align: left;
      }

      .onboarding-coach__bubble-label {
        display: block;
        margin-bottom: 4px;
        font-family: var(--font-ui);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(91, 196, 184, 0.85);
      }

      .onboarding-coach__bubble p {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 14px;
        line-height: 1.5;
        color: rgba(247, 245, 242, 0.92);
      }

      .onboarding-coach__done-talking {
        margin-top: 2px;
        background: none;
        border: none;
        font-family: var(--font-ui);
        font-size: 13px;
        color: rgba(26, 58, 47, 0.55);
        text-decoration: underline;
        cursor: pointer;
      }

      .onboarding-coach__error {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 13px;
        color: #9B3A2A;
      }

      .onboarding-coach__complete {
        max-width: 420px;
      }
    `}</style>
  );
}
