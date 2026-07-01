"use client";

import { createContext, useContext, useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { INITIAL_KANBAN_CARDS, NOTIFICATIONS } from "@/components/scout/workspace-data";
import { useJobs } from "@/hooks/useJobs";
import type { KanbanCard, KanbanStage } from "@/components/scout/workspace-data";
import { ImpersonationBanner, type ImpersonationState } from "@/components/admin/impersonation-banner";
import { AdminClientReviewBanner } from "@/components/admin/admin-client-review-banner";
import { syncWorkspaceBannerOffset } from "@/lib/workspace-layout";
import { isStaffPortalRole } from "@/lib/staff-portal";
import {
  getActingUserScope,
  loadStaffDashboardView,
  saveStaffDashboardView,
  type StaffDashboardView,
  getAdminReviewClientId,
  getAdminReviewMeta,
  setAdminReviewClient,
  clearAdminReviewClient,
  type AdminReviewMeta,
} from "@/lib/client-session";
import { commitActingUserScope } from "@/lib/commit-acting-user-scope";
import { parseAdminClientProfilePath, readClientUserIdFromBrowserSearch, withClientUserId, withClientReviewPagePath } from "@/lib/workspace-urls";
import { isPublicCoachingPath } from "@/lib/auth-return-url";

const KIMCHI_CHAT_PINNED_KEY = "kimchi_chat_pinned";

function readPinnedChatOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(KIMCHI_CHAT_PINNED_KEY) === "1";
  } catch {
    return false;
  }
}

export type DrawerTool = "resume" | "cover" | "fit" | null;

export type CoachPrepTarget = {
  id: string;
  slug?: string;
  displayName: string;
  headline?: string | null;
  category?: string | null;
  specialties?: string[];
  firms?: string[];
  schools?: string[];
  aboutMe?: string | null;
  bio?: string | null;
  whyCoach?: string | null;
  matchScore?: number;
  matchLabel?: string;
  matchReasons?: string[];
};

interface WorkspaceUser {
  name: string | null;
  email: string;
  avatarUrl: string | null;
  headline?: string | null;
}

