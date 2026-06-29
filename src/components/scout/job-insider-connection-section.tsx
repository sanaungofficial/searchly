"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  InsiderConnectionBucket,
  InsiderConnectionsResult,
  SumblePersonPreview,
} from "@/lib/sumble/types";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { fontSans, color, border, surface, type as T } from "@/lib/typography";
import { ScoutBox } from "./scout-box";
import { useIsMobile } from "@/hooks/use-mobile";

const THEME: Record<
  InsiderConnectionBucket["theme"],
  { border: string; bg: string; avatar: string; accent: string; topBar: string }
> = {
  green: {
    border: "rgba(74,139,106,0.25)",
    bg: "#fff",
    avatar: "#4A8B6A",
    accent: color.forest,
    topBar: "#4A8B6A",
  },
  teal: {
    border: "rgba(45,125,118,0.25)",
    bg: "#fff",
    avatar: "#2D7D76",
    accent: "#2D7D76",
    topBar: "#2D7D76",
  },
  blue: {
    border: "rgba(59,130,246,0.25)",
    bg: "#fff",
    avatar: "#3B82F6",
    accent: "#2563EB",
    topBar: "#3B82F6",
  },
  purple: {
    border: "rgba(139,92,246,0.25)",
    bg: "#fff",
    avatar: "#8B5CF6",
    accent: "#7C3AED",
    topBar: "#8B5CF6",
  },
};

type PlaceholderBucket = {
  id: string;
  title: string;
  theme: InsiderConnectionBucket["theme"];
  description: string;
};

const PLACEHOLDER_BUCKETS: PlaceholderBucket[] = [
  {
    id: "beyond",
    title: "Beyond Your Network",
    theme: "green",
    description: "Decision makers & team members at this company",
  },
  {
    id: "past_companies",
    title: "From Your Previous Company",
    theme: "blue",
    description: "People who share a past employer with you",
  },
  {
    id: "school",
    title: "From Your School",
    theme: "purple",
    description: "Alumni from your school who work here",
  },
];

const CONNECTION_SLOTS: { id: string; placeholder: PlaceholderBucket }[] = [
  { id: "beyond", placeholder: PLACEHOLDER_BUCKETS[0]! },
  { id: "past_companies", placeholder: PLACEHOLDER_BUCKETS[1]! },
  { id: "school", placeholder: PLACEHOLDER_BUCKETS[2]! },
];

function bucketForSlot(
  slotId: string,
  displayBuckets: InsiderConnectionBucket[],
): InsiderConnectionBucket | null {
  if (slotId === "beyond") {
    return (
      displayBuckets.find(
        (b) => b.id === "decision_makers" || b.title === "Beyond Your Network",
      ) ?? null
    );
  }
  return displayBuckets.find((b) => b.id === slotId) ?? null;
}

function emptyBucketForSlot(
  slotId: string,
  placeholder: PlaceholderBucket,
): InsiderConnectionBucket {
  return {
    id: slotId as InsiderConnectionBucket["id"],
    title: placeholder.title,
    subtitle: placeholder.description,
    theme: placeholder.theme,
    people: [],
    linkedinSearchUrl: "",
    totalCount: 0,
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function AvatarStack({
  people,
  theme,
}: {
  people: SumblePersonPreview[];
  theme: InsiderConnectionBucket["theme"];
}) {
  const colors = THEME[theme];
  const shown = people.slice(0, 5);
  return (
    <div style={{ display: "flex", alignItems: "center", minHeight: 36 }}>
      {shown.map((person, index) => (
        <span
          key={`${person.name}-${index}`}
          title={person.name}
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: colors.avatar,
            color: "#fff",
            fontFamily: fontSans,
            fontSize: 13,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #fff",
            marginLeft: index === 0 ? 0 : -10,
            zIndex: shown.length - index,
            position: "relative",
          }}
        >
          {initials(person.name)}
        </span>
      ))}
    </div>
  );
}

function PlaceholderCard({
  bucket,
  onView,
  loading,
}: {
  bucket: PlaceholderBucket;
  onView: () => void;
  loading: boolean;
}) {
  const colors = THEME[bucket.theme];

  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 180,
        border: `1px solid ${colors.border}`,
        borderRadius: "var(--scout-radius)",
        overflow: "hidden",
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ height: 4, background: colors.topBar }} />
      <div
        style={{
          padding: "14px 16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flex: 1,
        }}
      >
        <p
          style={{
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 700,
            color: colors.accent,
            margin: 0,
            letterSpacing: "0.02em",
          }}
        >
          {bucket.title}
        </p>

        <p
          style={{
            fontFamily: fontSans,
            fontSize: T.caption,
            color: color.muted,
            margin: 0,
            lineHeight: 1.45,
          }}
        >
          {bucket.description}
        </p>

        <button
          type="button"
          onClick={onView}
          disabled={loading}
          style={{
            alignSelf: "flex-start",
            marginTop: "auto",
            padding: "7px 14px",
            background: "#fff",
            border: border.line,
            borderRadius: "var(--scout-radius)",
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            color: color.stone,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Loading…" : "View"}
        </button>
      </div>
    </div>
  );
}

