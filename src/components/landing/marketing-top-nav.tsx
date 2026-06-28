"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { KimchiBySecondLadder } from "@/components/scout/scout-box";
import { color, fontDisplay, fontSans, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  LANDING_JOIN_WAITLIST_LABEL,
  LANDING_NAV,
  LANDING_WAITLIST_URL,
} from "@/lib/landing-content";

export const MARKETING_TOP_NAV_HEIGHT = 64;
export const MARKETING_TOP_NAV_HEIGHT_MOBILE = 56;

function BurgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function navLinkStyle(active: boolean, navHeight: number, isMobile: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    background: "none",
    border: "none",
    borderBottom: active ? `2px solid ${color.forest}` : "2px solid transparent",
    padding: isMobile ? "0 10px" : "0 14px",
    height: navHeight,
    cursor: "pointer",
    fontFamily: fontSans,
    fontSize: isMobile ? T.caption : T.bodySm,
    fontWeight: active ? 600 : 500,
    color: active ? color.forest : color.muted,
    whiteSpace: "nowrap",
    flexShrink: 0,
    textDecoration: "none",
    transition: "color 0.15s",
    boxSizing: "border-box",
  };
}

function outlineBtnStyle(isMobile: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    padding: isMobile ? "6px 12px" : "8px 14px",
    fontFamily: fontSans,
    fontSize: isMobile ? T.caption : T.bodySm,
    fontWeight: 500,
    color: color.forest,
    textDecoration: "none",
    background: surface.page,
    border: "var(--scout-border)",
    whiteSpace: "nowrap",
  };
}

function primaryBtnStyle(isMobile: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    padding: isMobile ? "6px 14px" : "8px 16px",
    fontFamily: fontSans,
    fontSize: isMobile ? T.caption : T.bodySm,
    fontWeight: 600,
    color: color.gold,
    textDecoration: "none",
    background: color.forest,
    border: "var(--scout-border)",
    whiteSpace: "nowrap",
  };
}

function MobileDrawerLink({
  label,
  href,
  external,
  onClick,
}: {
  label: string;
  href: string;
  external?: boolean;
  onClick: () => void;
}) {
  const inner = (
    <span
      style={{
        display: "block",
        width: "calc(100% - 24px)",
        margin: "0 12px",
        textAlign: "left",
        padding: "10px 12px",
        border: "none",
        borderRadius: "var(--scout-radius)",
        background: "transparent",
        borderLeft: "3px solid transparent",
        color: color.stone,
        fontFamily: fontSans,
        fontSize: T.bodySm,
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} style={{ textDecoration: "none" }}>
        {inner}
      </a>
    );
  }

  if (href.startsWith("/")) {
    return (
      <Link href={href} onClick={onClick} style={{ textDecoration: "none" }}>
        {inner}
      </Link>
    );
  }

  return (
    <a href={href} onClick={onClick} style={{ textDecoration: "none" }}>
      {inner}
    </a>
  );
}

