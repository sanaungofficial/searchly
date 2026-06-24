"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

export function AdminNav() {
  const pathname = usePathname();
  const tabs = [
    { label: "Dashboard", href: "/admin" },
    { label: "Clients", href: "/admin/clients" },
    { label: "Prompts", href: "/admin/prompts" },
    { label: "Company scans", href: "/admin/company-scans" },
  ];

  return (
    <div style={{ display: "inline-flex", gap: 0, border: border.line, marginLeft: 8 }}>
      {tabs.map((tab, i) => {
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "6px 14px",
              border: "none",
              borderRight: i < tabs.length - 1 ? border.line : undefined,
              background: active ? color.forest : surface.card,
              color: active ? color.gold : color.stone,
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
