"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { VoiceOrb } from "@/components/voice/voice-orb";
import { useVoiceAgentSession } from "@/hooks/use-voice-agent-session";
import { useIsMobile } from "@/hooks/use-mobile";

const SCOUT_LAUNCHER_SIZE = 52;
const SCOUT_LAUNCHER_GAP = 12;
const ORB_SIZE = 100;

function scoutLauncherBottom(isMobile: boolean): string {
  return isMobile ? "max(16px, env(safe-area-inset-bottom))" : "24px";
}

function orbLauncherBottom(isMobile: boolean): string {
  const scoutBottom = scoutLauncherBottom(isMobile);
  const stack = SCOUT_LAUNCHER_SIZE + SCOUT_LAUNCHER_GAP;
  return isMobile
    ? `calc(${scoutBottom} + ${stack}px)`
    : `calc(${scoutBottom} + ${stack}px)`;
}

export function VoiceAgentFloat() {
  const isMobile = useIsMobile();
  const { setChatOpen } = useWorkspace();
  const [open, setOpen] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const {
    available,
    agentSettings,
    orbState,
    error,
    summary,
    transcriptLines,
    audioLevel,
    sessionActive,
    toggleSession,
    resetSession,
  } = useVoiceAgentSession({ context: "workspace" });

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [transcriptLines, orbState]);

  if (available === false) return null;

  const right = isMobile ? "16px" : "24px";
  const orbBottom = orbLauncherBottom(isMobile);
  const panelBottom = isMobile
    ? `calc(${orbBottom} + ${ORB_SIZE + 16}px)`
    : `calc(${orbBottom} + ${ORB_SIZE + 20}px)`;

  const closePanel = () => {
    setOpen(false);
    if (sessionActive) resetSession();
  };

  const openScoutChat = () => {
    closePanel();
    setChatOpen(true);
  };

  const hint =
    orbState === "idle" || orbState === "error"
      ? "Tap the orb to start talking. You can also use text chat anytime."
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
        <div className="voice-agent-float-launcher" style={{ bottom: orbBottom, right }}>
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
              bottom: panelBottom,
              right,
            }}
          >
            <div className="voice-agent-float-panel__header">
              <div>
                <p className="voice-agent-float-panel__eyebrow">Talk to Kimchi</p>
                <p className="voice-agent-float-panel__title">Voice coach</p>
              </div>
              <div className="voice-agent-float-panel__header-actions">
                <button type="button" className="voice-agent-float-panel__text-chat" onClick={openScoutChat}>
                  Text chat
                </button>
                <button
                  type="button"
                  className="voice-agent-float-panel__close"
                  onClick={closePanel}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <div ref={transcriptRef} className="voice-agent-float-panel__transcript" aria-live="polite">
              {transcriptLines.length === 0 ? (
                <p className="voice-agent-float-panel__transcript-empty">
                  Your conversation will show up here as you talk — both what you say and what Kimchi replies.
                </p>
              ) : (
                transcriptLines.map((line, index) => (
                  <div
                    key={`${line.role}-${index}-${line.content.slice(0, 24)}`}
                    className={[
                      "voice-agent-float-panel__line",
                      line.role === "Kimchi"
                        ? "voice-agent-float-panel__line--agent"
                        : "voice-agent-float-panel__line--user",
                    ].join(" ")}
                  >
                    <span className="voice-agent-float-panel__line-label">{line.role}</span>
                    <p>{line.content}</p>
                  </div>
                ))
              )}
            </div>

            <div className="voice-agent-float-panel__controls">
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
          </div>

          <div className="voice-agent-float-launcher" style={{ bottom: orbBottom, right }}>
            <VoiceOrb
              variant="float"
              state={orbState}
              audioLevel={audioLevel}
              onClick={toggleSession}
              disabled={available !== true || !agentSettings}
              bounce={orbState === "idle" || orbState === "error" || orbState === "done"}
            />
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
        z-index: 91;
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
        width: min(420px, calc(100vw - 32px));
        height: min(640px, calc(100vh - 220px));
        overflow: hidden;
        background:
          radial-gradient(circle at 20% 0%, rgba(61, 170, 156, 0.14), transparent 42%),
          radial-gradient(circle at 80% 100%, rgba(196, 168, 106, 0.1), transparent 38%),
          linear-gradient(180deg, #eef5f2 0%, #f7f5f2 100%);
        border: 1.5px solid rgba(26, 58, 47, 0.12);
        box-shadow: 0 20px 60px rgba(26, 58, 47, 0.22);
        display: flex;
        flex-direction: column;
      }

      .voice-agent-float-panel__header {
        width: 100%;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 18px 12px;
        text-align: left;
        flex-shrink: 0;
      }

      .voice-agent-float-panel__header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
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

      .voice-agent-float-panel__text-chat {
        border: 1px solid rgba(26, 58, 47, 0.14);
        background: rgba(255, 255, 255, 0.82);
        color: #1A3A2F;
        font-family: var(--font-ui);
        font-size: 12px;
        font-weight: 600;
        padding: 6px 10px;
        cursor: pointer;
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

      .voice-agent-float-panel__transcript {
        flex: 1;
        min-height: 220px;
        overflow-y: auto;
        margin: 0 16px;
        padding: 14px;
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(26, 58, 47, 0.1);
        text-align: left;
      }

      .voice-agent-float-panel__transcript-empty {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 15px;
        line-height: 1.6;
        color: rgba(26, 58, 47, 0.58);
      }

      .voice-agent-float-panel__line {
        margin-bottom: 12px;
      }

      .voice-agent-float-panel__line:last-child {
        margin-bottom: 0;
      }

      .voice-agent-float-panel__line-label {
        display: block;
        margin-bottom: 4px;
        font-family: var(--font-ui);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .voice-agent-float-panel__line--agent .voice-agent-float-panel__line-label {
        color: rgba(61, 170, 156, 0.9);
      }

      .voice-agent-float-panel__line--user .voice-agent-float-panel__line-label {
        color: rgba(26, 58, 47, 0.55);
      }

      .voice-agent-float-panel__line p {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 15px;
        line-height: 1.6;
        color: #1A3A2F;
      }

      .voice-agent-float-panel__line--agent p {
        color: rgba(15, 36, 28, 0.92);
      }

      .voice-agent-float-panel__controls {
        flex-shrink: 0;
        padding: 12px 16px 18px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-align: center;
        border-top: 1px solid rgba(26, 58, 47, 0.08);
        background: rgba(255, 255, 255, 0.35);
      }

      .voice-agent-float-panel__controls .voice-orb-wrap {
        margin-top: 0;
      }

      .voice-agent-float-panel__controls .voice-orb-rings {
        width: 132px;
        height: 132px;
      }

      .voice-agent-float-panel__hint {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 14px;
        line-height: 1.5;
        color: rgba(26, 58, 47, 0.72);
      }

      .voice-agent-float-panel__success {
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
        margin: 0;
        width: 100%;
        font-family: var(--font-ui);
        font-size: 13px;
        line-height: 1.5;
        color: #9B3A2A;
      }
    `}</style>
  );
}
