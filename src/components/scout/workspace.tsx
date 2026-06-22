"use client";

import { useState, useCallback } from "react";
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
const BETA_SECTIONS: Section[] = ["coaching", "network", "live"];

export function ScoutWorkspace({ onBackToOnboarding, onSignOut, user, isAdmin, userRole }: WorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showBeta = process.env.NEXT_PUBLIC_SHOW_BETA === "true";
  const rawTab = searchParams.get("tab") as Section | null;
  const resolvedTab: Section = rawTab && VALID_SECTIONS.includes(rawTab) ? rawTab : "opportunities";
  const activeSection: Section = !showBeta && BETA_SECTIONS.includes(resolvedTab) ? "opportunities" : resolvedTab;

  type OppSubtab = "discover" | "companies" | "pipeline";
  const VALID_SUBTABS: OppSubtab[] = ["discover", "companies", "pipeline"];
  const rawSubtab = searchParams.get("subtab") as OppSubtab | null;
  const activeSubtab: OppSubtab = rawSubtab && VALID_SUBTABS.includes(rawSubtab) ? rawSubtab : "discover";
  const setSubtab = useCallback((t: OppSubtab) => {
    router.push(`/?tab=opportunities&subtab=${t}`);
  }, [router]);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifRead, setNotifRead] = useState<Record<number, boolean>>({});

  const { cards: kanbanCards, setCards: setKanbanCards, addJob, updateStage, removeJob } = useJobs(INITIAL_KANBAN_CARDS);
  const [drawerCardId, setDrawerCardId] = useState<number | null>(null);
  const [drawerTool, setDrawerTool] = useState<DrawerTool>(null);

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
      />
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
          removeJob={removeJob}
          activeSubtab={activeSubtab}
          setSubtab={setSubtab}
        />
      )}
      {activeSection === "profile" && <WorkspaceProfile />}
      {showBeta && activeSection === "coaching" && <WorkspaceCoaching />}
      {showBeta && activeSection === "network" && <WorkspaceNetwork />}
      {showBeta && activeSection === "live" && <WorkspaceLive />}
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
