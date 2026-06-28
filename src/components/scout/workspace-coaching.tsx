"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { CoachDrawer } from "@/components/scout/coach-drawer";
import { CoachingDirectory } from "@/components/scout/coaching-directory";
import { ProfileCoachPanel } from "@/components/scout/profile-coach-panel";
import { CoachingLayoutSidebar } from "@/components/scout/coaching-layout-sidebar";
import type { CoachingTab } from "@/components/scout/coaching-layout-sidebar";
import { WorkspaceContent, WorkspaceScroll } from "@/components/scout/workspace-content";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRequireAuthRedirect } from "@/hooks/use-auth-return-path";
import { useWorkspace } from "@/contexts/workspace-context";
import { color, surface, border, fontSans, fontDisplay, type as T } from "@/lib/typography";
import type { CoachListItem } from "@/lib/coach-types";

const SIDEBAR_TABS: { id: CoachingTab; label: string }[] = [
  { id: "directory", label: "Find a coach" },
  { id: "my-coaches", label: "My coaches" },
  { id: "sessions", label: "Sessions" },
  { id: "notes", label: "Session notes" },
  { id: "resources", label: "Resources" },
];

function coachingTabFromPath(pathname: string): CoachingTab {
  if (pathname === "/coaching/my-coaches" || pathname.startsWith("/coaching/my-coaches/")) {
    return "my-coaches";
  }
  return "directory";
}

// ── Empty state placeholder ─────────────────────────────────────────────────

function EmptyIcon({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: "rgba(74,139,106,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 16px",
        color: color.forest,
      }}
    >
      {children}
    </div>
  );
}

function CalendarSvg() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="2" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 9h18" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 2v3M15 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7.5" cy="13.5" r="1" fill="currentColor" />
      <circle cx="11" cy="13.5" r="1" fill="currentColor" />
      <circle cx="14.5" cy="13.5" r="1" fill="currentColor" />
    </svg>
  );
}

function NotesSvg() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3" y="2" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 7h8M7 11h8M7 15h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function FolderSvg() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M2 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlaceholderTab({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        background: surface.card,
        border: "var(--scout-border)",
        borderRadius: "var(--scout-radius)",
        padding: "52px 32px",
        textAlign: "center",
        boxShadow: "var(--scout-shadow-card)",
      }}
    >
      <EmptyIcon>{icon}</EmptyIcon>
      <h3 style={{ fontFamily: fontDisplay, fontSize: 17, fontWeight: 600, color: color.ink, margin: "0 0 8px" }}>
        {title}
      </h3>
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.bodySm,
          color: color.muted,
          maxWidth: 340,
          margin: "0 auto",
          lineHeight: 1.55,
        }}
      >
        {description}
      </p>
    </div>
  );
}

// ── Mobile tab bar ──────────────────────────────────────────────────────────

function MobileTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: CoachingTab; label: string }[];
  active: CoachingTab;
  onChange: (tab: CoachingTab) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        overflowX: "auto",
        padding: "0 0 12px",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch" as "touch",
        marginBottom: 16,
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              flexShrink: 0,
              padding: "8px 14px",
              border: "var(--scout-border)",
              borderRadius: "calc(var(--scout-radius) - 2px)",
              background: isActive ? surface.inset : surface.card,
              color: isActive ? color.ink : color.muted,
              fontFamily: fontSans,
              fontSize: T.bodySm,
              fontWeight: isActive ? 600 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap" as const,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main inner component ────────────────────────────────────────────────────