function ConnectionCard({
  bucket,
  onView,
}: {
  bucket: InsiderConnectionBucket;
  onView: () => void;
}) {
  const colors = THEME[bucket.theme];
  const lead = bucket.people[0];
  const others = Math.max(0, bucket.totalCount - 1);

  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 180,
        border: `1px solid ${colors.border}`,
        borderRadius: "var(--scout-radius)",
        overflow: "hidden",
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ height: 4, background: colors.topBar }} />
      <div
        style={{
          padding: "14px 16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flex: 1,
        }}
      >
        <p
          style={{
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 700,
            color: colors.accent,
            margin: 0,
            letterSpacing: "0.02em",
          }}
        >
          {bucket.title}
        </p>

        {lead ? (
          <>
            <AvatarStack people={bucket.people} theme={bucket.theme} />
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  fontWeight: 600,
                  color: color.stone,
                  margin: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {lead.name}
                {others > 0
                  ? ` & ${others} connection${others === 1 ? "" : "s"}`
                  : ""}
              </p>
              {lead.contextLabel && (
                <p
                  style={{
                    fontFamily: fontSans,
                    fontSize: T.caption,
                    color: colors.accent,
                    margin: "2px 0 0",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {lead.contextLabel}
                </p>
              )}
            </div>
          </>
        ) : (
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.muted,
              margin: 0,
              lineHeight: 1.45,
            }}
          >
            No matches yet
          </p>
        )}

        <button
          type="button"
          onClick={onView}
          style={{
            alignSelf: "flex-start",
            marginTop: "auto",
            padding: "7px 14px",
            background: "#fff",
            border: border.line,
            borderRadius: "var(--scout-radius)",
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            color: color.stone,
            cursor: "pointer",
          }}
        >
          View
        </button>
      </div>
    </div>
  );
}

