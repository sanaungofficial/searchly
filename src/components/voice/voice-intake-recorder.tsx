"use client";

import { VoiceOrb } from "@/components/voice/voice-orb";
import {
  useVoiceAgentSession,
  type VoiceAgentSessionResult,
} from "@/hooks/use-voice-agent-session";
import type { VoiceAgentFieldPatch } from "@/lib/voice-intake";

export type { VoiceAgentFieldPatch };
export type VoiceAgentFieldUpdate = VoiceAgentFieldPatch;
export type { VoiceAgentSessionResult };

/** @deprecated use VoiceAgentSessionResult */
export type VoiceIntakeResult = VoiceAgentSessionResult & {
  proposed?: Record<string, unknown>;
  fieldsFound?: string[];
};

interface VoiceIntakeRecorderProps {
  onFieldUpdate?: (patch: VoiceAgentFieldPatch) => void;
  onComplete?: (result: VoiceAgentSessionResult) => void;
  /** @deprecated use onFieldUpdate + onComplete */
  onVoiceIntakeComplete?: (result: VoiceIntakeResult) => void;
  disabled?: boolean;
}

export function VoiceIntakeRecorder({
  onFieldUpdate,
  onComplete,
  onVoiceIntakeComplete,
  disabled,
}: VoiceIntakeRecorderProps) {
  const {
    available,
    agentSettings,
    orbState,
    error,
    summary,
    agentLine,
    audioLevel,
    sessionActive,
    toggleSession,
    resetSession,
  } = useVoiceAgentSession({
    context: "onboarding",
    disabled,
    onFieldUpdate,
    onComplete: (result) => {
      onComplete?.(result);
      onVoiceIntakeComplete?.({
        ...result,
        proposed: {},
        fieldsFound: [],
      });
    },
  });

  if (available === false) {
    return (
      <div className="voice-intake-hero anim-fade-up">
        <VoiceIntakeHeroStyles />
        <div className="voice-intake-hero__panel voice-intake-hero__panel--muted">
          <p className="voice-intake-hero__hint">
            Voice isn&apos;t set up on this environment — use the picks below. On production, tap the orb to talk to
            Kimchi.
          </p>
        </div>
      </div>
    );
  }

  const hint =
    orbState === "idle" || orbState === "error"
      ? "Tap the orb — Kimchi will ask a few quick questions out loud. Prefer typing? Use the picks below anytime."
      : orbState === "done"
        ? undefined
        : orbState === "connecting" || orbState === "thinking"
          ? "Connecting…"
          : sessionActive
            ? "Tap the orb when you're done talking."
            : undefined;

  return (
    <div className="voice-intake-hero anim-fade-up">
      <VoiceIntakeHeroStyles />
      <div className="voice-intake-hero__panel">
        <p className="voice-intake-hero__eyebrow">Talk to Kimchi</p>
        <h3 className="voice-intake-hero__title">Skip the forms — have a quick conversation.</h3>

        <VoiceOrb
          state={orbState}
          audioLevel={audioLevel}
          onClick={toggleSession}
          disabled={disabled || available !== true || !agentSettings}
          label={
            orbState === "idle"
              ? "Tap to talk"
              : orbState === "live"
                ? "Listening"
                : undefined
          }
        />

        {agentLine && orbState !== "idle" && orbState !== "done" && (
          <div className="voice-intake-hero__bubble" aria-live="polite">
            <span className="voice-intake-hero__bubble-label">Kimchi</span>
            <p>{agentLine}</p>
          </div>
        )}

        {hint && <p className="voice-intake-hero__hint">{hint}</p>}

        {orbState === "done" && summary && (
          <div className="voice-intake-hero__success">
            <p>{summary}</p>
            <button type="button" className="voice-intake-hero__again" onClick={resetSession}>
              Talk again
            </button>
          </div>
        )}

        {error && <p className="voice-intake-hero__error">{error}</p>}
      </div>
    </div>
  );
}

function VoiceIntakeHeroStyles() {
  return (
    <style>{`
      .voice-intake-hero { width: 100%; }

      .voice-intake-hero__panel--muted {
        padding: 20px 24px;
        background: rgba(26, 58, 47, 0.04);
        border: 1.5px dashed rgba(26, 58, 47, 0.16);
      }

      .voice-intake-hero__panel {
        position: relative;
        overflow: hidden;
        padding: clamp(28px, 6vw, 44px) clamp(20px, 5vw, 36px);
        background:
          radial-gradient(circle at 20% 0%, rgba(61, 170, 156, 0.12), transparent 42%),
          radial-gradient(circle at 80% 100%, rgba(196, 168, 106, 0.1), transparent 38%),
          linear-gradient(180deg, #eef5f2 0%, #f7f5f2 100%);
        border: 1.5px solid rgba(26, 58, 47, 0.12);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-align: center;
      }

      .voice-intake-hero__panel::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image: radial-gradient(rgba(26, 58, 47, 0.04) 1px, transparent 1px);
        background-size: 18px 18px;
        pointer-events: none;
        opacity: 0.5;
      }

      .voice-intake-hero__eyebrow {
        position: relative;
        margin: 0;
        font-family: var(--font-ui);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(26, 58, 47, 0.55);
      }

      .voice-intake-hero__title {
        position: relative;
        margin: 0 0 12px;
        max-width: 420px;
        font-family: var(--font-display);
        font-size: clamp(20px, 3.2vw, 26px);
        line-height: 1.25;
        color: #1A3A2F;
        font-weight: 600;
      }

      .voice-intake-hero__bubble {
        position: relative;
        margin-top: 8px;
        max-width: 420px;
        padding: 14px 18px;
        background: rgba(15, 36, 28, 0.92);
        border: 1px solid rgba(91, 196, 184, 0.25);
        text-align: left;
      }

      .voice-intake-hero__bubble-label {
        display: block;
        margin-bottom: 6px;
        font-family: var(--font-ui);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(91, 196, 184, 0.85);
      }

      .voice-intake-hero__bubble p {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 15px;
        line-height: 1.55;
        color: rgba(247, 245, 242, 0.92);
      }

      .voice-intake-hero__hint {
        position: relative;
        margin: 4px 0 0;
        max-width: 380px;
        font-family: var(--font-ui);
        font-size: 15px;
        line-height: 1.55;
        color: rgba(26, 58, 47, 0.72);
      }

      .voice-intake-hero__success {
        position: relative;
        margin-top: 8px;
        max-width: 420px;
        padding: 14px 18px;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(26, 58, 47, 0.12);
      }

      .voice-intake-hero__success p {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 15px;
        line-height: 1.5;
        color: #1A3A2F;
      }

      .voice-intake-hero__again {
        margin-top: 12px;
        background: transparent;
        border: none;
        padding: 0;
        font-family: var(--font-ui);
        font-size: 14px;
        color: rgba(26, 58, 47, 0.65);
        cursor: pointer;
        text-decoration: underline;
      }

      .voice-intake-hero__error {
        position: relative;
        margin: 8px 0 0;
        max-width: 380px;
        font-family: var(--font-ui);
        font-size: 14px;
        line-height: 1.5;
        color: #9B3A2A;
      }
    `}</style>
  );
}
