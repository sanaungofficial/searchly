"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav() {
  const pathname = usePathname();
  const tabs = [
    { label: "Dashboard", href: "/admin" },
    { label: "Prompts", href: "/admin/prompts" },
  ];
  return (
    <div className="flex items-center gap-1">
      {tabs.map((tab) => {
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "var(--font-dm-sans)",
              fontWeight: active ? 600 : 400,
              color: active ? "#1a3a2f" : "#7a7268",
              background: active ? "rgba(26,58,47,0.07)" : "transparent",
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
