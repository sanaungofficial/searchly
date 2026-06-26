"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { ChatWidget } from "@/components/scout/chat-widget";
import { VoiceOrb } from "@/components/voice/voice-orb";
import { useVoiceAgentSession } from "@/hooks/use-voice-agent-session";
import { useIsMobile } from "@/hooks/use-mobile";

const ORB_SIZE = 100;

type AssistantTab = "voice" | "scout";

function launcherBottom(isMobile: boolean): string {
  return isMobile ? "max(16px, env(safe-area-inset-bottom))" : "24px";
}

export function KimchiAssistant() {
  const isMobile = useIsMobile();
  const { chatOpen, setChatOpen, setChatView, chatPulse } = useWorkspace();
  const [panelOpen, setPanelOpen] = useState(false);
  const [mainTab, setMainTab] = useState<AssistantTab>("voice");
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
    if (chatOpen) {
      setPanelOpen(true);
      setMainTab("scout");
    }
  }, [chatOpen]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [transcriptLines, orbState]);

  if (available === false) {
    return <ChatWidget hideLauncher={false} />;
  }

  const right = isMobile ? "16px" : "24px";
  const bottom = launcherBottom(isMobile);
  const panelBottom = isMobile
    ? `calc(${bottom} + ${ORB_SIZE + 16}px)`
    : `calc(${bottom} + ${ORB_SIZE + 20}px)`;

  const closePanel = () => {
    setPanelOpen(false);
    setChatOpen(false);
    if (sessionActive) resetSession();
  };

  const openPanel = (tab: AssistantTab = "voice") => {
    setPanelOpen(true);
    setMainTab(tab);
    if (tab === "scout") {
      setChatOpen(true);
      setChatView((view) => (view === "chat" || view === "coach" || view === "coach-prep" ? view : "tools"));
    } else {
      setChatOpen(false);
    }
  };

  const selectTab = (tab: AssistantTab) => {
    setMainTab(tab);
    if (tab === "scout") {
      setChatOpen(true);
      setChatView((view) => (view === "chat" || view === "coach" || view === "coach-prep" ? view : "tools"));
    } else {
      setChatOpen(false);
    }
  };

  const hint =
    orbState === "idle" || orbState === "error"
      ? "Tap the orb to talk, or switch to Text for Scout tools and fit chat."
      : orbState === "done"
        ? undefined
        : orbState === "connecting" || orbState === "thinking"
          ? "Connecting…"
          : sessionActive
            ? "Tap the orb when you're done."
            : undefined;

  return (
    <>
      <KimchiAssistantStyles />

      {!panelOpen && (
        <div
          className="kimchi-assistant-launcher"
          style={{
            bottom,
            right,
            animation: chatPulse ? "kimchiOrbPulse 1.2s ease-in-out 2" : undefined,
          }}
        >
          <VoiceOrb
            variant="float"
            state={available === null ? "connecting" : "idle"}
            onClick={() => openPanel("voice")}
            disabled={available !== true}
            bounce
          />
        </div>
      )}

      {panelOpen && (
        <>
          <button type="button" className="kimchi-assistant-backdrop" aria-label="Close Kimchi" onClick={closePanel} />
          <div className="kimchi-assistant-panel" style={{ bottom: panelBottom, right }}>
            <div className="kimchi-assistant-panel__topbar">
              <div className="kimchi-assistant-panel__brand">
                <span className="kimchi-assistant-panel__star">✦</span>
                <span className="kimchi-assistant-panel__name">Kimchi</span>
              </div>
              <div className="kimchi-assistant-panel__tabs">
                <button
                  type="button"
                  className={mainTab === "voice" ? "kimchi-assistant-tab kimchi-assistant-tab--active" : "kimchi-assistant-tab"}
                  onClick={() => selectTab("voice")}
                >
                  Voice
                </button>
                <button
                  type="button"
                  className={mainTab === "scout" ? "kimchi-assistant-tab kimchi-assistant-tab--active" : "kimchi-assistant-tab"}
                  onClick={() => selectTab("scout")}
                >
                  Text
                </button>
              </div>
              <button type="button" className="kimchi-assistant-panel__close" onClick={closePanel} aria-label="Close">
                ×
              </button>
            </div>

            {mainTab === "voice" ? (
              <>
                <div ref={transcriptRef} className="kimchi-assistant-panel__transcript" aria-live="polite">
                  {transcriptLines.length === 0 ? (
                    <p className="kimchi-assistant-panel__transcript-empty">
                      Your conversation shows up here as you talk — both what you say and what Kimchi replies.
                    </p>
                  ) : (
                    transcriptLines.map((line, index) => (
                      <div
                        key={`${line.role}-${index}-${line.content.slice(0, 24)}`}
                        className={[
                          "kimchi-assistant-panel__line",
                          line.role === "Kimchi"
                            ? "kimchi-assistant-panel__line--agent"
                            : "kimchi-assistant-panel__line--user",
                        ].join(" ")}
                      >
                        <span className="kimchi-assistant-panel__line-label">{line.role}</span>
                        <p>{line.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="kimchi-assistant-panel__controls">
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

                  {hint && <p className="kimchi-assistant-panel__hint">{hint}</p>}

                  {orbState === "done" && summary && (
                    <div className="kimchi-assistant-panel__success">
                      <p>{summary}</p>
                      <button type="button" className="kimchi-assistant-panel__again" onClick={resetSession}>
                        Talk again
                      </button>
                    </div>
                  )}

                  {error && <p className="kimchi-assistant-panel__error">{error}</p>}
                </div>
              </>
            ) : (
              <ChatWidget embedded hideLauncher />
            )}
          </div>

          <div
            className="kimchi-assistant-launcher kimchi-assistant-launcher--open"
            style={{ bottom, right }}
          >
            <VoiceOrb
              variant="float"
              state={mainTab === "voice" ? orbState : "idle"}
              audioLevel={mainTab === "voice" ? audioLevel : 0}
              onClick={() => {
                if (mainTab !== "voice") selectTab("voice");
                else toggleSession();
              }}
              disabled={available !== true || !agentSettings}
              bounce={
                mainTab === "voice" &&
                (orbState === "idle" || orbState === "error" || orbState === "done")
              }
            />
          </div>
        </>
      )}
    </>
  );
}

function KimchiAssistantStyles() {
  return (
    <style>{`
      .kimchi-assistant-launcher {
        position: fixed;
        z-index: 91;
        pointer-events: auto;
        filter: drop-shadow(0 8px 24px rgba(26, 58, 47, 0.28));
      }

      .kimchi-assistant-launcher--open {
        z-index: 96;
      }

      @keyframes kimchiOrbPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.06); }
      }

      .kimchi-assistant-backdrop {
        position: fixed;
        inset: 0;
        z-index: 94;
        border: none;
        padding: 0;
        background: rgba(15, 24, 20, 0.18);
        cursor: pointer;
      }

      .kimchi-assistant-panel {
        position: fixed;
        z-index: 95;
        width: min(420px, calc(100vw - 32px));
        height: min(640px, calc(100vh - 180px));
        overflow: hidden;
        background: #FFFFFF;
        border: 1.5px solid rgba(26, 58, 47, 0.12);
        box-shadow: 0 20px 60px rgba(26, 58, 47, 0.22);
        display: flex;
        flex-direction: column;
      }

      .kimchi-assistant-panel__topbar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        background: #1A3A2F;
        flex-shrink: 0;
      }

      .kimchi-assistant-panel__brand {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .kimchi-assistant-panel__star {
        color: #E8D5A3;
        font-size: 14px;
        line-height: 1;
      }

      .kimchi-assistant-panel__name {
        font-family: var(--font-ui);
        font-size: 13px;
        font-weight: 600;
        color: #E8D5A3;
      }

      .kimchi-assistant-panel__tabs {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-left: auto;
      }

      .kimchi-assistant-tab {
        border: 1px solid rgba(232, 213, 163, 0.18);
        background: transparent;
        color: rgba(232, 213, 163, 0.72);
        font-family: var(--font-ui);
        font-size: 12px;
        font-weight: 600;
        padding: 5px 10px;
        cursor: pointer;
      }

      .kimchi-assistant-tab--active {
        background: rgba(232, 213, 163, 0.14);
        color: #E8D5A3;
        border-color: rgba(232, 213, 163, 0.28);
      }

      .kimchi-assistant-panel__close {
        flex-shrink: 0;
        width: 30px;
        height: 30px;
        border: 1px solid rgba(232, 213, 163, 0.18);
        background: transparent;
        color: rgba(232, 213, 163, 0.72);
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
      }

      .kimchi-assistant-panel__transcript {
        flex: 1;
        min-height: 180px;
        overflow-y: auto;
        margin: 12px 16px 0;
        padding: 14px;
        background: rgba(247, 245, 242, 0.9);
        border: 1px solid rgba(26, 58, 47, 0.1);
        text-align: left;
      }

      .kimchi-assistant-panel__transcript-empty {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 15px;
        line-height: 1.6;
        color: rgba(26, 58, 47, 0.58);
      }

      .kimchi-assistant-panel__line {
        margin-bottom: 12px;
      }

      .kimchi-assistant-panel__line:last-child {
        margin-bottom: 0;
      }

      .kimchi-assistant-panel__line-label {
        display: block;
        margin-bottom: 4px;
        font-family: var(--font-ui);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .kimchi-assistant-panel__line--agent .kimchi-assistant-panel__line-label {
        color: rgba(61, 170, 156, 0.9);
      }

      .kimchi-assistant-panel__line--user .kimchi-assistant-panel__line-label {
        color: rgba(26, 58, 47, 0.55);
      }

      .kimchi-assistant-panel__line p {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 15px;
        line-height: 1.6;
        color: #1A3A2F;
      }

      .kimchi-assistant-panel__controls {
        flex-shrink: 0;
        padding: 12px 16px 18px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-align: center;
        border-top: 1px solid rgba(26, 58, 47, 0.08);
        background:
          radial-gradient(circle at 20% 0%, rgba(61, 170, 156, 0.1), transparent 42%),
          linear-gradient(180deg, #eef5f2 0%, #f7f5f2 100%);
      }

      .kimchi-assistant-panel__controls .voice-orb-wrap {
        margin-top: 0;
      }

      .kimchi-assistant-panel__controls .voice-orb-rings {
        width: 132px;
        height: 132px;
      }

      .kimchi-assistant-panel__hint {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 14px;
        line-height: 1.5;
        color: rgba(26, 58, 47, 0.72);
      }

      .kimchi-assistant-panel__success {
        width: 100%;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(26, 58, 47, 0.12);
      }

      .kimchi-assistant-panel__success p {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 14px;
        line-height: 1.5;
        color: #1A3A2F;
      }

      .kimchi-assistant-panel__again {
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

      .kimchi-assistant-panel__error {
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

/** @deprecated use KimchiAssistant */
export const VoiceAgentFloat = KimchiAssistant;
