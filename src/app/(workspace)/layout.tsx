"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";
import { WorkspaceSidebar } from "@/components/scout/workspace-sidebar";
import { ChatWidget } from "@/components/scout/chat-widget";
import { VoiceAgentFloat } from "@/components/voice/voice-agent-float";
import { PricingModal } from "@/components/scout/pricing-modal";
import { MOBILE_TOP_BAR_HEIGHT } from "@/components/scout/workspace-mobile-top-bar";

function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const {
    user,
    isAdmin,
    userRole,
    authChecked,
    pricingOpen,
    openPricing,
    closePricing,
  } = useWorkspace();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (searchParams.get("pricing") === "1") {
      openPricing();
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, openPricing, router, pathname]);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };
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
        collapsed={collapsed}
        onToggle={() => setCollapsed((p) => !p)}
      />
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {/* Mobile hamburger — sits in left gutter of each page's top bar row */}
        {isMobile && collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            style={{
              position: "absolute",
              top: (MOBILE_TOP_BAR_HEIGHT - 36) / 2,
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
      <VoiceAgentFloat />
      <ChatWidget bottomStackOffset={112} />
      {pricingOpen && <PricingModal onClose={closePricing} />}
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
