"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { INITIAL_KANBAN_CARDS, NOTIFICATIONS } from "@/components/scout/workspace-data";
import { useJobs } from "@/hooks/useJobs";
import type { KanbanCard, KanbanStage } from "@/components/scout/workspace-data";
import { ImpersonationBanner, type ImpersonationState } from "@/components/admin/impersonation-banner";

export type DrawerTool = "resume" | "cover" | "fit" | null;

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
  chatView: "tools" | "chat";
  setChatView: (view: "tools" | "chat") => void;
  chatPulse: boolean;
  fitChatNonce: number;
  openFitChat: (jobId: number) => void;
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
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
  const [pricingOpen, setPricingOpen] = useState(false);
  const [impersonation, setImpersonation] = useState<ImpersonationState>({ active: false });

  const openPricing = useCallback(() => setPricingOpen(true), []);
  const closePricing = useCallback(() => setPricingOpen(false), []);

  const openFitChat = useCallback((jobId: number) => {
    setDrawerCardId(jobId);
    setDrawerTool(null);
    setChatView("chat");
    setChatOpen(true);
    setChatPulse(true);
    setFitChatNonce((n) => n + 1);
    window.setTimeout(() => setChatPulse(false), 2400);
  }, []);

  const { cards: kanbanCards, setCards: setKanbanCards, addJob, updateStage, removeJob } =
    useJobs(INITIAL_KANBAN_CARDS);

  const notifUnreadCount = NOTIFICATIONS.filter((n) => !notifRead[n.id] && n.unread).length;

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
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          headline = data?.headline ?? null;
          dbAvatarUrl = data?.avatarUrl ?? null;
          profileName = data?.name ?? null;
          profileEmail = data?.email ?? null;
          if (data?.impersonating?.active) {
            setImpersonation({
              active: true,
              name: data.impersonating.name,
              email: data.impersonating.email,
            });
          } else {
            setImpersonation({ active: false });
          }
        }
      } catch {}
      try {
        const res = await fetch("/api/admin");
        setIsAdmin(res.ok);
      } catch {}
      try {
        const res = await fetch("/api/staff/role");
        if (res.ok) {
          const data = await res.json();
          setUserRole(data.role ?? "USER");
        }
      } catch {}
      setUser({
        name: profileName ?? authUser.user_metadata?.full_name ?? authUser.email?.split("@")[0] ?? null,
        email: profileEmail ?? authUser.email!,
        avatarUrl: dbAvatarUrl ?? authUser.user_metadata?.avatar_url ?? null,
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
        openFitChat,
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
      }}
    >
      <ImpersonationBanner state={impersonation} />
      {children}
    </WorkspaceContext.Provider>
  );
}
