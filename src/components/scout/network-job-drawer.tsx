"use client";

import { useLayoutEffect, useState } from "react";
import type { NetworkJobListing } from "@/lib/network-job";
import { cardTitle } from "@/lib/network-job";
import {
  formatRawFieldLabel,
  isLikelyHtml,
  orderedRawFieldEntries,
  TE_HTML_FIELD_KEYS,
} from "@/lib/network-job-raw-display";
import { ScoutBox, ScoutLabel } from "./scout-box";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

interface NetworkJobDrawerProps {
  job: NetworkJobListing;
  onClose: () => void;
  onAddToPipeline?: () => void | Promise<void>;
  addingToPipeline?: boolean;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ ...displayTitleStyle(T.heading), margin: "0 0 12px" }}>{children}</h3>;
}

function RawValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight }}>—</span>;
  }

  if (typeof value === "string") {
    const renderAsHtml = TE_HTML_FIELD_KEYS.has(fieldKey) || isLikelyHtml(value);
    if (renderAsHtml) {
      return (
        <div
          className="te-network-job-html"
          style={{
            fontFamily: fontSans,
            fontSize: T.bodySm,
            color: color.stone,
            lineHeight: 1.75,
          }}
          dangerouslySetInnerHTML={{ __html: value }}
        />
      );
    }
    return (
      <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
        {value}
      </span>
    );
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return (
      <span style={{ fontFamily: fontMono, fontSize: T.bodySm, color: color.stone }}>
        {String(value)}
      </span>
    );
  }

  return (
    <pre
      style={{
        margin: 0,
        padding: "12px 14px",
        background: surface.inset,
        border: border.line,
        fontFamily: fontMono,
        fontSize: T.caption,
        color: color.stone,
        lineHeight: 1.55,
        overflowX: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function RawFieldRow({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  const isHtml =
    typeof value === "string" && (TE_HTML_FIELD_KEYS.has(fieldKey) || isLikelyHtml(value));

  return (
    <div
      style={{
        padding: "14px 0",
        borderBottom: border.line,
        display: "grid",
        gridTemplateColumns: isHtml ? "1fr" : "minmax(140px, 220px) 1fr",
        gap: isHtml ? 8 : 16,
        alignItems: "start",
      }}
    >
      <div>
        <p
          style={{
            fontFamily: fontMono,
            fontSize: T.label,
            fontWeight: 600,
            color: color.forest,
            margin: 0,
            letterSpacing: "0.02em",
            wordBreak: "break-word",
          }}
        >
          {formatRawFieldLabel(fieldKey)}
        </p>
      </div>
      <RawValue fieldKey={fieldKey} value={value} />
    </div>
  );
}

export function NetworkJobDrawer({
  job,
  onClose,
  onAddToPipeline,
  addingToPipeline = false,
}: NetworkJobDrawerProps) {
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => {
    setVisible(true);
  }, []);

  const entries = orderedRawFieldEntries(job.raw);
  const title = cardTitle(job);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 210 }} />
      <div
        style={{
          position: "fixed",
          top: 8,
          right: 8,
          bottom: 8,
          width: "min(960px, calc(100vw - 16px))",
          maxWidth: "calc(100vw - 16px)",
          background: surface.inset,
          borderRadius: 0,
          overflow: "hidden",
          zIndex: 211,
          boxShadow: "3px 3px 0 rgba(17,17,17,0.08)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "14px 28px",
            background: surface.card,
            borderBottom: border.line,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 24,
              color: color.mutedLight,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
          <div>
            <ScoutLabel>Top Echelon network job · all fields as returned</ScoutLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "4px 0 0" }}>
              {title}
            </p>
          </div>
          <div style={{ marginLeft: "auto" }}>
            {onAddToPipeline && (
              <button
                type="button"
                onClick={() => void onAddToPipeline()}
                disabled={addingToPipeline}
                style={{
                  padding: "10px 20px",
                  background: addingToPipeline ? "rgba(26,58,47,0.35)" : color.forest,
                  color: color.gold,
                  border: border.lineStrong,
                  borderRadius: 0,
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  fontWeight: 700,
                  cursor: addingToPipeline ? "default" : "pointer",
                }}
              >
                {addingToPipeline ? "Adding…" : "Add to pipeline"}
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px 40px" }}>
          <ScoutBox padding={20} style={{ marginBottom: 20, background: surface.card }}>
            <SectionTitle>All fields ({entries.length})</SectionTitle>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.6, margin: "0 0 16px" }}>
              Values are shown exactly as Top Echelon returns them. HTML fields (<code style={{ fontFamily: fontMono }}>description</code>,{" "}
              <code style={{ fontFamily: fontMono }}>comments</code>, etc.) render with the same markup recruiters entered in Big Biller.
              Nested objects are shown as JSON without flattening.
            </p>
            <div>
              {entries.map(([fieldKey, value]) => (
                <RawFieldRow key={fieldKey} fieldKey={fieldKey} value={value} />
              ))}
            </div>
          </ScoutBox>
        </div>
      </div>
    </>
  );
}