function PersonRow({
  person,
  companyName,
  jobId,
  withClientScope,
  onSaved,
}: {
  person: SumblePersonPreview;
  companyName: string;
  jobId: string | null;
  withClientScope: (path: string) => string;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        withClientScope("/api/jobs/insider-connections/save-contact"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: person.name,
            title: person.title,
            company: companyName,
            linkedinUrl: person.linkedinUrl,
            email: person.email,
            jobId,
            role: "insider_connection",
          }),
        },
      );
      if (res.ok) {
        setSaved(true);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderBottom: border.line,
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: color.forest,
          color: color.gold,
          fontFamily: fontSans,
          fontSize: 14,
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {initials(person.name)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: fontSans,
            fontSize: T.bodySm,
            fontWeight: 600,
            color: color.stone,
            margin: 0,
          }}
        >
          {person.name}
        </p>
        {person.title && (
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.muted,
              margin: "2px 0 0",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {person.title}
          </p>
        )}
        {person.contextLabel && (
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.forest,
              margin: "2px 0 0",
            }}
          >
            {person.contextLabel}
          </p>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {person.linkedinUrl && (
          <a
            href={person.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${person.name} on LinkedIn`}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: border.line,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: color.forest,
              textDecoration: "none",
              fontFamily: fontSans,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            in
          </a>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || saved}
          title="Save to CRM"
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: border.line,
            background: saved ? "rgba(74,139,106,0.12)" : "#fff",
            cursor: saving || saved ? "default" : "pointer",
            fontSize: 14,
          }}
        >
          {saved ? "✓" : saving ? "…" : "☆"}
        </button>
      </div>
    </div>
  );
}

function BucketModal({
  bucket,
  companyName,
  jobId,
  withClientScope,
  onClose,
}: {
  bucket: InsiderConnectionBucket;
  companyName: string;
  jobId: string | null;
  withClientScope: (path: string) => string;
  onClose: () => void;
}) {
  const colors = THEME[bucket.theme];

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 12000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          maxHeight: "min(80vh, 720px)",
          overflow: "auto",
          background: surface.card,
          border: border.lineStrong,
          borderRadius: "var(--scout-radius)",
          padding: "22px 22px 18px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.body,
                fontWeight: 700,
                color: color.stone,
                margin: 0,
              }}
            >
              {bucket.title}
            </p>
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.caption,
                color: color.muted,
                margin: "4px 0 0",
              }}
            >
              {bucket.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
              color: color.muted,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <a
          href={bucket.linkedinSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            textAlign: "center",
            padding: "12px 16px",
            marginBottom: 16,
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: "var(--scout-radius)",
            fontFamily: fontSans,
            fontSize: T.bodySm,
            fontWeight: 600,
            color: colors.accent,
            textDecoration: "none",
          }}
        >
          Find more connections on LinkedIn ↗
        </a>

        {bucket.people.length === 0 ? (
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.bodySm,
              color: color.muted,
              margin: 0,
            }}
          >
            No preview contacts returned — use LinkedIn search for the full
            list.
          </p>
        ) : (
          bucket.people.map((person) => (
            <PersonRow
              key={`${person.personId ?? person.name}-${person.linkedinUrl ?? ""}`}
              person={person}
              companyName={companyName}
              jobId={jobId}
              withClientScope={withClientScope}
              onSaved={() => {}}
            />
          ))
        )}
      </div>
    </div>
  );
}

export type JobInsiderConnectionSectionProps = {
  companyName: string;
  jobTitle: string;
  companyWebsite?: string | null;
  linkedinUrl?: string | null;
  jobTeam?: string | null;
  jobId?: string | null;
  withClientScope: (path: string) => string;
};

export function JobInsiderConnectionSection({
  companyName,
  jobTitle,
  companyWebsite,
  linkedinUrl,
  jobTeam,
  jobId,
  withClientScope,
}: JobInsiderConnectionSectionProps) {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InsiderConnectionsResult | null>(null);
  const [activeBucket, setActiveBucket] =
    useState<InsiderConnectionBucket | null>(null);
  const [pendingBucketId, setPendingBucketId] = useState<string | null>(null);
  const [linkedinInput, setLinkedinInput] = useState("");
  const [emailLookup, setEmailLookup] = useState<{
    email: string | null;
    name: string | null;
    error?: string;
  } | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        withClientScope("/api/jobs/insider-connections"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName,
            jobTitle,
            companyWebsite,
            linkedinUrl,
            jobTeam,
          }),
        },
      );
      const json = (await res.json()) as InsiderConnectionsResult;
      setData(json);
      return json;
    } catch {
      const fallback: InsiderConnectionsResult = {
        configured: false,
        companyName,
        sumbleOrganizationId: null,
        buckets: [],
        error: "Could not load connections.",
      };
      setData(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [
    companyName,
    jobTitle,
    companyWebsite,
    linkedinUrl,
    jobTeam,
    withClientScope,
  ]);

  const displayBuckets = useMemo(() => {
    const buckets = data?.buckets ?? [];
    if (!buckets.length) return [];

    const beyond = buckets.find((b) => b.id === "decision_makers");
    const past = buckets.find((b) => b.id === "past_companies");
    const school = buckets.find((b) => b.id === "school");
    const team = buckets.find((b) => b.id === "team");

    const result: InsiderConnectionBucket[] = [];

    if (beyond) {
      const merged: InsiderConnectionBucket = {
        ...beyond,
        title: "Beyond Your Network",
        theme: "green",
      };
      if (team && team.people.length > 0) {
        const seenIds = new Set(
          merged.people.map((p) => p.personId ?? p.name),
        );
        const extra = team.people.filter(
          (p) => !seenIds.has(p.personId ?? p.name),
        );
        merged.people = [...merged.people, ...extra].slice(0, 5);
        merged.totalCount = Math.max(
          merged.totalCount + extra.length,
          merged.people.length,
        );
      }
      result.push(merged);
    } else if (team) {
      result.push({ ...team, title: "Beyond Your Network", theme: "green" });
    }

    if (past) {
      result.push({
        ...past,
        title: "From Your Previous Company",
        theme: "blue",
      });
    }

    if (school) {
      result.push({ ...school, title: "From Your School", theme: "purple" });
    }

    return result;
  }, [data?.buckets]);

  const handleView = useCallback(
    async (placeholderId: string) => {
      if (data) {
        const match = displayBuckets.find(
          (b) =>
            b.id === placeholderId ||
            (placeholderId === "beyond" &&
              (b.id === "decision_makers" || b.title === "Beyond Your Network")),
        );
        if (match) setActiveBucket(match);
        return;
      }

      setPendingBucketId(placeholderId);
      const result = await load();
      setPendingBucketId(null);

      if (!result?.buckets?.length) return;

      const buckets = result.buckets;
      let match: InsiderConnectionBucket | undefined;
      if (placeholderId === "beyond") {
        match = buckets.find((b) => b.id === "decision_makers");
      } else {
        match = buckets.find((b) => b.id === placeholderId);
      }
      if (match) setActiveBucket(match);
    },
    [data, displayBuckets, load],
  );

  const findEmail = async () => {
    const url = normalizeLinkedInUrl(linkedinInput);
    if (!url) {
      setEmailLookup({
        email: null,
        name: null,
        error: "Paste a valid LinkedIn profile URL.",
      });
      return;
    }
    setEmailLoading(true);
    setEmailLookup(null);
    try {
      const res = await fetch(
        withClientScope("/api/jobs/insider-connections/reveal-email"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkedinUrl: url }),
        },
      );
      const json = (await res.json()) as {
        email?: string | null;
        name?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setEmailLookup({
          email: null,
          name: null,
          error: json.error ?? "No email found.",
        });
        return;
      }
      setEmailLookup({
        email: json.email ?? null,
        name: json.name ?? null,
        error: json.email
          ? undefined
          : "No work email on file for this profile.",
      });
    } catch {
      setEmailLookup({ email: null, name: null, error: "Lookup failed." });
    } finally {
      setEmailLoading(false);
    }
  };

  const fetched = data !== null;

  return (
    <ScoutBox
      padding={isMobile ? 16 : 20}
      style={{
        marginBottom: 22,
        background:
          "linear-gradient(180deg, rgba(74,139,106,0.06) 0%, #fff 100%)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: color.forest,
                display: "inline-block",
              }}
            />
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.body,
                fontWeight: 700,
                color: color.stone,
                margin: 0,
              }}
            >
              Insider Connection @{companyName}
            </p>
          </div>
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.bodySm,
              color: color.muted,
              margin: 0,
              lineHeight: 1.55,
              maxWidth: 640,
            }}
          >
            Discover valuable connections within the company who might provide
            insights and potential referrals.
          </p>
        </div>
        <span
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(74,139,106,0.12)",
            border: "1px solid rgba(74,139,106,0.25)",
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            color: color.forest,
            whiteSpace: "nowrap",
          }}
        >
          Email lookups unlimited
        </span>
      </div>

      {/* Connection cards */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 14,
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        {CONNECTION_SLOTS.map(({ id, placeholder }) => {
          if (!fetched) {
            return (
              <PlaceholderCard
                key={id}
                bucket={placeholder}
                loading={loading && pendingBucketId === id}
                onView={() => void handleView(id)}
              />
            );
          }

          const bucket =
            bucketForSlot(id, displayBuckets) ?? emptyBucketForSlot(id, placeholder);

          return (
            <ConnectionCard
              key={id}
              bucket={bucket}
              onView={() => {
                if (bucket.people.length > 0) setActiveBucket(bucket);
                else void handleView(id);
              }}
            />
          );
        })}
      </div>

      {/* Find any email — always visible */}
      <div
        style={{ marginTop: 18, paddingTop: 16, borderTop: border.line }}
      >
        <p
          style={{
            fontFamily: fontSans,
            fontSize: T.bodySm,
            fontWeight: 600,
            color: color.stone,
            margin: "0 0 8px",
          }}
        >
          Find any email
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexDirection: isMobile ? "column" : "row",
          }}
        >
          <input
            value={linkedinInput}
            onChange={(e) => setLinkedinInput(e.target.value)}
            placeholder="Paste any LinkedIn profile URL (e.g., https://www.linkedin.com/in/xxxxx/) to find work emails instantly."
            style={{
              flex: 1,
              padding: "11px 12px",
              border: border.line,
              borderRadius: "var(--scout-radius)",
              fontFamily: fontSans,
              fontSize: T.bodySm,
            }}
          />
          <button
            type="button"
            onClick={() => void findEmail()}
            disabled={emailLoading}
            style={{
              padding: "11px 18px",
              background: color.forest,
              color: color.gold,
              border: border.lineStrong,
              borderRadius: "var(--scout-radius)",
              fontFamily: fontSans,
              fontSize: T.bodySm,
              fontWeight: 700,
              cursor: emailLoading ? "wait" : "pointer",
              flexShrink: 0,
            }}
          >
            {emailLoading ? "Searching…" : "Search"}
          </button>
        </div>
        {emailLookup && (
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.caption,
              color: emailLookup.error ? "#9A4A4A" : color.forest,
              margin: "8px 0 0",
            }}
          >
            {emailLookup.error ??
              (emailLookup.email
                ? `${emailLookup.name ? `${emailLookup.name}: ` : ""}${emailLookup.email}`
                : "No email found.")}
          </p>
        )}
      </div>

      {activeBucket && (
        <BucketModal
          bucket={activeBucket}
          companyName={companyName}
          jobId={jobId ?? null}
          withClientScope={withClientScope}
          onClose={() => setActiveBucket(null)}
        />
      )}
    </ScoutBox>
  );
}
