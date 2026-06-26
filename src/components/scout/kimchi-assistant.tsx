"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { KimchiChatPanel } from "@/components/scout/kimchi-chat-panel";
import { VoiceOrb } from "@/components/voice/voice-orb";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKimchiThreads } from "@/hooks/use-kimchi-threads";
import type { AssistantPageHint } from "@/lib/kimchi-assistant/types";
import { fontSans } from "@/lib/typography";

const sans = fontSans;
const DRAWER_WIDTH = "min(560px, calc(100vw - 16px))";

function launcherBottom(isMobile: boolean): string {
  return isMobile ? "max(16px, env(safe-area-inset-bottom))" : "24px";
}

export function KimchiAssistant() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { chatOpen, setChatOpen, chatPulse, kanbanCards, drawerCardId, chatView } = useWorkspace();
  const [panelOpen, setPanelOpen] = useState(false);
  const [voiceConfigured, setVoiceConfigured] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  const threads = useKimchiThreads();

  const pageHint = useMemo((): AssistantPageHint => {
    const drawerJob =
      drawerCardId !== null ? kanbanCards.find((c) => c.id === drawerCardId) : undefined;
    const ext = drawerJob as (typeof kanbanCards[number] & { _dbId?: string }) | undefined;
    return {
      pathname: pathname ?? undefined,
      chatView,
      jobDbId: ext?._dbId,
      jobRole: drawerJob?.role,
      jobCompany: drawerJob?.company,
    };
  }, [pathname, drawerCardId, kanbanCards, chatView]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    void fetch("/api/voice/agent/config?context=workspace", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setVoiceConfigured(!!d?.agentAvailable))
      .catch(() => setVoiceConfigured(false));
  }, []);

  useEffect(() => {
    if (chatOpen) setPanelOpen(true);
  }, [chatOpen]);

  useEffect(() => {
    if (panelOpen) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [panelOpen]);

  const bottom = launcherBottom(isMobile);
  const right = isMobile ? "16px" : "24px";

  const closePanel = () => {
    setVisible(false);
    window.setTimeout(() => {
      setPanelOpen(false);
      setChatOpen(false);
    }, 280);
  };

  const openPanel = () => {
    setPanelOpen(true);
    setChatOpen(true);
  };

  const activeTitle =
    threads.threads.find((t) => t.id === threads.activeThreadId)?.title ?? "Kimchi";
  const displayTitle =
    activeTitle === "New chat" ? "Kimchi" : activeTitle;

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
          <VoiceOrb variant="float" state="idle" onClick={openPanel} bounce />
        </div>
      )}

      {mounted &&
        panelOpen &&
        createPortal(
          <>
            <div
              className="kimchi-drawer-backdrop"
              style={{ opacity: visible ? 1 : 0 }}
              onClick={closePanel}
              aria-hidden
            />
            <div
              className="kimchi-drawer"
              style={{
                width: DRAWER_WIDTH,
                transform: visible ? "translateX(0)" : "translateX(100%)",
              }}
              role="dialog"
              aria-label="Kimchi assistant"
            >
              <div className="kimchi-drawer__topbar">
                <div className="kimchi-drawer__topbar-left">
                  <span className="kimchi-drawer__star">✦</span>
                  <button
                    type="button"
                    className="kimchi-drawer__thread-btn"
                    onClick={() => threads.setThreadMenuOpen((v) => !v)}
                    aria-expanded={threads.threadMenuOpen}
                  >
                    <span className="kimchi-drawer__name">{displayTitle}</span>
                    <span className="kimchi-drawer__chev">▾</span>
                  </button>
                </div>
                <div className="kimchi-drawer__topbar-actions">
                  <button
                    type="button"
                    className="kimchi-drawer__new"
                    onClick={() => void threads.createThread()}
                    aria-label="New chat"
                    title="New chat"
                  >
                    +
                  </button>
                  <button type="button" className="kimchi-drawer__close" onClick={closePanel} aria-label="Close">
                    ×
                  </button>
                </div>
              </div>

              {threads.threadMenuOpen && (
                <div className="kimchi-drawer__thread-menu">
                  {threads.threads.length === 0 && (
                    <p className="kimchi-drawer__thread-empty">No past chats yet.</p>
                  )}
                  {threads.threads.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`kimchi-drawer__thread-item${t.id === threads.activeThreadId ? " kimchi-drawer__thread-item--active" : ""}`}
                      onClick={() => void threads.selectThread(t.id)}
                    >
                      <span className="kimchi-drawer__thread-title">
                        {t.title === "New chat" ? "Untitled chat" : t.title}
                      </span>
                      <span className="kimchi-drawer__thread-meta">
                        {t.messageCount} msg · {new Date(t.updatedAt).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <KimchiChatPanel
                pageHint={pageHint}
                voiceUnavailable={voiceConfigured === false}
                threads={threads}
              />
            </div>
          </>,
          document.body,
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
      @keyframes kimchiOrbPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.06); }
      }
      .kimchi-drawer-backdrop {
        position: fixed;
        inset: 0;
        z-index: 200;
        background: rgba(15, 24, 20, 0.35);
        transition: opacity 0.28s ease;
        cursor: pointer;
      }
      .kimchi-drawer {
        position: fixed;
        right: 0;
        top: 0;
        bottom: 0;
        z-index: 201;
        background: #FFFFFF;
        display: flex;
        flex-direction: column;
        box-shadow: -8px 0 40px rgba(26, 58, 47, 0.18);
        transition: transform 0.28s cubic-bezier(0.32, 0, 0.16, 1);
        overflow: hidden;
      }
      .kimchi-drawer__topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 14px;
        background: #1A3A2F;
        flex-shrink: 0;
      }
      .kimchi-drawer__topbar-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
      }
      .kimchi-drawer__star { color: #E8D5A3; font-size: 14px; flex-shrink: 0; }
      .kimchi-drawer__thread-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        padding: 4px 8px;
        border: 1px solid rgba(232, 213, 163, 0.2);
        border-radius: var(--scout-radius);
        background: rgba(255,255,255,0.06);
        cursor: pointer;
      }
      .kimchi-drawer__name {
        font-family: ${sans};
        font-size: 14px;
        font-weight: 600;
        color: #E8D5A3;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 240px;
      }
      .kimchi-drawer__chev {
        color: rgba(232, 213, 163, 0.65);
        font-size: 10px;
      }
      .kimchi-drawer__topbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .kimchi-drawer__new {
        width: 32px;
        height: 32px;
        padding: 0;
        border: 1px solid rgba(232, 213, 163, 0.25);
        border-radius: var(--scout-radius);
        background: transparent;
        color: #E8D5A3;
        font-family: ${sans};
        font-size: 20px;
        font-weight: 400;
        line-height: 1;
        cursor: pointer;
      }
      .kimchi-drawer__close {
        width: 30px;
        height: 30px;
        border: 1px solid rgba(232, 213, 163, 0.18);
        background: transparent;
        color: rgba(232, 213, 163, 0.72);
        font-size: 20px;
        cursor: pointer;
      }
      .kimchi-drawer__thread-menu {
        flex-shrink: 0;
        max-height: 220px;
        overflow-y: auto;
        border-bottom: 1px solid rgba(26, 58, 47, 0.1);
        background: #FAFAF8;
      }
      .kimchi-drawer__thread-empty {
        margin: 0;
        padding: 12px 14px;
        font-family: ${sans};
        font-size: 13px;
        color: var(--scout-muted);
      }
      .kimchi-drawer__thread-item {
        display: block;
        width: 100%;
        text-align: left;
        padding: 10px 14px;
        border: none;
        border-bottom: 1px solid rgba(0,0,0,0.04);
        background: transparent;
        cursor: pointer;
      }
      .kimchi-drawer__thread-item--active {
        background: rgba(26, 58, 47, 0.06);
      }
      .kimchi-drawer__thread-title {
        display: block;
        font-family: ${sans};
        font-size: 13px;
        font-weight: 600;
        color: #1A3A2F;
      }
      .kimchi-drawer__thread-meta {
        display: block;
        margin-top: 2px;
        font-family: ${sans};
        font-size: 11px;
        color: var(--scout-muted);
      }
    `}</style>
  );
}

/** @deprecated use KimchiAssistant */
export const VoiceAgentFloat = KimchiAssistant;