interface WorkspaceContextValue {
  user: WorkspaceUser | null;
  isAdmin: boolean;
  userRole: string;
  authChecked: boolean;
  kanbanCards: KanbanCard[];
  setKanbanCards: React.Dispatch<React.SetStateAction<KanbanCard[]>>;
  addJob: (company: string, role: string, url?: string, meta?: JobMeta) => Promise<{ id: string; cardId: number } | null>;
  updateStage: (cardId: number, stage: KanbanStage) => Promise<void>;
  removeJob: (cardId: number) => Promise<void>;
  drawerCardId: number | null;
  setDrawerCardId: (id: number | null) => void;
  drawerTool: DrawerTool;
  setDrawerTool: (t: DrawerTool) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  chatView: "tools" | "chat" | "coach" | "coach-prep";
  setChatView: (view: "tools" | "chat" | "coach" | "coach-prep") => void;
  chatPulse: boolean;
  fitChatNonce: number;
  fitChatJob: KanbanCard | null;
  openFitChat: (job: KanbanCard) => void;
  coachChatNonce: number;
  openProfileCoach: () => void;
  coachPrepCoach: CoachPrepTarget | null;
  coachPrepNonce: number;
  openCoachPrepChat: (coach: CoachPrepTarget) => void;
  notifOpen: boolean;
  setNotifOpen: React.Dispatch<React.SetStateAction<boolean>>;
  notifRead: Record<number, boolean>;
  setNotifRead: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  notifUnreadCount: number;
  handleSignOut: () => Promise<void>;
  updateAvatarUrl: (url: string) => void;
  pricingOpen: boolean;
  openPricing: () => void;
  closePricing: () => void;
  actingUserId: string | null;
  isImpersonating: boolean;
  /** Admin UI (nav, settings badge, client intake) — false while impersonating a client. */
  showAdminUi: boolean;
  staffDashboardView: StaffDashboardView;
  setStaffDashboardView: (view: StaffDashboardView) => void;
  /** True when dashboard should show job-seeker home (incl. staff who toggled seeker view). */
  showSeekerDashboard: boolean;
  /** True when staff is in expert workspace mode on dashboard. */
  showExpertDashboard: boolean;
  /** Admin reviewing a client without impersonating — persists across pages. */
  adminReviewClientId: string | null;
  adminReviewClient: AdminReviewMeta | null;
  isAdminReviewing: boolean;
  /** Append clientUserId to API paths when admin-reviewing (impersonation uses cookie). */
  withClientScope: (path: string) => string;
  /** Keep clientUserId on in-app links during admin profile review. */
  withClientReviewPath: (path: string) => string;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<WorkspaceUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState("USER");
  const [authChecked, setAuthChecked] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifRead, setNotifRead] = useState<Record<number, boolean>>({});
  const [drawerCardId, setDrawerCardId] = useState<number | null>(null);
  const [drawerTool, setDrawerTool] = useState<DrawerTool>(null);
  const [chatOpen, setChatOpenState] = useState(false);
  const [chatView, setChatView] = useState<"tools" | "chat">("tools");
  const [chatPulse, setChatPulse] = useState(false);
  const [fitChatNonce, setFitChatNonce] = useState(0);
  const [fitChatJob, setFitChatJob] = useState<KanbanCard | null>(null);
  const [coachChatNonce, setCoachChatNonce] = useState(0);
  const [coachPrepCoach, setCoachPrepCoach] = useState<CoachPrepTarget | null>(null);
  const [coachPrepNonce, setCoachPrepNonce] = useState(0);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [impersonation, setImpersonation] = useState<ImpersonationState>({ active: false });
  const [actingUserId, setActingUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const reviewId = getAdminReviewClientId() ?? readClientUserIdFromBrowserSearch();
    if (reviewId) return reviewId;
    const scope = getActingUserScope();
    return scope !== "self" ? scope : null;
  });
  const [staffDashboardView, setStaffDashboardViewState] = useState<StaffDashboardView>("seeker");
  const [staffUserId, setStaffUserId] = useState<string | null>(null);
  const [adminReviewClientId, setAdminReviewClientIdState] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getAdminReviewClientId() ?? readClientUserIdFromBrowserSearch(),
  );
  const [adminReviewClient, setAdminReviewClientMeta] = useState<AdminReviewMeta | null>(() =>
    typeof window === "undefined" ? null : getAdminReviewMeta(),
  );

  useEffect(() => {
    if (readPinnedChatOpen()) setChatOpenState(true);
  }, []);

  const setChatOpen = useCallback((open: boolean) => {
    setChatOpenState(open);
    try {
      sessionStorage.setItem(KIMCHI_CHAT_PINNED_KEY, open ? "1" : "0");
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const setAdminReviewClientId = useCallback((id: string | null, meta?: AdminReviewMeta) => {
    setAdminReviewClientIdState(id);
    if (id) {
      setAdminReviewClient(id, meta);
      commitActingUserScope(id);
      setAdminReviewClientMeta(meta ?? getAdminReviewMeta());
    } else {
      clearAdminReviewClient();
      setAdminReviewClientMeta(null);
    }
  }, []);

  const withClientScope = useCallback(
    (path: string) => {
      if (impersonation.active) return path;
      const reviewId =
        adminReviewClientId ??
        getAdminReviewClientId() ??
        readClientUserIdFromBrowserSearch();
      if (reviewId) return withClientUserId(path, reviewId);
      return path;
    },
    [impersonation.active, adminReviewClientId],
  );

  const withClientReviewPath = useCallback(
    (path: string) => {
      if (impersonation.active) return path;
      if (adminReviewClientId) return withClientReviewPagePath(path, adminReviewClientId);
      return path;
    },
    [impersonation.active, adminReviewClientId],
  );

  const setStaffDashboardView = useCallback((view: StaffDashboardView) => {
    setStaffDashboardViewState(view);
    saveStaffDashboardView(staffUserId, view);
  }, [staffUserId]);

  const openPricing = useCallback(() => setPricingOpen(true), []);
  const closePricing = useCallback(() => setPricingOpen(false), []);

  const openFitChat = useCallback((job: KanbanCard) => {
    setFitChatJob(job);
    setDrawerCardId(job.id);
    setDrawerTool(null);
    setChatView("chat");
    setChatOpen(true);
    setChatPulse(true);
    setFitChatNonce((n) => n + 1);
    window.setTimeout(() => setChatPulse(false), 2400);
  }, []);

  const openProfileCoach = useCallback(() => {
    setChatView("coach");
    setChatOpen(true);
    setCoachChatNonce((n) => n + 1);
  }, []);

  const openCoachPrepChat = useCallback((coach: CoachPrepTarget) => {
    setCoachPrepCoach(coach);
    setChatView("coach-prep");
    setChatOpen(true);
    setChatPulse(true);
    setCoachPrepNonce((n) => n + 1);
    window.setTimeout(() => setChatPulse(false), 2400);
  }, []);

  const jobsReloadKey = impersonation.active ? actingUserId : adminReviewClientId ?? actingUserId;
  const { cards: kanbanCards, setCards: setKanbanCards, addJob, updateStage, removeJob } =
    useJobs(
      INITIAL_KANBAN_CARDS,
      jobsReloadKey ?? undefined,
      impersonation.active ? null : adminReviewClientId,
    );

  const notifUnreadCount = NOTIFICATIONS.filter((n) => !notifRead[n.id] && n.unread).length;

  // SSR renders with null — sync sessionStorage before children fetch scoped APIs.
  useLayoutEffect(() => {
    const reviewId = getAdminReviewClientId();
    if (reviewId && reviewId !== adminReviewClientId) {
      setAdminReviewClientIdState(reviewId);
      setActingUserId(reviewId);
      commitActingUserScope(reviewId);
      const meta = getAdminReviewMeta();
      if (meta) setAdminReviewClientMeta(meta);
    }
    const fromUrl = readClientUserIdFromBrowserSearch();
    if (fromUrl && fromUrl !== adminReviewClientId) {
      setAdminReviewClientId(fromUrl);
    }
  }, [adminReviewClientId, setAdminReviewClientId]);

  useEffect(() => {
    if (staffUserId && !impersonation.active && !adminReviewClientId) {
      setStaffDashboardViewState(loadStaffDashboardView(staffUserId));
    }
  }, [staffUserId, impersonation.active, adminReviewClientId]);

  const isStaffPortal = isStaffPortalRole(userRole);
  const isAdminReviewing = Boolean(adminReviewClientId) && !impersonation.active;
  const bannerStackRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = bannerStackRef.current;
    const sync = () => syncWorkspaceBannerOffset(el?.offsetHeight ?? 0);
    sync();
    if (!el) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [impersonation.active, isAdminReviewing, adminReviewClientId]);

  const showSeekerDashboard =
    !isStaffPortal || impersonation.active || isAdminReviewing || staffDashboardView === "seeker";
  const showExpertDashboard =
    isStaffPortal && !impersonation.active && !isAdminReviewing && staffDashboardView === "expert";

  useEffect(() => {
    const fromUrl = parseAdminClientProfilePath(pathname);
    if (fromUrl?.clientId && fromUrl.clientId !== adminReviewClientId) {
      setAdminReviewClientId(fromUrl.clientId);
    }
  }, [pathname, adminReviewClientId, setAdminReviewClientId]);

  useEffect(() => {
    if (!adminReviewClientId || impersonation.active || typeof window === "undefined") return;
    const current = readClientUserIdFromBrowserSearch();
    if (current === adminReviewClientId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("clientUserId", adminReviewClientId);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [adminReviewClientId, impersonation.active, pathname]);

  useEffect(() => {
    if (!adminReviewClientId || impersonation.active) return;
    fetch(withClientUserId("/api/profile", adminReviewClientId), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || data.error) return;
        const meta = { name: data.name as string | null, email: data.email as string | null };
        setAdminReviewClientMeta(meta);
        setAdminReviewClient(adminReviewClientId, meta);
      })
      .catch(() => {});
  }, [adminReviewClientId, impersonation.active]);

  // Heal sessionStorage-only admin review (pre-cookie) so server-scoped writes target the client.
  useEffect(() => {
    if (!adminReviewClientId || impersonation.active) return;
    void fetch("/api/admin/client-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: adminReviewClientId }),
    }).catch(() => {});
  }, [adminReviewClientId, impersonation.active]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!authUser) {
        setAuthChecked(true);
        if (!isPublicCoachingPath(pathname)) {
          router.push("/login");
        }
        return;
      }
      let headline: string | null = null;
      let dbAvatarUrl: string | null = null;
      let profileName: string | null = null;
      let profileEmail: string | null = null;
      let impersonating = false;
      let reviewClientId = getAdminReviewClientId() ?? readClientUserIdFromBrowserSearch();
      try {
        const profileUrl =
          reviewClientId && !impersonating
            ? withClientUserId("/api/profile", reviewClientId)
            : "/api/profile";
        const res = await fetch(profileUrl, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          headline = data?.headline ?? null;
          dbAvatarUrl = data?.avatarUrl ?? null;
          profileName = data?.name ?? null;
          profileEmail = data?.email ?? null;
          impersonating = !!data?.impersonating?.active;
          if (impersonating) {
            setImpersonation({
              active: true,
              name: data.impersonating.name,
              email: data.impersonating.email,
            });
            setAdminReviewClientId(null);
            clearAdminReviewClient();
            setActingUserId(data.impersonating.userId ?? data.userId ?? null);
            commitActingUserScope(data.impersonating.userId ?? data.userId ?? null);
            reviewClientId = null;
          } else {
            setImpersonation({ active: false });
            if (data?.adminReview?.clientId) {
              reviewClientId = data.adminReview.clientId as string;
            }
            if (reviewClientId) {
              setAdminReviewClientIdState(reviewClientId);
              setActingUserId(reviewClientId);
              commitActingUserScope(reviewClientId);
              setAdminReviewClient(reviewClientId, {
                name: profileName,
                email: profileEmail,
              });
              setAdminReviewClientMeta({ name: profileName, email: profileEmail });
            } else {
              setActingUserId(data.userId ?? null);
              commitActingUserScope(data.userId ?? null);
            }
          }
        } else if (res.status === 401) {
          setAuthChecked(true);
          router.push("/login");
          return;
        }
      } catch {}

      if (!impersonating) {
        try {
          const impRes = await fetch("/api/admin/impersonate", { cache: "no-store" });
          if (impRes.ok) {
            const imp = await impRes.json();
            if (imp.active && imp.user?.id) {
              impersonating = true;
              setImpersonation({
                active: true,
                name: imp.user.name,
                email: imp.user.email,
              });
              setAdminReviewClientId(null);
              clearAdminReviewClient();
              setActingUserId(imp.user.id);
              commitActingUserScope(imp.user.id);
              reviewClientId = null;
            }
          }
        } catch {}
      }
      try {
        const res = await fetch("/api/admin");
        setIsAdmin(res.ok);
      } catch {}
      try {
        const res = await fetch("/api/staff/role");
        if (res.ok) {
          const data = await res.json();
          setUserRole(data.role ?? "USER");
          if (data.userId) setStaffUserId(data.userId);
        }
      } catch {}
      const viewingAsClient = impersonating || Boolean(reviewClientId);
      setUser({
        name:
          profileName ??
          (viewingAsClient ? null : authUser.user_metadata?.full_name ?? authUser.email?.split("@")[0] ?? null),
        email: profileEmail ?? (viewingAsClient ? "" : authUser.email!),
        avatarUrl: dbAvatarUrl ?? (viewingAsClient ? null : authUser.user_metadata?.avatar_url ?? null),
        headline,
      });
      setAuthChecked(true);
    });
  }, [router, pathname]);

  const updateAvatarUrl = useCallback((url: string) => {
    setUser((prev) => prev ? { ...prev, avatarUrl: url } : prev);
  }, []);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        user,
        isAdmin,
        userRole,
        authChecked,
        kanbanCards,
        setKanbanCards,
        addJob,
        updateStage,
        removeJob,
        drawerCardId,
        setDrawerCardId,
        drawerTool,
        setDrawerTool,
        chatOpen,
        setChatOpen,
        chatView,
        setChatView,
        chatPulse,
        fitChatNonce,
        fitChatJob,
        openFitChat,
        coachChatNonce,
        openProfileCoach,
        coachPrepCoach,
        coachPrepNonce,
        openCoachPrepChat,
        notifOpen,
        setNotifOpen,
        notifRead,
        setNotifRead,
        notifUnreadCount,
        handleSignOut,
        updateAvatarUrl,
        pricingOpen,
        openPricing,
        closePricing,
        actingUserId,
        isImpersonating: impersonation.active,
        showAdminUi: isAdmin && !impersonation.active && !isAdminReviewing,
        staffDashboardView,
        setStaffDashboardView,
        showSeekerDashboard,
        showExpertDashboard,
        adminReviewClientId,
        adminReviewClient,
        isAdminReviewing,
        withClientScope,
        withClientReviewPath,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <div ref={bannerStackRef}>
          <ImpersonationBanner state={impersonation} />
          {isAdminReviewing && adminReviewClientId && (
            <AdminClientReviewBanner
              clientId={adminReviewClientId}
              name={adminReviewClient?.name}
              email={adminReviewClient?.email}
            />
          )}
        </div>
        {children}
      </div>
    </WorkspaceContext.Provider>
  );
}
