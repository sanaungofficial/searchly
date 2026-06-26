"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { KimchiChatPanel } from "@/components/scout/kimchi-chat-panel";
import { KimchiThreadSidebar } from "@/components/scout/kimchi-thread-sidebar";
import { VoiceOrb } from "@/components/voice/voice-orb";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKimchiThreads } from "@/hooks/use-kimchi-threads";
import type { AssistantPageHint } from "@/lib/kimchi-assistant/types";
import { fontSans } from "@/lib/typography";

const sans = fontSans;
const DRAWER_WIDTH = "min(980px, calc(100vw - 24px))";

function launcherBottom(isMobile: boolean): string {
  return isMobile ? "max(16px, env(safe-area-inset-bottom))" : "24px";
}

export function KimchiAssistant() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const router = useRouter();
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
    threads.threads.find((t) => t.id === threads.activeThreadId)?.title ?? threads.activeThreadTitle;
  const displayTitle =
    activeTitle === "New chat" || activeTitle === "New thread" ? "New thread" : activeTitle;

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
                  <div className="kimchi-drawer__title-block">
                    <span className="kimchi-drawer__brand">Kimchi</span>
                    <span className="kimchi-drawer__name">{displayTitle}</span>
                  </div>
                </div>
                <div className="kimchi-drawer__topbar-actions">
                  <button type="button" className="kimchi-drawer__close" onClick={closePanel} aria-label="Close">
                    ×
                  </button>
                </div>
              </div>

              <div className="kimchi-drawer__body">
                <div className="kimchi-drawer__main">
                  <KimchiChatPanel
                    key={threads.activeThreadId ?? "none"}
                    pageHint={pageHint}
                    voiceUnavailable={voiceConfigured === false}
                    threads={threads}
                    onNavigate={(href) => {
                      router.push(href);
                    }}
                  />
                </div>
                <KimchiThreadSidebar
                  threads={threads.threads}
                  activeThreadId={threads.activeThreadId}
                  loading={threads.loading}
                  onSelect={(id) => void threads.selectThread(id)}
                  onCreate={() => void threads.createThread()}
                />
              </div>
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
        background: rgba(15, 24, 20, 0.2);
        transition: opacity 0.28s ease;
        cursor: pointer;
      }
      .kimchi-drawer {
        position: fixed;
        right: 0;
        top: 0;
        bottom: 0;
        z-index: 201;
        background: #FAFAF8;
        display: flex;
        flex-direction: column;
        box-shadow: -12px 0 48px rgba(26, 58, 47, 0.12);
        transition: transform 0.28s cubic-bezier(0.32, 0, 0.16, 1);
        overflow: hidden;
      }
      .kimchi-drawer__body {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: row;
      }
      .kimchi-drawer__main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .kimchi-drawer__topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 14px 18px;
        background: #FFFFFF;
        border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        flex-shrink: 0;
      }
      .kimchi-drawer__topbar-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
      }
      .kimchi-drawer__star { color: #E8913A; font-size: 16px; flex-shrink: 0; }
      .kimchi-drawer__title-block {
        display: flex;
        flex-direction: column;
        min-width: 0;
        gap: 1px;
      }
      .kimchi-drawer__brand {
        font-family: ${sans};
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: rgba(26, 58, 47, 0.45);
      }
      .kimchi-drawer__name {
        font-family: ${sans};
        font-size: 15px;
        font-weight: 600;
        color: #1A1A1A;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: min(420px, 42vw);
      }
      .kimchi-drawer__topbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .kimchi-drawer__close {
        width: 34px;
        height: 34px;
        border: 1px solid rgba(26, 58, 47, 0.1);
        border-radius: 10px;
        background: #fff;
        color: rgba(26, 58, 47, 0.55);
        font-size: 20px;
        cursor: pointer;
      }
    `}</style>
  );
}

/** @deprecated use KimchiAssistant */
export const VoiceAgentFloat = KimchiAssistant;
