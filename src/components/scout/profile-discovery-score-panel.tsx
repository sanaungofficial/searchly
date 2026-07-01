"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { DiscoveryScoreCluster } from "@/components/scout/discovery-score-ui";
import { useDiscoveryScore } from "@/hooks/use-discovery-score";
import { tierPeerCopy } from "@/lib/discovery-score";
import { Search } from "lucide-react";
import {
  displayJobFunctionLabel,
  groupLabelForJobFunction,
  jobFunctionBreadcrumb,
} from "@/lib/job-function-groups";
import type { GroupedJobFunctions } from "@/lib/job-function-groups";
import { bruddleHeadingStyle, border, color, fontSans, fontDisplay, surface, type as T } from "@/lib/typography";
import { pipelineInputStyle } from "@/components/scout/pipeline-filters-ui";

type ProfileInput = {
  name: string;
  headline: string | null;
  targetRoles: string[];
  prioritizedCategories?: string[];
  benchmarkCategoryOverride?: string | null;
  avatarUrl: string | null;
};

type Props = {
  profile: ProfileInput;
  isMobile: boolean;
  withClientScope: (path: string) => string;
  onBenchmarkCategorySave?: (category: string | null) => Promise<void>;
};

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const init =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  return <>{init}</>;
}

function BenchmarkCard({
  name,
  title,
  company,
  linkedinUrl,
  thumbnailUrl,
  isMobile,
}: {
  name: string;
  title: string | null;
  company: string | null;
  linkedinUrl: string;
  thumbnailUrl: string | null;
  isMobile: boolean;
}) {
  return (
    <ScoutBox padding={isMobile ? "14px 16px" : "16px 18px"}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            flexShrink: 0,
            overflow: "hidden",
            background: surface.inset,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fontSans,
            fontSize: 14,
            fontWeight: 700,
            color: color.forest,
            border: "2px solid rgba(26,58,47,0.1)",
          }}
        >
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Initials name={name} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink, margin: "0 0 2px" }}>
            {name}
          </p>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0, lineHeight: 1.45 }}>
            {[title, company].filter(Boolean).join(" · ") || "Professional profile"}
          </p>
        </div>
        <Link
          href={linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: fontSans,
            fontSize: T.label,
            fontWeight: 700,
            color: color.forest,
            textDecoration: "none",
            whiteSpace: "nowrap",
            padding: "6px 10px",
            borderRadius: "var(--scout-radius)",
            border: "var(--scout-border)",
            background: surface.card,
          }}
        >
          LinkedIn ↗
        </Link>
      </div>
    </ScoutBox>
  );
}

