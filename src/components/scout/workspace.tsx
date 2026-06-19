"use client";

import { useState } from "react";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { WorkspaceOpportunities } from "./workspace-opportunities";
import { WorkspaceProfile } from "./workspace-profile";
import { WorkspaceCoaching } from "./workspace-coaching";
import { WorkspaceNetwork } from "./workspace-network";
import { WorkspaceLive } from "./workspace-live";
import { NOTIFICATIONS, type Section } from "./workspace-data";

interface WorkspaceProps {
  onBackToOnboarding: () => void;
}

export function ScoutWorkspace({ onBackToOnboarding }: WorkspaceProps) {
  const [activeSection, setActiveSection] = useState<Section>("opportunities");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifRead, setNotifRead] = useState<Record<number, boolean>>({});

  const notifUnreadCount = NOTIFICATIONS.filter((n) => !notifRead[n.id] && n.unread).length;

  const navigate = (s: Section) => setActiveSection(s);
  const navigateNotif = (s: Section) => {
    setActiveSection(s);
    const allRead: Record<number, boolean> = {};
    NOTIFICATIONS.forEach((n) => (allRead[n.id] = true));
    setNotifRead(allRead);
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F2EDE3" }}>
      <WorkspaceSidebar
        activeSection={activeSection}
        onNavigate={navigate}
        onBackToOnboarding={onBackToOnboarding}
        notifOpen={notifOpen}
        notifUnreadCount={notifUnreadCount}
        onToggleNotif={() => setNotifOpen((p) => !p)}
        onNavigateNotif={navigateNotif}
      />
      {activeSection === "opportunities" && (
        <WorkspaceOpportunities onOpenLive={() => setActiveSection("live")} />
      )}
      {activeSection === "profile" && <WorkspaceProfile />}
      {activeSection === "coaching" && <WorkspaceCoaching />}
      {activeSection === "network" && <WorkspaceNetwork />}
      {activeSection === "live" && <WorkspaceLive />}
    </div>
  );
}
