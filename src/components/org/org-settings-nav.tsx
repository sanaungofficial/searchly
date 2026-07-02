"use client";

import Link from "next/link";
import { color, fontSans, type as T } from "@/lib/typography";

const tabs = [
  { id: "dashboard", label: "Dashboard", href: (orgId: string) => `/org/${orgId}/dashboard`, adminOnly: false },
  { id: "clients", label: "Employees", href: (orgId: string) => `/org/${orgId}/settings/clients`, adminOnly: true },
  { id: "network", label: "Network inbox", href: (orgId: string) => `/org/${orgId}/settings/network`, adminOnly: false },
  { id: "contacts", label: "Contacts", href: (orgId: string) => `/org/${orgId}/contacts`, adminOnly: false },
] as const;

export type OrgNavTab = (typeof tabs)[number]["id"];

export { tabs as orgNavTabs };

export function OrgSettingsNav({
  orgId,
  active,
  isOrgAdmin = true,
}: {
  orgId: string;
  active?: OrgNavTab;
  isOrgAdmin?: boolean;
}) {
  const visibleTabs = tabs.filter((tab) => isOrgAdmin || !tab.adminOnly);

  return (
    <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
      {visibleTabs.map((tab) => {
        const isActive = active != null && tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href(orgId)}
            style={{
              fontFamily: fontSans,
              fontSize: T.bodySm,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? color.forest : color.muted,
              textDecoration: "none",
              padding: "8px 14px",
              borderRadius: "var(--scout-radius)",
              border: isActive ? "1px solid rgba(26,58,47,0.18)" : "1px solid transparent",
              background: isActive ? "rgba(26,58,47,0.06)" : "transparent",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
