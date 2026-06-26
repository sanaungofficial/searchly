"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { KimchiChatPanel } from "@/components/scout/kimchi-chat-panel";
import { VoiceOrb } from "@/components/voice/voice-orb";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AssistantPageHint } from "@/lib/kimchi-assistant/types";

function launcherBottom(isMobile: boolean): string {
  return isMobile ? "max(16px, env(safe-area-inset-bottom))" : "24px";
}

export function KimchiAssistant() {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { chatOpen, setChatOpen, chatPulse, kanbanCards, drawerCardId, chatView } = useWorkspace();
  const [panelOpen, setPanelOpen] = useState(false);
  const [voiceConfigured, setVoiceConfigured] = useState<boolean | null>(null);

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
    void fetch("/api/voice/agent/config?context=workspace", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setVoiceConfigured(!!d?.agentAvailable))
      .catch(() => setVoiceConfigured(false));
  }, []);

  useEffect(() => {
    if (chatOpen) setPanelOpen(true);
  }, [chatOpen]);

  const bottom = launcherBottom(isMobile);
  const right = isMobile ? "16px" : "24px";

  const closePanel = () => {
    setPanelOpen(false);
    setChatOpen(false);
  };

  const openPanel = () => {
    setPanelOpen(true);
    setChatOpen(true);
  };

  if (!panelOpen) {
    return (
      <>
        <KimchiAssistantStyles />
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
      </>
    );
  }

  return (
    <>
      <KimchiAssistantStyles />
      <button type="button" className="kimchi-assistant-backdrop" aria-label="Close Kimchi" onClick={closePanel} />
      <div className="kimchi-assistant-panel" style={{ bottom, right }}>
        <div className="kimchi-assistant-panel__topbar">
          <div className="kimchi-assistant-panel__brand">
            <span className="kimchi-assistant-panel__star">✦</span>
            <span className="kimchi-assistant-panel__name">Kimchi</span>
          </div>
          <button type="button" className="kimchi-assistant-panel__close" onClick={closePanel} aria-label="Close">
            ×
          </button>
        </div>
        <KimchiChatPanel pageHint={pageHint} voiceUnavailable={voiceConfigured === false} />
      </div>
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
        height: min(640px, calc(100vh - 120px));
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
        justify-content: space-between;
        gap: 10px;
        padding: 12px 14px;
        background: #1A3A2F;
        flex-shrink: 0;
      }
      .kimchi-assistant-panel__brand {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .kimchi-assistant-panel__star { color: #E8D5A3; font-size: 14px; }
      .kimchi-assistant-panel__name {
        font-family: var(--font-ui);
        font-size: 13px;
        font-weight: 600;
        color: #E8D5A3;
      }
      .kimchi-assistant-panel__close {
        width: 30px;
        height: 30px;
        border: 1px solid rgba(232, 213, 163, 0.18);
        background: transparent;
        color: rgba(232, 213, 163, 0.72);
        font-size: 20px;
        cursor: pointer;
      }
    `}</style>
  );
}

/** @deprecated use KimchiAssistant */
export const VoiceAgentFloat = KimchiAssistant;
