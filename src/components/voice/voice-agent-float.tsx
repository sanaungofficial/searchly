"use client";

import { useState } from "react";
import { VoiceOrb } from "@/components/voice/voice-orb";
import { useVoiceAgentSession } from "@/hooks/use-voice-agent-session";
import { useIsMobile } from "@/hooks/use-mobile";

export function VoiceAgentFloat() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

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
  } = useVoiceAgentSession({ context: "workspace" });

  if (available === false) return null;

  const bottom = isMobile ? "max(16px, env(safe-area-inset-bottom))" : "24px";
  const right = isMobile ? "16px" : "24px";

  const closePanel = () => {
    setOpen(false);
    if (sessionActive) resetSession();
  };

  const hint =
    orbState === "idle" || orbState === "error"
      ? "Tap the orb to start talking."
      : orbState === "done"
        ? undefined
        : orbState === "connecting" || orbState === "thinking"
          ? "Connecting…"
          : sessionActive
            ? "Tap the orb when you're done."
            : undefined;

  return (
    <>
      <VoiceAgentFloatStyles />

      {!open && (
        <div
          className="voice-agent-float-launcher"
          style={{ bottom, right }}
        >
          <VoiceOrb
            variant="float"
            state={available === null ? "connecting" : "idle"}
            onClick={() => setOpen(true)}
            disabled={available !== true}
            bounce
          />
        </div>
      )}

      {open && (
        <>
          <button
            type="button"
            className="voice-agent-float-backdrop"
            aria-label="Close voice panel"
            onClick={closePanel}
          />
          <div
            className="voice-agent-float-panel"
            style={{
              bottom: isMobile
                ? `calc(${bottom} + 108px)`
                : `calc(${bottom} + 112px)`,
              right,
            }}
          >
            <div className="voice-agent-float-panel__header">
              <div>
                <p className="voice-agent-float-panel__eyebrow">Talk to Kimchi</p>
                <p className="voice-agent-float-panel__title">Voice coach</p>
              </div>
              <button
                type="button"
                className="voice-agent-float-panel__close"
                onClick={closePanel}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <VoiceOrb
              variant="hero"
              state={orbState}
              audioLevel={audioLevel}
              onClick={toggleSession}
              disabled={available !== true || !agentSettings}
              bounce={orbState === "idle" || orbState === "error"}
              label={
                orbState === "idle"
                  ? "Tap to talk"
                  : orbState === "live"
                    ? "Listening"
                    : undefined
              }
            />

            {agentLine && orbState !== "idle" && orbState !== "done" && (
              <div className="voice-agent-float-panel__bubble" aria-live="polite">
                <span className="voice-agent-float-panel__bubble-label">Kimchi</span>
                <p>{agentLine}</p>
              </div>
            )}

            {hint && <p className="voice-agent-float-panel__hint">{hint}</p>}

            {orbState === "done" && summary && (
              <div className="voice-agent-float-panel__success">
                <p>{summary}</p>
                <button type="button" className="voice-agent-float-panel__again" onClick={resetSession}>
                  Talk again
                </button>
              </div>
            )}

            {error && <p className="voice-agent-float-panel__error">{error}</p>}
          </div>
        </>
      )}
    </>
  );
}

function VoiceAgentFloatStyles() {
  return (
    <style>{`
      .voice-agent-float-launcher {
        position: fixed;
        z-index: 90;
        pointer-events: auto;
        filter: drop-shadow(0 8px 24px rgba(26, 58, 47, 0.28));
      }

      .voice-agent-float-backdrop {
        position: fixed;
        inset: 0;
        z-index: 94;
        border: none;
        padding: 0;
        background: rgba(15, 24, 20, 0.18);
        cursor: pointer;
      }

      .voice-agent-float-panel {
        position: fixed;
        z-index: 95;
        width: min(360px, calc(100vw - 32px));
        max-height: min(520px, calc(100vh - 180px));
        overflow-y: auto;
        padding: 20px 20px 24px;
        background:
          radial-gradient(circle at 20% 0%, rgba(61, 170, 156, 0.14), transparent 42%),
          radial-gradient(circle at 80% 100%, rgba(196, 168, 106, 0.1), transparent 38%),
          linear-gradient(180deg, #eef5f2 0%, #f7f5f2 100%);
        border: 1.5px solid rgba(26, 58, 47, 0.12);
        box-shadow: 0 20px 60px rgba(26, 58, 47, 0.22);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-align: center;
      }

      .voice-agent-float-panel__header {
        width: 100%;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 4px;
        text-align: left;
      }

      .voice-agent-float-panel__eyebrow {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(26, 58, 47, 0.55);
      }

      .voice-agent-float-panel__title {
        margin: 4px 0 0;
        font-family: var(--font-display);
        font-size: 20px;
        line-height: 1.2;
        color: #1A3A2F;
        font-weight: 600;
      }

      .voice-agent-float-panel__close {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border: 1px solid rgba(26, 58, 47, 0.12);
        background: rgba(255, 255, 255, 0.7);
        color: #1A3A2F;
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
      }

      .voice-agent-float-panel .voice-orb-wrap {
        margin-top: 4px;
      }

      .voice-agent-float-panel .voice-orb-rings {
        width: min(180px, 52vw);
        height: min(180px, 52vw);
      }

      .voice-agent-float-panel__bubble {
        margin-top: 8px;
        width: 100%;
        padding: 12px 14px;
        background: rgba(15, 36, 28, 0.92);
        border: 1px solid rgba(91, 196, 184, 0.25);
        text-align: left;
      }

      .voice-agent-float-panel__bubble-label {
        display: block;
        margin-bottom: 6px;
        font-family: var(--font-ui);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(91, 196, 184, 0.85);
      }

      .voice-agent-float-panel__bubble p {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 14px;
        line-height: 1.55;
        color: rgba(247, 245, 242, 0.92);
      }

      .voice-agent-float-panel__hint {
        margin: 4px 0 0;
        font-family: var(--font-ui);
        font-size: 14px;
        line-height: 1.5;
        color: rgba(26, 58, 47, 0.72);
      }

      .voice-agent-float-panel__success {
        margin-top: 8px;
        width: 100%;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(26, 58, 47, 0.12);
      }

      .voice-agent-float-panel__success p {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 14px;
        line-height: 1.5;
        color: #1A3A2F;
      }

      .voice-agent-float-panel__again {
        margin-top: 10px;
        background: transparent;
        border: none;
        padding: 0;
        font-family: var(--font-ui);
        font-size: 13px;
        color: rgba(26, 58, 47, 0.65);
        cursor: pointer;
        text-decoration: underline;
      }

      .voice-agent-float-panel__error {
        margin: 8px 0 0;
        font-family: var(--font-ui);
        font-size: 13px;
        line-height: 1.5;
        color: #9B3A2A;
      }
    `}</style>
  );
}
