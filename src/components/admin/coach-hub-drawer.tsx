"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CoachHubPanel } from "@/components/admin/coach-hub-panel";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { CoachEditAvailabilityView } from "@/components/scout/coach-edit-availability-view";
import { CoachInboxPanel } from "@/components/admin/coach-inbox-panel";
import { CoachPricingDrawer } from "@/components/scout/coach-pricing-drawer";
import { CoachProfileTab } from "@/components/scout/coach-profile-tab";
import { useIsMobile } from "@/hooks/use-mobile";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";
import { DRAWER_BACKDROP_Z, DRAWER_Z } from "@/lib/z-layers";

const DRAWER_WIDTH = "min(1180px, calc(100vw - 16px))";

export type CoachHubPreview = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  headline: string | null;
};

type TabId = "overview" | "profile" | "pricing" | "availability" | "inbox";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Profile" },
  { id: "pricing", label: "Pricing" },
  { id: "availability", label: "Availability" },
  { id: "inbox", label: "Inbox" },
];

type Props = {
  coachId: string;
  coachPreview?: CoachHubPreview | null;
  onClose: () => void;
  basePath?: string;
  onCoachUpdated?: () => void;
};

function CoachHubDrawerInner({ coachId, coachPreview, onClose, basePath = "/admin/coaches", onCoachUpdated }: Props) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<TabId>((searchParams.get("tab") as TabId) || "overview");
  const displayName = coachPreview?.displayName ?? "Expert hub";

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

  function selectTab(next: TabId) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("coachId", coachId);
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    router.replace(`${basePath}?${params.toString()}`, { scroll: false });
  }

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: DRAWER_BACKDROP_Z }} />
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
          zIndex: DRAWER_Z,
          boxShadow: isMobile ? "none" : "3px 3px 0 rgba(17,17,17,0.08)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: isMobile ? "12px 16px 0" : "14px 28px 0",
            background: surface.card,
            borderBottom: "var(--scout-border)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: isMobile ? 12 : 14 }}>
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

          <div style={{ display: "flex", gap: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            {TABS.map(({ id, label }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectTab(id)}
                  style={{
                    flexShrink: 0,
                    padding: "10px 16px",
                    border: "none",
                    borderBottom: active ? `2px solid ${color.forest}` : "2px solid transparent",
                    background: "transparent",
                    fontFamily: fontSans,
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    color: active ? color.forest : color.muted,
                    cursor: "pointer",
                    marginBottom: -1,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: tab === "pricing" ? "hidden" : "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            padding: tab === "pricing" ? 0 : isMobile ? "20px 16px 32px" : "28px 32px 36px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {tab === "overview" && (
            <CoachHubPanel
              apiPath={`/api/admin/coach-hub?coachId=${encodeURIComponent(coachId)}`}
              mode="admin"
              coachId={coachId}
              showAdminLinks
              embedded
            />
          )}
          {tab === "profile" && (
            <CoachProfileTab mode="admin" coachId={coachId} onProfileSaved={onCoachUpdated} />
          )}
          {tab === "pricing" && (
            <CoachPricingDrawer embedded coachId={coachId} coachSlug={null} />
          )}
          {tab === "availability" && (
            <CoachEditAvailabilityView mode="admin" coachId={coachId} embedded />
          )}
          {tab === "inbox" && (
            <CoachInboxPanel coachId={coachId} embedded />
          )}
        </div>
      </div>
    </>
  );
}

export function CoachHubDrawer(props: Props) {
  return (
    <Suspense fallback={null}>
      <CoachHubDrawerInner {...props} />
    </Suspense>
  );
}
