"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScoutLabel } from "./scout-box";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";

const MARKET_SUBNAV = [
  { label: "Overview", path: "/market" },
  { label: "Skills", path: "/market/skills" },
  { label: "Companies", path: "/market/companies" },
  { label: "Signals", path: "/market/signals" },
] as const;

export function MarketShell({
  title,
  subtitle,
  children,
  toolbar,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
}) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const headerPad = isMobile ? "12px 16px 12px 56px" : "12px 28px";
  const contentPad = isMobile ? "24px 16px 40px 56px" : "32px 36px 48px";

  return (
    <div
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
      <div
        style={{
          padding: headerPad,
          borderBottom: border.line,
          background: surface.card,
          flexShrink: 0,
        }}
      >
        <ScoutLabel>Market</ScoutLabel>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontFamily: fontSans,
                fontSize: isMobile ? 22 : 26,
                fontWeight: 600,
                color: color.ink,
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  color: color.muted,
                  margin: "6px 0 0",
                  lineHeight: 1.5,
                  maxWidth: 560,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {toolbar}
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 14,
            overflowX: "auto",
            paddingBottom: 2,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {MARKET_SUBNAV.map(({ label, path }) => {
            const active = pathname === path;
            return (
              <Link
                key={path}
                href={path}
                style={{
                  flexShrink: 0,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: 600,
                  padding: isMobile ? "10px 14px" : "8px 14px",
                  minHeight: isMobile ? 44 : undefined,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                  color: active ? color.forest : color.muted,
                  background: active ? surface.inset : "transparent",
                  border: active ? border.line : "1px solid transparent",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: contentPad, maxWidth: 1120, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
