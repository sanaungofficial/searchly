"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AGGREGATOR_SOURCES,
  DATA_SOURCE_HIGHLIGHTS,
  DATA_SOURCE_STATS,
  EXTENDED_ATS_NAMES,
  FEATURED_ATS_PLATFORMS,
  type AtsPlatform,
} from "@/lib/data-sources";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";
import { EyeIcon } from "./workspace-icons";

function logoUrl(domain: string) {
  return `https://logo.clearbit.com/${domain}`;
}

function AtsLogoCard({ platform }: { platform: AtsPlatform }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: surface.card,
        border: border.line,
        borderRadius: 0,
        padding: "10px 8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
      }}
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl(platform.domain)}
          alt={platform.name}
          onError={() => setFailed(true)}
          style={{ maxHeight: 22, maxWidth: "90%", objectFit: "contain" }}
        />
      ) : (
        <span
          style={{
            fontFamily: fontSans,
            fontSize: 11,
            fontWeight: 700,
            color: platform.brandColor ?? color.forest,
            letterSpacing: "-0.02em",
          }}
        >
          {platform.name}
        </span>
      )}
    </div>
  );
}

function AggregatorBadge({ name }: { name: string }) {
  return (
    <span
      style={{
        fontFamily: fontSans,
        fontSize: 11,
        fontWeight: 600,
        color: "#9CA3AF",
        padding: "6px 12px",
        background: "#F9FAFB",
        border: "1px solid #E5E7EB",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </span>
  );
}

type Props = {
  /** Align popover to trigger edge */
  align?: "left" | "right";
  /** Compact trigger for dense headers */
  compact?: boolean;
};

export function DataSourcesPopover({ align = "right", compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, [clearCloseTimer]);

  const show = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label="How Kimchi sources job data"
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        onFocus={show}
        onBlur={scheduleClose}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: compact ? 4 : 6,
          padding: compact ? "6px 8px" : "7px 10px",
          background: open ? "rgba(26,58,47,0.06)" : "transparent",
          border: border.line,
          borderRadius: 0,
          cursor: "pointer",
          color: color.forest,
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 600,
          letterSpacing: "0.02em",
          transition: "background 0.15s",
        }}
      >
        <EyeIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
        {!compact && <span>Data sources</span>}
      </button>

      {open && (
        <div
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={scheduleClose}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            ...(align === "right" ? { right: 0 } : { left: 0 }),
            width: 380,
            maxWidth: "min(380px, calc(100vw - 32px))",
            zIndex: 120,
            background: surface.card,
            border: border.lineStrong,
            boxShadow: "4px 4px 0 rgba(17,17,17,0.08)",
            padding: "18px 18px 16px",
          }}
        >
          <p
            style={{
              margin: "0 0 4px",
              fontFamily: fontSans,
              fontSize: T.label,
              fontWeight: 700,
              color: color.muted,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            How we source jobs
          </p>
          <p
            style={{
              margin: "0 0 14px",
              fontFamily: fontSans,
              fontSize: T.bodySm,
              fontWeight: 600,
              color: color.forest,
              lineHeight: 1.45,
            }}
          >
            {DATA_SOURCE_STATS.careerPagesScanned} career pages · {DATA_SOURCE_STATS.atsPlatforms} ATS platforms · scanned multiple times daily
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {FEATURED_ATS_PLATFORMS.map((p) => (
              <AtsLogoCard key={p.domain} platform={p} />
            ))}
          </div>

          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              background: "rgba(196,87,74,0.04)",
              border: "1px solid rgba(196,87,74,0.12)",
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                fontFamily: fontSans,
                fontSize: 10,
                fontWeight: 700,
                color: color.muted,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                textAlign: "center",
              }}
            >
              Not sourced from aggregators
            </p>
            <div
              style={{
                position: "relative",
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                justifyContent: "center",
                padding: "4px 0",
              }}
            >
              {AGGREGATOR_SOURCES.map((s) => (
                <AggregatorBadge key={s.name} name={s.name} />
              ))}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: "-2px 8px",
                  borderTop: "2px solid rgba(196,87,74,0.45)",
                  transform: "rotate(-8deg)",
                  pointerEvents: "none",
                }}
              />
            </div>
            <p
              style={{
                margin: "10px 0 0",
                fontFamily: fontSans,
                fontSize: T.label,
                color: color.stone,
                textAlign: "center",
                lineHeight: 1.45,
              }}
            >
              Direct from company career pages & employer ATS
            </p>
          </div>

          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {DATA_SOURCE_HIGHLIGHTS.map((item) => (
              <li key={item.title} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: color.forest, fontWeight: 700, fontSize: 12, lineHeight: 1.5, flexShrink: 0 }}>✓</span>
                <div>
                  <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: color.ink }}>
                    {item.title}
                  </p>
                  <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: T.label, color: color.muted, lineHeight: 1.5 }}>
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <p
            style={{
              margin: "14px 0 0",
              paddingTop: 12,
              borderTop: border.line,
              fontFamily: fontSans,
              fontSize: 10,
              color: color.mutedLight,
              lineHeight: 1.55,
            }}
          >
            Also: {EXTENDED_ATS_NAMES.join(", ")}, and 10+ more ATS platforms.
          </p>
        </div>
      )}
    </div>
  );
}