function CoachingContent() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [page, setPage] = useState<CoachingTab>(coachingTabFromPath(pathname));
  const [isPro, setIsPro] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [drawerCoach, setDrawerCoach] = useState<CoachListItem | null>(null);
  const [myCoachIds, setMyCoachIds] = useState<Set<string>>(new Set());
  const { openPricing, user, authChecked } = useWorkspace();
  const requireAuth = useRequireAuthRedirect();

  const coachParam = searchParams.get("coach");

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => { if (d.isPro) setIsPro(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (page !== "directory") return;
    if (!coachParam) {
      setDrawerCoach(null);
      return;
    }
    setDrawerCoach((prev) => {
      if (prev?.slug === coachParam || prev?.id === coachParam) return prev;
      return { id: coachParam, slug: coachParam, displayName: "Coach" } as CoachListItem;
    });
  }, [coachParam, page]);

  const navigate = useCallback(
    (tab: CoachingTab) => {
      if (tab !== "directory" && (!authChecked || !user)) {
        requireAuth("login");
        return;
      }
      setPage(tab);
      if (tab === "my-coaches") {
        router.push("/coaching/my-coaches");
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      if (tab !== "directory") params.delete("coach");
      const qs = params.toString();
      router.push(qs ? `/coaching?${qs}` : "/coaching");
    },
    [router, searchParams, authChecked, user, requireAuth],
  );

  const openCoach = useCallback(
    (coach: CoachListItem) => {
      setDrawerCoach(coach);
      const slug = coach.slug ?? coach.id;
      const params = new URLSearchParams(searchParams.toString());
      params.set("coach", slug);
      router.replace(`/coaching?${params.toString()}`, { scroll: false });
      if (page !== "directory") setPage("directory");
    },
    [router, searchParams, page],
  );

  const closeDrawer = useCallback(() => {
    setDrawerCoach(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("coach");
    const qs = params.toString();
    router.replace(qs ? `/coaching?${qs}` : "/coaching", { scroll: false });
  }, [router, searchParams]);

  return (
    <>
      <div
        className="bruddle"
        style={{
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: surface.page,
        }}
      >
        <WorkspaceScroll>
          <WorkspaceContent>
            <div
              style={{
                display: isMobile ? "block" : "flex",
                gap: 32,
                alignItems: "flex-start",
              }}
            >
              {!isMobile && (
                <CoachingLayoutSidebar
                  tabs={SIDEBAR_TABS}
                  activePage={page}
                  onNavigate={navigate}
                />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                {isMobile && (
                  <MobileTabBar tabs={SIDEBAR_TABS} active={page} onChange={navigate} />
                )}

                {page === "directory" && (
                  <CoachingDirectory
                    isMobile={isMobile}
                    isPro={isPro}
                    onSubscribe={openPricing}
                    onOpenCoach={openCoach}
                    myCoachIds={myCoachIds}
                    onMyCoachIdsChange={setMyCoachIds}
                  />
                )}

                {page === "my-coaches" && (
                  <ProfileCoachPanel isMobile={isMobile} embedded />
                )}

                {page === "sessions" && (
                  <PlaceholderTab
                    icon={<CalendarSvg />}
                    title="Your sessions"
                    description="Upcoming and past coaching sessions will appear here once you book time with a coach."
                  />
                )}

                {page === "notes" && (
                  <PlaceholderTab
                    icon={<NotesSvg />}
                    title="Session notes"
                    description="Notes and homework from your coaching sessions will appear here after each call."
                  />
                )}

                {page === "resources" && (
                  <PlaceholderTab
                    icon={<FolderSvg />}
                    title="Shared resources"
                    description="Documents, resumes, and materials shared between you and your coach will appear here."
                  />
                )}
              </div>
            </div>
          </WorkspaceContent>
        </WorkspaceScroll>
      </div>

      {drawerCoach && page === "directory" && (
        <CoachDrawer
          slug={drawerCoach.slug ?? drawerCoach.id}
          preview={drawerCoach}
          onClose={closeDrawer}
          isPro={isPro}
          onSubscribe={openPricing}
          onMyCoachChange={(_id, _assigned, coachIds) => setMyCoachIds(new Set(coachIds))}
        />
      )}

      {showUpgrade && (
        <GrowthUpgradeModal
          trigger="coaching"
          onClose={() => setShowUpgrade(false)}
          onOpenPricing={openPricing}
        />
      )}
    </>
  );
}

// ── Public export ────────────────────────────────────────────────────────────

export function WorkspaceCoaching() {
  return (
    <Suspense fallback={<p style={{ color: color.muted, fontFamily: fontSans, padding: 24 }}>Loading coaching…</p>}>
      <CoachingContent />
    </Suspense>
  );
}