function BenchmarkJobFunctionCombobox({
  selectedCategory,
  fallbackCategories,
  withClientScope,
  onSave,
  disabled,
}: {
  selectedCategory: string | null;
  fallbackCategories: string[];
  withClientScope: (path: string) => string;
  onSave?: (category: string | null) => Promise<void>;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>(fallbackCategories);
  const [groups, setGroups] = useState<GroupedJobFunctions[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    void fetch(withClientScope("/api/jobs/job-functions"))
      .then((res) => (res.ok ? res.json() : { categories: [], groups: [] }))
      .then((data: { categories?: string[]; groups?: GroupedJobFunctions[] }) => {
        if (data.categories?.length) setCategories(data.categories);
        if (data.groups?.length) setGroups(data.groups);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [withClientScope]);

  const options = useMemo(() => {
    const merged = [...categories];
    for (const cat of fallbackCategories) {
      if (!merged.some((c) => c.toLowerCase() === cat.toLowerCase())) merged.push(cat);
    }
    return merged.sort((a, b) => a.localeCompare(b));
  }, [categories, fallbackCategories]);

  const selectedValue = selectedCategory ?? fallbackCategories[0] ?? null;
  const trimmedQuery = query.trim();
  const queryLower = trimmedQuery.toLowerCase();

  const filtered = useMemo(() => {
    if (!queryLower) return options.slice(0, 24);
    return options
      .filter(
        (cat) =>
          cat.toLowerCase().includes(queryLower) ||
          displayJobFunctionLabel(cat).toLowerCase().includes(queryLower),
      )
      .slice(0, 24);
  }, [queryLower, options]);

  const handleSelect = useCallback(
    async (value: string) => {
      if (!onSave || disabled || saving) return;
      setSaving(true);
      setOpen(false);
      setQuery("");
      try {
        await onSave(value.trim() || null);
      } finally {
        setSaving(false);
      }
    },
    [disabled, onSave, saving],
  );

  const showResults = open && (trimmedQuery.length > 0 || filtered.length > 0);

  return (
    <ScoutBox padding="14px 16px" style={{ marginTop: 12 }}>
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 700,
          color: color.forest,
          margin: "0 0 6px",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Benchmark job function
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 10px", lineHeight: 1.5 }}>
        We compare you to Sumble professionals in this job function. Search and pick the closest match — your score
        refreshes automatically.
      </p>

      {selectedValue && !open && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            marginBottom: 10,
            borderRadius: "var(--scout-radius)",
            border: "1px solid rgba(76, 175, 80, 0.35)",
            background: "rgba(76, 175, 80, 0.16)",
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            color: color.ink,
          }}
        >
          {displayJobFunctionLabel(selectedValue)}
        </div>
      )}

      <div style={{ position: "relative" }}>
        <Search
          size={14}
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            opacity: 0.4,
            pointerEvents: "none",
          }}
        />
        <input
          style={{
            ...pipelineInputStyle,
            paddingLeft: 32,
            margin: 0,
            width: "100%",
            maxWidth: 420,
            background: surface.inset,
            border: "1px solid rgba(0,0,0,0.08)",
          }}
          value={query}
          disabled={disabled || saving || !onSave}
          placeholder={selectedValue ? "Change job function…" : "Search job functions…"}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filtered[0]) {
              e.preventDefault();
              void handleSelect(filtered[0]);
            }
          }}
        />
      </div>

      {showResults && (
        <div
          style={{
            maxHeight: 220,
            overflowY: "auto",
            marginTop: 4,
            border: border.line,
            borderRadius: 8,
            background: surface.card,
          }}
        >
          {loading && (
            <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "8px 10px" }}>
              Loading job functions…
            </p>
          )}
          {!loading &&
            filtered.map((cat) => {
              const groupLabel = groupLabelForJobFunction(cat, groups);
              const breadcrumb = groupLabel ? jobFunctionBreadcrumb(cat, groupLabel) : null;
              const isSelected = selectedValue?.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void handleSelect(cat)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 10px",
                    border: "none",
                    borderBottom: border.line,
                    background: isSelected ? "rgba(76, 175, 80, 0.12)" : "transparent",
                    cursor: disabled || saving ? "default" : "pointer",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontFamily: fontSans,
                      fontSize: T.caption,
                      fontWeight: 700,
                      color: color.ink,
                    }}
                  >
                    {displayJobFunctionLabel(cat)}
                    {isSelected ? " ✓" : ""}
                  </span>
                  {breadcrumb && (
                    <span
                      style={{
                        display: "block",
                        fontFamily: fontSans,
                        fontSize: T.label,
                        color: color.muted,
                        marginTop: 3,
                      }}
                    >
                      {breadcrumb}
                    </span>
                  )}
                </button>
              );
            })}
          {!loading && !filtered.length && (
            <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "8px 10px" }}>
              No matches — try a broader term like Marketing, Engineering, or Sales.
            </p>
          )}
        </div>
      )}
    </ScoutBox>
  );
}

