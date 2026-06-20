"use client";

import { useState } from "react";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { WorkspaceOpportunities, type DrawerTool } from "./workspace-opportunities";
import { WorkspaceProfile } from "./workspace-profile";
import { WorkspaceCoaching } from "./workspace-coaching";
import { WorkspaceNetwork } from "./workspace-network";
import { WorkspaceLive } from "./workspace-live";
import { ChatWidget } from "./chat-widget";
import { NOTIFICATIONS, INITIAL_KANBAN_CARDS, type KanbanCard, type Section } from "./workspace-data";

interface WorkspaceProps {
  onBackToOnboarding: () => void;
  onSignOut?: () => void;
}

export function ScoutWorkspace({ onBackToOnboarding, onSignOut }: WorkspaceProps) {
  const [activeSection, setActiveSection] = useState<Section>("opportunities");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifRead, setNotifRead] = useState<Record<number, boolean>>({});

  // Lifted state — shared between WorkspaceOpportunities and ChatWidget
  const [kanbanCards, setKanbanCards] = useState<KanbanCard[]>(INITIAL_KANBAN_CARDS);
  const [drawerCardId, setDrawerCardId] = useState<number | null>(null);
  const [drawerTool, setDrawerTool] = useState<DrawerTool>(null);

  const notifUnreadCount = NOTIFICATIONS.filter((n) => !notifRead[n.id] && n.unread).length;

  const navigate = (s: Section) => setActiveSection(s);
  const navigateNotif = (s: Section) => {
    setActiveSection(s);
    const allRead: Record<number, boolean> = {};
    NOTIFICATIONS.forEach((n) => (allRead[n.id] = true));
    setNotifRead(allRead);
  };

  const handleOpenTool = (jobId: number, tool: DrawerTool) => {
    setActiveSection("opportunities");
    setDrawerCardId(jobId);
    setDrawerTool(tool);
  };

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
      />
      {activeSection === "opportunities" && (
        <WorkspaceOpportunities
          onOpenLive={() => setActiveSection("live")}
          drawerCardId={drawerCardId}
          setDrawerCardId={setDrawerCardId}
          drawerTool={drawerTool}
          setDrawerTool={setDrawerTool}
          kanbanCards={kanbanCards}
          setKanbanCards={setKanbanCards}
        />
      )}
      {activeSection === "profile" && <WorkspaceProfile />}
      {activeSection === "coaching" && <WorkspaceCoaching />}
      {activeSection === "network" && <WorkspaceNetwork />}
      {activeSection === "live" && <WorkspaceLive />}

      {/* Floating chat widget — visible on every workspace section */}
      <ChatWidget
        kanbanCards={kanbanCards}
        currentJobId={drawerCardId}
        onOpenTool={handleOpenTool}
      />
    </div>
  );
}
