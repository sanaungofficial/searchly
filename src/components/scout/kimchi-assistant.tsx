"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { KimchiChatPanel } from "@/components/scout/kimchi-chat-panel";
import { KimchiThreadSidebar } from "@/components/scout/kimchi-thread-sidebar";
import { VoiceOrb } from "@/components/voice/voice-orb";
import { useVoiceAgentOptional } from "@/contexts/voice-agent-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKimchiThreads } from "@/hooks/use-kimchi-threads";
import type { AssistantPageHint } from "@/lib/kimchi-assistant/types";
import { fontSans } from "@/lib/typography";
import { ScoutDrawerBackdrop } from "@/components/scout/scout-drawer-shell";
import { DRAWER_Z } from "@/lib/z-layers";
import { TOP_NAV_HEIGHT, TOP_NAV_HEIGHT_MOBILE } from "./workspace-top-nav";

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
  const voice = useVoiceAgentOptional();
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
  const navHeight = isMobile ? TOP_NAV_HEIGHT_MOBILE : TOP_NAV_HEIGHT;

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
          <VoiceOrb
            variant="float"
            state={voice?.sessionActive ? voice.orbState : "idle"}
            audioLevel={voice?.sessionActive ? voice.audioLevel : undefined}
            onClick={openPanel}
            bounce={!voice?.sessionActive}
          />
        </div>
      )}

      {mounted &&
        panelOpen &&
        createPortal(
          <>
            <ScoutDrawerBackdrop
              onClose={closePanel}
              variant={isMobile ? "default" : "transparent"}
              interactive={visible}
              className="kimchi-drawer-backdrop"
              style={{
                opacity: visible ? 1 : 0,
                top: navHeight,
                background: isMobile ? "rgba(15, 24, 20, 0.2)" : undefined,
                transition: "opacity 0.28s ease",
              }}
            />
            <div
              className="kimchi-drawer bruddle"
              style={{
                width: DRAWER_WIDTH,
                top: navHeight,
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
        left: 0;
        right: 0;
        bottom: 0;
      }
      .kimchi-drawer {
        position: fixed;
        right: 0;
        bottom: 0;
        z-index: ${DRAWER_Z};
        background: var(--scout-page);
        display: flex;
        flex-direction: column;
        border-left: var(--scout-border);
        box-shadow: -4px 4px 0 #161616;
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
        background: var(--scout-surface);
        border-bottom: var(--scout-border);
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
        font-family: var(--font-display);
        font-size: 15px;
        font-weight: 400;
        color: #161616;
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
        border: var(--scout-border);
        border-radius: 5px;
        background: var(--scout-surface);
        color: rgba(22, 22, 22, 0.55);
        font-size: 20px;
        cursor: pointer;
      }
    `}</style>
  );
}

/** @deprecated use KimchiAssistant */
export const VoiceAgentFloat = KimchiAssistant;