export function ProfileDiscoveryScorePanel({
  profile,
  isMobile,
  withClientScope,
  onBenchmarkCategorySave,
}: Props) {
  const { result, loading, refreshing, refresh, error } = useDiscoveryScore({ withClientScope });

  const targetRole = profile.targetRoles[0] ?? profile.headline ?? "similar roles";
  const peerLabel =
    result?.benchmarkPeerLabel ??
    profile.benchmarkCategoryOverride?.replace(/ Jobs$/i, "") ??
    profile.prioritizedCategories?.[0]?.replace(/ Jobs$/i, "") ??
    targetRole;
  const score = result?.score ?? null;
  const hasScore = score != null && result != null;
  const tier = result?.tier ?? null;
  const peerCopy = tier ? tierPeerCopy(tier, peerLabel) : null;
  const showLoader = loading || refreshing;
  const selectedBenchmarkCategory =
    profile.benchmarkCategoryOverride ?? profile.prioritizedCategories?.[0] ?? null;

  const handleBenchmarkCategorySave = useCallback(
    async (category: string | null) => {
      if (!onBenchmarkCategorySave) return;
      await onBenchmarkCategorySave(category);
      await refresh();
    },
    [onBenchmarkCategorySave, refresh],
  );

  return (
    <div style={{ paddingBottom: 40 }}>
      <ScoutBox
        padding={isMobile ? "22px 18px" : "28px 32px"}
        style={{
          marginBottom: 24,
          background: "linear-gradient(135deg, var(--scout-surface) 0%, rgba(26,58,47,0.06) 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: isMobile ? "flex-start" : "center",
            gap: isMobile ? 18 : 28,
            flexDirection: isMobile ? "column" : "row",
          }}
        >
          <div
            style={{
              width: isMobile ? 80 : 96,
              height: isMobile ? 80 : 96,
              borderRadius: "50%",
              flexShrink: 0,
              border: "3px solid rgba(26,58,47,0.12)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: surface.card,
              fontFamily: fontSans,
              fontSize: isMobile ? 22 : 26,
              fontWeight: 700,
              color: color.forest,
            }}
          >
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Initials name={profile.name} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 6,
                flexWrap: "wrap",
              }}
            >
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: T.label,
                  color: color.muted,
                  margin: 0,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Discovery Score
              </p>
              <ScoutSecondaryBtn
                onClick={() => void refresh()}
                disabled={showLoader}
                style={{ padding: "6px 12px", fontSize: T.label }}
              >
                {showLoader ? "Refreshing…" : "Refresh score"}
              </ScoutSecondaryBtn>
            </div>
            {result?.refreshedAt && !showLoader && (
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, margin: "0 0 6px" }}>
                Last updated{" "}
                {new Date(result.refreshedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
            {result?.benchmarkJobFunction && !showLoader && (
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 6px" }}>
                Benchmark cohort:{" "}
                <strong style={{ color: color.ink }}>
                  {result.benchmarkPeerLabel ?? result.benchmarkJobFunction}
                </strong>
                {result.benchmarkTargetRole && result.benchmarkTargetRole !== peerLabel
                  ? ` (target role: ${result.benchmarkTargetRole})`
                  : null}
              </p>
            )}
            {peerCopy && (
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest, margin: "0 0 6px" }}>
                {peerCopy}
              </p>
            )}
            <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, lineHeight: 1.6, margin: 0 }}>
              {result?.summary ??
                (hasScore
                  ? "Your score reflects how you compare to professionals in your benchmark cohort."
                  : "Refresh to compare yourself to Sumble professionals in a matching job function.")}
            </p>
            {error && (
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#b45309", margin: "8px 0 0" }}>
                {error}
              </p>
            )}
          </div>

          {showLoader ? (
            <div style={{ flexShrink: 0, minWidth: isMobile ? "100%" : 120 }}>
              <KimchiProcessLoader preset="discoveryScore" variant="inline" fullWidth />
            </div>
          ) : score != null ? (
            <DiscoveryScoreCluster result={result} score={score} align={isMobile ? "left" : "right"} />
          ) : (
            <ScoutPrimaryBtn onClick={() => void refresh()} style={{ flexShrink: 0 }}>
              Get my score
            </ScoutPrimaryBtn>
          )}
        </div>

        <BenchmarkJobFunctionCombobox
          selectedCategory={selectedBenchmarkCategory}
          fallbackCategories={profile.prioritizedCategories ?? []}
          withClientScope={withClientScope}
          onSave={handleBenchmarkCategorySave}
          disabled={showLoader}
        />
      </ScoutBox>

      {result && !showLoader && (
        <>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: fontDisplay, fontSize: isMobile ? 42 : 52, color: color.forest, lineHeight: 1 }}>
                {result.score}
              </span>
              <span style={{ fontFamily: fontSans, fontSize: T.h4, color: color.muted, fontWeight: 600 }}>/100</span>
            </div>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
              {result.percentile >= 80
                ? "Top tier among your benchmark peers"
                : result.percentile >= 55
                  ? "Upper half among your benchmark peers"
                  : "Room to grow against your benchmark peers"}
            </p>
          </div>

          {(result.strengths.length > 0 || result.gaps.length > 0) && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
                gap: 14,
                marginBottom: 28,
              }}
            >
              {result.strengths.length > 0 && (
                <ScoutBox padding={isMobile ? "16px 18px" : "18px 20px"}>
                  <p
                    style={{
                      fontFamily: fontSans,
                      fontSize: T.label,
                      fontWeight: 700,
                      color: color.forest,
                      margin: "0 0 10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Strengths
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontFamily: fontSans, fontSize: T.body, color: color.ink, lineHeight: 1.6 }}>
                    {result.strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </ScoutBox>
              )}
              {result.gaps.length > 0 && (
                <ScoutBox padding={isMobile ? "16px 18px" : "18px 20px"}>
                  <p
                    style={{
                      fontFamily: fontSans,
                      fontSize: T.label,
                      fontWeight: 700,
                      color: "#b45309",
                      margin: "0 0 10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Gaps to close
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontFamily: fontSans, fontSize: T.body, color: color.ink, lineHeight: 1.6 }}>
                    {result.gaps.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </ScoutBox>
              )}
            </div>
          )}

          {result.benchmarks.length > 0 && (
            <div>
              <h2 style={{ ...bruddleHeadingStyle("h4"), margin: "0 0 14px" }}>Compared against</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {result.benchmarks.map((benchmark) => (
                  <BenchmarkCard key={benchmark.linkedinUrl} {...benchmark} isMobile={isMobile} />
                ))}
              </div>
            </div>
          )}

          {result.topImprovement && (
            <ScoutBox padding={isMobile ? "16px 18px" : "18px 22px"} style={{ marginTop: 20 }}>
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: T.label,
                  fontWeight: 700,
                  color: color.forest,
                  margin: "0 0 8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Boost your ranking
              </p>
              <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.ink, lineHeight: 1.6, margin: 0 }}>
                {result.topImprovement}
              </p>
            </ScoutBox>
          )}
        </>
      )}
    </div>
  );
}
