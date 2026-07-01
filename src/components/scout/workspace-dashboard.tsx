"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { GrowthWelcomeModal } from "@/components/scout/growth-welcome-modal";
import { DashboardHomeTop } from "@/components/scout/dashboard-home-top";
import { WorkspaceContent, WorkspaceScroll } from "./workspace-content";
import { surface } from "@/lib/typography";
export function WorkspaceDashboard() {
  const isMobile = useIsMobile();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      setShowWelcome(true);
      params.delete("upgraded");
      const next = params.toString();
      const path = window.location.pathname + (next ? `?${next}` : "");
      window.history.replaceState({}, "", path);
    }
  }, []);

  return (
    <div
      className="bruddle"
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: surface.page,
        animation: "fadeIn 0.3s ease both",
      }}
    >
      <WorkspaceScroll>
        <WorkspaceContent>
          <DashboardHomeTop isMobile={isMobile} />
        </WorkspaceContent>
      </WorkspaceScroll>
      {showWelcome && <GrowthWelcomeModal onClose={() => setShowWelcome(false)} />}
    </div>
  );
}
