"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { INITIAL_KANBAN_CARDS, NOTIFICATIONS } from "@/components/scout/workspace-data";
import { useJobs } from "@/hooks/useJobs";
import type { KanbanCard, KanbanStage } from "@/components/scout/workspace-data";
import { ImpersonationBanner, type ImpersonationState } from "@/components/admin/impersonation-banner";
import { AdminClientReviewBanner } from "@/components/admin/admin-client-review-banner";
import { isStaffPortalRole } from "@/lib/staff-portal";
import {
  setActingUserScope,
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
import { parseAdminClientProfilePath, withClientUserId } from "@/lib/workspace-urls";

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
  const [chatOpen, setChatOpen] = useState(false);
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
    const scope = getActingUserScope();
    return scope !== "self" ? scope : null;
  });
  const [staffDashboardView, setStaffDashboardViewState] = useState<StaffDashboardView>("seeker");
  const [staffUserId, setStaffUserId] = useState<string | null>(null);
  const [adminReviewClientId, setAdminReviewClientIdState] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getAdminReviewClientId(),
  );
  const [adminReviewClient, setAdminReviewClientMeta] = useState<AdminReviewMeta | null>(() =>
    typeof window === "undefined" ? null : getAdminReviewMeta(),
  );

  const setAdminReviewClientId = useCallback((id: string | null, meta?: AdminReviewMeta) => {
    setAdminReviewClientIdState(id);
    if (id) {
      setAdminReviewClient(id, meta);
      setActingUserScope(id);
      setAdminReviewClientMeta(meta ?? getAdminReviewMeta());
    } else {
      clearAdminReviewClient();
      setAdminReviewClientMeta(null);
    }
  }, []);

  const withClientScope = useCallback(
    (path: string) => {
      if (impersonation.active) return path;
      if (adminReviewClientId) return withClientUserId(path, adminReviewClientId);
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

  useEffect(() => {
    if (staffUserId && !impersonation.active) {
      setStaffDashboardViewState(loadStaffDashboardView(staffUserId));
    }
  }, [staffUserId, impersonation.active]);

  const isStaffPortal = isStaffPortalRole(userRole);
  const isAdminReviewing = Boolean(adminReviewClientId) && !impersonation.active;
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

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!authUser) {
        setAuthChecked(true);
        router.push("/login");
        return;
      }
      let headline: string | null = null;
      let dbAvatarUrl: string | null = null;
      let profileName: string | null = null;
      let profileEmail: string | null = null;
      let impersonating = false;
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
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
            setActingUserId(data.impersonating.userId ?? data.userId ?? null);
            setActingUserScope(data.impersonating.userId ?? data.userId ?? null);
          } else {
            setImpersonation({ active: false });
            const reviewId = getAdminReviewClientId();
            if (reviewId) {
              setAdminReviewClientIdState(reviewId);
              setActingUserId(reviewId);
              setActingUserScope(reviewId);
            } else {
              setActingUserId(data.userId ?? null);
              setActingUserScope(data.userId ?? null);
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
              setActingUserId(imp.user.id);
              setActingUserScope(imp.user.id);
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
      setUser({
        name:
          profileName ??
          (impersonating ? null : authUser.user_metadata?.full_name ?? authUser.email?.split("@")[0] ?? null),
        email: profileEmail ?? (impersonating ? "" : authUser.email!),
        avatarUrl: dbAvatarUrl ?? (impersonating ? null : authUser.user_metadata?.avatar_url ?? null),
        headline,
      });
      setAuthChecked(true);
    });
  }, [router]);

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
        showAdminUi: isAdmin && !impersonation.active,
        staffDashboardView,
        setStaffDashboardView,
        showSeekerDashboard,
        showExpertDashboard,
        adminReviewClientId,
        adminReviewClient,
        isAdminReviewing,
        withClientScope,
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
        <ImpersonationBanner state={impersonation} />
        {isAdminReviewing && adminReviewClientId && (
          <AdminClientReviewBanner
            clientId={adminReviewClientId}
            name={adminReviewClient?.name}
            email={adminReviewClient?.email}
          />
        )}
        {children}
      </div>
    </WorkspaceContext.Provider>
  );
}
