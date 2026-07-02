"use client";

import { useEffect, useState } from "react";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { color, fontMono, fontSans, type as T } from "@/lib/typography";

type PreviewMatch = {
  id: string;
  targetCompany: string;
  strengthScore: number;
  contact: {
    name: string | null;
    email: string;
    company: string | null;
  };
  knownBy: {
    name: string | null;
  };
};

const BADGE_COLORS = [
  { bg: "rgba(74,139,106,0.15)", color: color.forest },
  { bg: "rgba(37,99,235,0.12)", color: "#2563eb" },
  { bg: "rgba(124,58,237,0.12)", color: "#7c3aed" },
  { bg: "rgba(217,119,6,0.12)", color: "#b45309" },
  { bg: "rgba(220,38,38,0.1)", color: "#dc2626" },
];

function initialsForMatch(match: PreviewMatch): string {
  const name = match.contact.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const company = (match.contact.company ?? match.targetCompany).trim();
  return company.slice(0, 2).toUpperCase() || "?";
}

function matchTooltip(match: PreviewMatch): string {
  const contact = match.contact.name ?? match.contact.email;
  const company = match.contact.company ?? match.targetCompany;
  const owner = match.knownBy.name ?? "Org member";
  return `${contact} @ ${company} · via ${owner}`;
}

export function EmployeeIntroMatchPreviewStack({
  orgId,
  clientUserId,
  apiBase,
  targetCompanyCount,
  compact = false,
}: {
  orgId: string;
  clientUserId: string;
  apiBase: string;
  targetCompanyCount?: number;
  compact?: boolean;
}) {
  const [matches, setMatches] = useState<PreviewMatch[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `${apiBase}/clients/${clientUserId}/intro-matches?preview=true&limit=5`,
        );
        if (!res.ok) {
          if (!cancelled) {
            setMatches([]);
            setTotalCount(0);
          }
          return;
        }
        const data = (await res.json()) as {
          matches?: PreviewMatch[];
          totalCount?: number;
        };
        if (!cancelled) {
          setMatches(data.matches ?? []);
          setTotalCount(data.totalCount ?? data.matches?.length ?? 0);
        }
      } catch (e) {
        if (!cancelled) {
          setMatches([]);
          setTotalCount(0);
          void formatApiErrorMessage(e, "Could not load match preview.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, clientUserId, orgId]);

  if (targetCompanyCount === 0) {
    return (
      <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }} title="Add target employers first">
        No targets
      </span>
    );
  }

  if (loading) {
    return (
      <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>…</span>
    );
  }

  if (matches.length === 0) {
    return (
      <span
        style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}
        title="No cached intro matches — open employee to find matches"
      >
        —
      </span>
    );
  }

  const size = compact ? 24 : 28;
  const overlap = compact ? 8 : 10;

  return (
    <div
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      title={matches.map(matchTooltip).join("\n")}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        {matches.slice(0, 4).map((match, index) => {
          const palette = BADGE_COLORS[index % BADGE_COLORS.length]!;
          return (
            <span
              key={match.id}
              title={matchTooltip(match)}
              style={{
                width: size,
                height: size,
                borderRadius: 999,
                background: palette.bg,
                color: palette.color,
                border: "2px solid var(--scout-surface-card, #fff)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: fontMono,
                fontSize: compact ? 9 : 10,
                fontWeight: 700,
                marginLeft: index === 0 ? 0 : -overlap,
                position: "relative",
                zIndex: matches.length - index,
                flexShrink: 0,
              }}
            >
              {initialsForMatch(match)}
            </span>
          );
        })}
      </div>
      {totalCount > 4 && (
        <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
          +{totalCount - 4}
        </span>
      )}
    </div>
  );
}
