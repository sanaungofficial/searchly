"use client";

import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { WorkspaceProfileTabBar, type ProfileTabItem } from "@/components/scout/workspace-profile-tab-bar";
import { isStaffPortalRole } from "@/lib/staff-portal";
import { border, surface } from "@/lib/typography";

const STAFF_TABS: ProfileTabItem[] = [
  { id: "home", label: "Dashboard", href: "/dashboard" },
  { id: "expert-profile", label: "Expert Profile", href: "/dashboard/expert-profile" },
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

  if (!isStaffPortalRole(userRole)) {
    return <>{children}</>;
  }

  const activeHref =
    pathname === "/dashboard"
      ? "/dashboard"
      : STAFF_TABS.find((t) => t.href !== "/dashboard" && pathname.startsWith(t.href))?.href ?? pathname;

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
      <div
        style={{
          padding: `${isMobile ? 12 : 12}px ${horizontalPad}px ${isMobile ? 12 : 12}px`,
          flexShrink: 0,
          borderBottom: border.line,
          background: surface.card,
        }}
      >
        <WorkspaceProfileTabBar
          tabs={STAFF_TABS}
          activeHref={activeHref}
          onNavigate={(href) => router.push(href)}
          isMobile={isMobile}
          variant="underline"
        />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}
