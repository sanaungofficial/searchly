"use client";

import { useCallback, useEffect, useState } from "react";
import { CoachHubPanel } from "@/components/admin/coach-hub-panel";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { border, color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

const DRAWER_WIDTH = "min(1180px, calc(100vw - 16px))";

export type CoachHubPreview = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  headline: string | null;
};

type Props = {
  coachId: string;
  coachPreview?: CoachHubPreview | null;
  onClose: () => void;
};

export function CoachHubDrawer({ coachId, coachPreview, onClose }: Props) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const displayName = coachPreview?.displayName ?? "Coach hub";

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 60 }} />
      <div
        style={{
          position: "fixed",
          top: isMobile ? 0 : 8,
          right: isMobile ? 0 : 8,
          bottom: isMobile ? 0 : 8,
          left: isMobile ? 0 : undefined,
          width: isMobile ? "100vw" : DRAWER_WIDTH,
          maxWidth: isMobile ? "100vw" : "calc(100vw - 16px)",
          background: surface.page,
          overflow: "hidden",
          zIndex: 70,
          boxShadow: isMobile ? "none" : "3px 3px 0 rgba(17,17,17,0.08)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: isMobile ? "12px 16px" : "14px 28px",
            background: surface.card,
            borderBottom: border.line,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: color.muted, padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
          {coachPreview && (
            <CoachAvatar name={coachPreview.displayName} photoUrl={coachPreview.photoUrl} size={isMobile ? 36 : 40} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...displayTitleStyle(18), margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName}
            </p>
            {coachPreview?.headline && (
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: color.muted,
                  margin: "2px 0 0",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {coachPreview.headline}
              </p>
            )}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            padding: isMobile ? "20px 16px 32px" : "28px 32px 36px",
          }}
        >
          <CoachHubPanel
            apiPath={`/api/admin/coach-hub?coachId=${encodeURIComponent(coachId)}`}
            mode="admin"
            coachId={coachId}
            showAdminLinks
            embedded
          />
        </div>
      </div>
    </>
  );
}
