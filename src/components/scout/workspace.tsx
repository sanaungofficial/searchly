"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { WorkspaceOpportunities, type DrawerTool } from "./workspace-opportunities";
import { WorkspaceProfile } from "./workspace-profile";
import { WorkspaceCoaching } from "./workspace-coaching";
import { WorkspaceNetwork } from "./workspace-network";
import { WorkspaceLive } from "./workspace-live";
import { WorkspaceAdmin } from "./workspace-admin";
import { WorkspaceCoach } from "./workspace-coach";
import { ChatWidget } from "./chat-widget";
import { NOTIFICATIONS, INITIAL_KANBAN_CARDS, type Section } from "./workspace-data";
import { useJobs } from "@/hooks/useJobs";

interface WorkspaceProps {
  onBackToOnboarding: () => void;
  onSignOut?: () => void;
  isAdmin?: boolean;
  userRole?: string;
  user?: {
    name: string | null;
    email: string;
    avatarUrl: string | null;
    headline?: string | null;
  };
}

const VALID_SECTIONS: Section[] = ["opportunities", "profile", "coaching", "network", "live", "admin", "clients"];

export function ScoutWorkspace({ onBackToOnboarding, onSignOut, user, isAdmin, userRole }: WorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") as Section | null;
  const activeSection: Section = rawTab && VALID_SECTIONS.includes(rawTab) ? rawTab : "opportunities";

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifRead, setNotifRead] = useState<Record<number, boolean>>({});

  const { cards: kanbanCards, setCards: setKanbanCards, addJob, updateStage } = useJobs(INITIAL_KANBAN_CARDS);
  const [drawerCardId, setDrawerCardId] = useState<number | null>(null);
  const [drawerTool, setDrawerTool] = useState<DrawerTool>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const notifUnreadCount = NOTIFICATIONS.filter((n) => !notifRead[n.id] && n.unread).length;

  const navigate = useCallback((s: Section) => {
    router.push(`/?tab=${s}`);
  }, [router]);

  const navigateNotif = useCallback((s: Section) => {
    router.push(`/?tab=${s}`);
    const allRead: Record<number, boolean> = {};
    NOTIFICATIONS.forEach((n) => (allRead[n.id] = true));
    setNotifRead(allRead);
  }, [router]);

  const handleOpenTool = useCallback((jobId: number, tool: DrawerTool) => {
    router.push("/?tab=opportunities");
    setDrawerCardId(jobId);
    setDrawerTool(tool);
  }, [router]);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F2EDE3" }}>
      <WorkspaceSidebar
        activeSection={activeSection}
        onNavigate={navigate}
        onBackToOnboarding={onBackToOnboarding}
        onSignOut={onSignOut}
        notifOpen={notifOpen}
        notifUnreadCount={notifUnreadCount}
        onToggleNotif={() => setNotifOpen((p) => !p)}
        onNavigateNotif={navigateNotif}
        user={user}
        isAdmin={isAdmin}
        userRole={userRole}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Hamburger button — fixed top-left on mobile when sidebar is closed */}
      {isMobile && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: "fixed",
            top: 14,
            left: 14,
            zIndex: 900,
            width: 38,
            height: 38,
            borderRadius: 8,
            background: "#1A3A2F",
            border: "none",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: 0,
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
          aria-label="Open menu"
        >
          <span style={{ width: 15, height: 1.5, background: "#E8D5A3", borderRadius: 1, display: "block" }} />
          <span style={{ width: 15, height: 1.5, background: "#E8D5A3", borderRadius: 1, display: "block" }} />
          <span style={{ width: 15, height: 1.5, background: "#E8D5A3", borderRadius: 1, display: "block" }} />
        </button>
      )}

      {activeSection === "opportunities" && (
        <WorkspaceOpportunities
          onOpenLive={() => navigate("live")}
          drawerCardId={drawerCardId}
          setDrawerCardId={setDrawerCardId}
          drawerTool={drawerTool}
          setDrawerTool={setDrawerTool}
          kanbanCards={kanbanCards}
          setKanbanCards={setKanbanCards}
          addJob={addJob}
          updateStage={updateStage}
        />
      )}
      {activeSection === "profile" && <WorkspaceProfile />}
      {activeSection === "coaching" && <WorkspaceCoaching />}
      {activeSection === "network" && <WorkspaceNetwork />}
      {activeSection === "live" && <WorkspaceLive />}
      {activeSection === "admin" && isAdmin && <WorkspaceAdmin />}
      {activeSection === "clients" && (userRole === "COACH" || userRole === "RECRUITER" || userRole === "ADMIN") && <WorkspaceCoach />}

      <ChatWidget
        kanbanCards={kanbanCards}
        currentJobId={drawerCardId}
        onOpenTool={handleOpenTool}
      />
    </div>
  );
}
