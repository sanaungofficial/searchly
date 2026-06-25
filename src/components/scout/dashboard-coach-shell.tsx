"use client";

import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { WorkspaceProfileTabBar, type ProfileTabItem } from "@/components/scout/workspace-profile-tab-bar";
import { surface } from "@/lib/typography";

const COACH_TABS: ProfileTabItem[] = [
  { id: "home", label: "Dashboard", href: "/dashboard" },
  { id: "clients", label: "Clients", href: "/dashboard/clients" },
  { id: "bookings", label: "Bookings", href: "/dashboard/bookings" },
  { id: "live", label: "Live", href: "/dashboard/live" },
];

type Props = {
  children: React.ReactNode;
};

export function DashboardCoachShell({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { userRole } = useWorkspace();

  if (userRole !== "COACH") {
    return <>{children}</>;
  }

  const activeHref =
    pathname === "/dashboard"
      ? "/dashboard"
      : COACH_TABS.find((t) => t.href !== "/dashboard" && pathname.startsWith(t.href))?.href ?? pathname;

  const horizontalPad = isMobile ? 16 : 28;

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: surface.page,
      }}
    >
      <div style={{ padding: `${isMobile ? 12 : 16}px ${horizontalPad}px 0`, flexShrink: 0 }}>
        <WorkspaceProfileTabBar
          tabs={COACH_TABS}
          activeHref={activeHref}
          onNavigate={(href) => router.push(href)}
          isMobile={isMobile}
        />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}
