"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";
import { WorkspaceSidebar } from "@/components/scout/workspace-sidebar";
import { ChatWidget } from "@/components/scout/chat-widget";

function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const {
    user,
    isAdmin,
    userRole,
    authChecked,
    kanbanCards,
    drawerCardId,
    setDrawerCardId,
    drawerTool,
    setDrawerTool,
  } = useWorkspace();

  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!authChecked) {
    return <div style={{ height: "100vh", background: "#F7F5F2" }} />;
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F7F5F2" }}>
      <WorkspaceSidebar
        user={user ?? undefined}
        isAdmin={isAdmin}
        userRole={userRole}
        isMobile={isMobile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              zIndex: 50,
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "#1A3A2F",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 4,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
            aria-label="Open menu"
          >
            <span style={{ display: "block", width: 16, height: 1.5, background: "#E8D5A3", borderRadius: 2 }} />
            <span style={{ display: "block", width: 16, height: 1.5, background: "#E8D5A3", borderRadius: 2 }} />
            <span style={{ display: "block", width: 16, height: 1.5, background: "#E8D5A3", borderRadius: 2 }} />
          </button>
        )}
        {children}
      </div>
      <ChatWidget
        kanbanCards={kanbanCards}
        currentJobId={drawerCardId}
        onOpenTool={(jobId, tool) => {
          setDrawerCardId(jobId);
          setDrawerTool(tool as typeof drawerTool);
          router.push("/opportunities");
        }}
      />
    </div>
  );
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <Suspense>
        <WorkspaceShell>{children}</WorkspaceShell>
      </Suspense>
    </WorkspaceProvider>
  );
}