export function MarketingTopNav() {
  const pathname = usePathname();
  const isMobileHook = useIsMobile();
  const isMobile = isMobileHook;
  const navHeight = isMobile ? MARKETING_TOP_NAV_HEIGHT_MOBILE : MARKETING_TOP_NAV_HEIGHT;
  const horizontalPad = isMobile ? 16 : 28;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isRouteActive = (href: string) => href.startsWith("/") && pathname.startsWith(href);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen, isMobile]);

  useEffect(() => {
    if (!isMobile && mobileMenuOpen) setMobileMenuOpen(false);
  }, [isMobile, mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header
        style={{
          height: navHeight,
          flexShrink: 0,
          background: surface.page,
          borderBottom: "var(--scout-border)",
          boxSizing: "border-box",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 12 : 32,
            padding: `0 ${horizontalPad}px`,
            maxWidth: 1440,
            margin: "0 auto",
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            className="marketing-top-nav-burger"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="marketing-mobile-nav"
            style={{
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              padding: 0,
              border: "var(--scout-border)",
              borderRadius: "var(--scout-radius)",
              background: surface.page,
              color: color.forest,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <BurgerIcon />
          </button>

          <Link
            href="/"
            style={{
              textDecoration: "none",
              color: "inherit",
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "flex-start",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: fontDisplay,
                fontSize: isMobile ? 20 : 22,
                fontWeight: 500,
                color: color.forest,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              Kimchi
            </span>
            {!isMobile && <KimchiBySecondLadder fontSize={11} color={color.muted} marginTop={2} />}
          </Link>

          <nav
            className="marketing-top-nav-desktop-links"
            aria-label="Primary"
            style={{
              alignItems: "center",
              gap: isMobile ? 4 : 8,
              flex: 1,
              minWidth: 0,
            }}
          >
            {LANDING_NAV.map((item) =>
              item.href.startsWith("/") ? (
                <Link
                  key={item.href}
                  href={item.href}
                  style={navLinkStyle(isRouteActive(item.href), navHeight, isMobile)}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  style={navLinkStyle(false, navHeight, isMobile)}
                >
                  {item.label}
                </a>
              ),
            )}
          </nav>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? 8 : 10,
              flexShrink: 0,
              marginLeft: isMobile ? "auto" : undefined,
            }}
          >
            <Link href="/login" style={outlineBtnStyle(isMobile)}>
              Log In
            </Link>
            <a
              href={LANDING_WAITLIST_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={primaryBtnStyle(isMobile)}
            >
              {LANDING_JOIN_WAITLIST_LABEL}
            </a>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={closeMobileMenu}
            style={{
              position: "fixed",
              top: MARKETING_TOP_NAV_HEIGHT_MOBILE,
              left: 0,
              right: 0,
              bottom: 0,
              border: "none",
              padding: 0,
              background: "rgba(15, 24, 20, 0.35)",
              zIndex: 120,
              cursor: "pointer",
            }}
          />
          <aside
            id="marketing-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            style={{
              position: "fixed",
              top: MARKETING_TOP_NAV_HEIGHT_MOBILE,
              left: 0,
              bottom: 0,
              width: "min(300px, calc(100vw - 48px))",
              background: surface.card,
              borderRight: "var(--scout-border)",
              boxShadow: "4px 0 24px rgba(0,0,0,0.12)",
              zIndex: 125,
              display: "flex",
              flexDirection: "column",
              padding: "12px 0 24px",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              animation: "marketingNavSlideIn 0.2s ease both",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 16px 12px",
                marginBottom: 4,
                borderBottom: "var(--scout-border)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: fontSans,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: color.muted,
                }}
              >
                Menu
              </p>
              <button
                type="button"
                onClick={closeMobileMenu}
                aria-label="Close menu"
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 22,
                  lineHeight: 1,
                  color: color.muted,
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                ×
              </button>
            </div>

            <nav aria-label="Primary" style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
              {LANDING_NAV.map((item) => (
                <MobileDrawerLink
                  key={item.href}
                  label={item.label}
                  href={item.href}
                  external={item.href === LANDING_WAITLIST_URL}
                  onClick={closeMobileMenu}
                />
              ))}
            </nav>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "16px 16px 0",
                borderTop: "var(--scout-border)",
                marginTop: 12,
              }}
            >
              <Link href="/login" onClick={closeMobileMenu} style={{ ...outlineBtnStyle(true), width: "100%", boxSizing: "border-box" }}>
                Log In
              </Link>
              <a
                href={LANDING_WAITLIST_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMobileMenu}
                style={{ ...primaryBtnStyle(true), width: "100%", boxSizing: "border-box" }}
              >
                {LANDING_JOIN_WAITLIST_LABEL}
              </a>
            </div>
          </aside>
        </>
      )}

      <style>{`
        .marketing-top-nav-burger {
          display: none;
        }
        .marketing-top-nav-desktop-links {
          display: flex;
        }
        @media (max-width: 767px) {
          .marketing-top-nav-burger {
            display: inline-flex;
          }
          .marketing-top-nav-desktop-links {
            display: none !important;
          }
        }
        @keyframes marketingNavSlideIn {
          from { transform: translateX(-100%); opacity: 0.6; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
