"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";
import { WorkspaceTopNav } from "@/components/scout/workspace-top-nav";
import { KimchiAssistant } from "@/components/scout/kimchi-assistant";
import { PricingModal } from "@/components/scout/pricing-modal";
import { surface } from "@/lib/typography";

function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const {
    user,
    isAdmin,
    authChecked,
    pricingOpen,
    openPricing,
    closePricing,
  } = useWorkspace();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (searchParams.get("pricing") === "1") {
      openPricing();
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, openPricing, router, pathname]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!authChecked) {
    return <div style={{ height: "100vh", background: surface.page }} />;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        background: surface.page,
      }}
    >
      <WorkspaceTopNav isMobile={isMobile} user={user ?? undefined} isAdmin={isAdmin} />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
      <KimchiAssistant />
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
