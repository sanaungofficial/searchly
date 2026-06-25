"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";
import type { SumbleBriefCache } from "@/lib/sumble-brief-cache";

type AccessPayload = {
  allowed: boolean;
  configured: boolean;
  isAdmin: boolean;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function CompanySumbleBriefPanel({
  companyId,
  companyName,
  initialBrief,
  onBriefUpdated,
}: {
  companyId: string;
  companyName: string;
  initialBrief?: SumbleBriefCache | null;
  onBriefUpdated?: (brief: SumbleBriefCache) => void;
}) {
  const [access, setAccess] = useState<AccessPayload | null>(null);
  const [brief, setBrief] = useState<SumbleBriefCache | null>(initialBrief ?? null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBrief(initialBrief ?? null);
  }, [initialBrief, companyId]);

  useEffect(() => {
    let cancelled = false;
    setLoadingAccess(true);
    fetch("/api/companies/sumble-brief/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AccessPayload | null) => {
        if (!cancelled && data) setAccess(data);
      })
      .catch(() => {
        if (!cancelled) setAccess({ allowed: false, configured: false, isAdmin: false });
      })
      .finally(() => {
        if (!cancelled) setLoadingAccess(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const generate = useCallback(
    async (refresh = false) => {
      setGenerating(true);
      setError(null);
      try {
        const url = refresh
          ? `/api/companies/${companyId}/sumble-brief?refresh=1`
          : `/api/companies/${companyId}/sumble-brief`;
        const res = await fetch(url, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Could not generate intelligence brief.");
          return;
        }
        const next = data.brief as SumbleBriefCache;
        setBrief(next);
        onBriefUpdated?.(next);
      } catch {
        setError("Network error — could not generate intelligence brief.");
      } finally {
        setGenerating(false);
      }
    },
    [companyId, onBriefUpdated],
  );

  if (loadingAccess) {
    return (
      <ScoutBox style={{ marginBottom: 16 }}>
        <ScoutLabel>Intelligence brief</ScoutLabel>
        <div style={{ marginTop: 12, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>Loading…</div>
      </ScoutBox>
    );
  }

  const locked = !access?.allowed;

  if (locked) {
    return (
      <ScoutBox style={{ marginBottom: 16 }}>
        <ScoutLabel>Intelligence brief</ScoutLabel>
        <div
          style={{
            marginTop: 12,
            padding: "14px 16px",
            background: surface.inset,
            border: border.line,
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1, opacity: 0.45 }} aria-hidden>🔒</span>
          <div>
            <div style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, marginBottom: 4 }}>
              Enterprise feature
            </div>
            <div style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55 }}>
              Full company intelligence briefs — account context, teams, contacts, and recent changes for interview prep — are included with enterprise coaching.
            </div>
          </div>
        </div>
      </ScoutBox>
    );
  }

  if (!access?.configured) {
    return (
      <ScoutBox style={{ marginBottom: 16 }}>
        <ScoutLabel>Intelligence brief</ScoutLabel>
        <div style={{ marginTop: 12, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.5 }}>
          Intelligence briefs are not configured on this environment yet.
        </div>
      </ScoutBox>
    );
  }

  return (
    <ScoutBox style={{ marginBottom: 16 }}>
      <ScoutLabel>Intelligence brief</ScoutLabel>
      <div style={{ marginTop: 12 }}>
        {!brief ? (
          <>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.6, margin: "0 0 14px 0" }}>
              Generate a full research brief for <strong>{companyName}</strong> — account angle, relevant contacts, technology signals, team structure, and recent changes. Built for interview prep and deep company research.
            </p>
            <ScoutPrimaryBtn onClick={() => generate(false)} disabled={generating}>
              {generating ? "Preparing brief…" : "Generate intelligence brief"}
            </ScoutPrimaryBtn>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 600, color: color.ink, lineHeight: 1.35 }}>
                  {brief.title}
                </div>
                <div style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, marginTop: 4 }}>
                  Updated {timeAgo(brief.fetchedAt)}
                  {brief.organizationName && brief.organizationName !== companyName ? (
                    <span> · Matched as {brief.organizationName}</span>
                  ) : null}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a
                  href={brief.sumbleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, textDecoration: "none" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = color.forest;
                    e.currentTarget.style.textDecoration = "underline";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = color.muted;
                    e.currentTarget.style.textDecoration = "none";
                  }}
                >
                  Open full brief ↗
                </a>
              </div>
            </div>

            <div
              style={{
                background: surface.inset,
                border: border.line,
                padding: "16px 18px",
                maxHeight: 420,
                overflowY: "auto",
              }}
              className="sumble-brief-markdown"
            >
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h3 style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 700, color: color.ink, margin: "0 0 10px 0" }}>{children}</h3>
                  ),
                  h2: ({ children }) => (
                    <h4 style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.forest, margin: "18px 0 8px 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{children}</h4>
                  ),
                  h3: ({ children }) => (
                    <h5 style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "14px 0 6px 0" }}>{children}</h5>
                  ),
                  p: ({ children }) => (
                    <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.65, margin: "0 0 10px 0" }}>{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.6, margin: "0 0 10px 0", paddingLeft: 20 }}>{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.6, margin: "0 0 10px 0", paddingLeft: 20 }}>{children}</ol>
                  ),
                  li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: color.forest }}>
                      {children}
                    </a>
                  ),
                  strong: ({ children }) => <strong style={{ fontWeight: 600, color: color.ink }}>{children}</strong>,
                }}
              >
                {brief.body}
              </ReactMarkdown>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <ScoutSecondaryBtn onClick={() => generate(true)} disabled={generating}>
                {generating ? "Refreshing…" : "↻ Refresh brief"}
              </ScoutSecondaryBtn>
              {access?.isAdmin && (
                <span style={{ fontFamily: fontSans, fontSize: 12, color: color.muted }}>Admin · refresh generates a new brief</span>
              )}
            </div>
          </>
        )}

        {error && (
          <div style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#dc2626", marginTop: 10, lineHeight: 1.45 }}>
            {error}
          </div>
        )}

        {generating && brief && (
          <div style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, marginTop: 8 }}>
            This can take up to a minute while the brief is prepared…
          </div>
        )}
      </div>
    </ScoutBox>
  );
}
