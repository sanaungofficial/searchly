"use client";

import { Suspense } from "react";
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

  if (!authChecked) {
    return <div style={{ height: "100vh", background: "#F2EDE3" }} />;
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F2EDE3" }}>
      <WorkspaceSidebar user={user ?? undefined} isAdmin={isAdmin} userRole={userRole} />
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
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
