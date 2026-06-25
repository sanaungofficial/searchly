"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CoachAvatar, CoachStarRating } from "@/components/scout/coach-avatar";
import { MatchScoreBadge } from "@/components/scout/match-score-ui";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import {
  COACH_CLIENT_SPECIALIZATIONS,
  COACH_RATE_BUCKETS,
  categoryDescription,
  categoryToSlug,
} from "@/lib/coach-categories";
import {
  bioSnippet,
  featuredPresetFilters,
  filterCoaches,
  filterProfessionalCoaches,
  parseCoachDirectoryFilters,
  pickSpotlightCoaches,
  sortCoaches,
  SPOTLIGHT_BADGE_LABELS,
} from "@/lib/coach-directory";
import { matchScoreStyle } from "@/lib/match-score";
import type { CoachFeaturedPreset, CoachListItem, CoachSpotlightBadge } from "@/lib/coach-types";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  category?: string | null;
  isMobile: boolean;
  isPro: boolean;
  onSubscribe: () => void;
  onOpenCoach: (coach: CoachListItem) => void;
};

function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function RateDisplay({ rate, isPro, onSubscribe }: { rate: number; isPro: boolean; onSubscribe: () => void }) {
  if (isPro) {
    return (
      <span style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.forest }}>
        ${rate}<span style={{ fontWeight: 400, color: color.muted }}>/hr</span>
      </span>
    );
  }
  return (
    <span onClick={onSubscribe} title="Subscribe to see rate" style={{ cursor: "pointer", userSelect: "none" }}>
      <span style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.forest, filter: "blur(5px)", pointerEvents: "none" }}>${rate}</span>
      <span style={{ fontSize: 14, color: color.muted, filter: "blur(5px)", pointerEvents: "none" }}>/hr</span>
    </span>
  );
}

function SpotlightBadge({ badge }: { badge: CoachSpotlightBadge }) {
  const tones: Record<CoachSpotlightBadge, { bg: string; color: string }> = {
    featured: { bg: "rgba(196,168,106,0.18)", color: "#7A6020" },
    new: { bg: "rgba(37,99,235,0.1)", color: "#1d4ed8" },
    "top-rated": { bg: "rgba(26,58,47,0.1)", color: color.forest },
    rising: { bg: "rgba(124,58,237,0.1)", color: "#7c3aed" },
  };
  const tone = tones[badge];
  return (
    <span style={{ padding: "2px 8px", fontFamily: fontSans, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", background: tone.bg, color: tone.color }}>
      {SPOTLIGHT_BADGE_LABELS[badge]}
    </span>
  );
}

function FeaturedCarousel({
  coaches,
  isMobile,
  isPro,
  onSubscribe,
  onOpenCoach,
}: {
  coaches: (CoachListItem & { spotlightBadge?: CoachSpotlightBadge | null })[];
  isMobile: boolean;
  isPro: boolean;
  onSubscribe: () => void;
  onOpenCoach: (coach: CoachListItem) => void;
}) {
  if (!coaches.length) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 12px", color: color.ink }}>
        Get started with an expert
      </h3>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
        {coaches.map((c) => (
          <div key={c.id} style={{ flex: isMobile ? "0 0 280px" : "0 0 300px", scrollSnapAlign: "start" }}>
            <ScoutBox padding={16} style={{ border: border.lineStrong, height: "100%" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <CoachAvatar name={c.displayName} photoUrl={c.photoUrl} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: color.ink }}>{c.displayName}</p>
                  {c.spotlightBadge && <div style={{ marginBottom: 4 }}><SpotlightBadge badge={c.spotlightBadge} /></div>}
                  <CoachStarRating rating={c.avgRating} count={c.reviewCount} />
                </div>
                {(c.matchScore ?? 0) > 0 ? (
                  <MatchScoreBadge score={c.matchScore!} label={c.matchLabel ?? ""} />
                ) : c.hourlyRate ? (
                  <RateDisplay rate={c.hourlyRate} isPro={isPro} onSubscribe={onSubscribe} />
                ) : null}
              </div>
              {c.headline && (
                <p style={{ fontFamily: fontSans, fontSize: 13, color: color.stone, lineHeight: 1.5, margin: "0 0 10px", fontWeight: 500 }}>
                  {c.headline.slice(0, 90)}{c.headline.length > 90 ? "…" : ""}
                </p>
              )}
              {c.firms.length > 0 && (
                <p style={{ fontFamily: fontSans, fontSize: 12, color: color.forest, margin: "0 0 12px", fontWeight: 500 }}>
                  {c.firms.slice(0, 3).join(" · ")}
                </p>
              )}
              <ScoutPrimaryBtn onClick={() => onOpenCoach(c)} style={{ width: "100%", minHeight: 40, fontSize: 13 }}>View profile</ScoutPrimaryBtn>
            </ScoutBox>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterSidebar({
  allCoaches,
  filters,
  onChange,
  onBatchChange,
  isMobile,
}: {
  allCoaches: CoachListItem[];
  filters: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onBatchChange: (patch: Record<string, string>) => void;
  isMobile: boolean;
}) {
  const allFirms = useMemo(() => Array.from(new Set(allCoaches.flatMap((c) => c.firms))).sort(), [allCoaches]);
  const allSpecialties = useMemo(() => Array.from(new Set(allCoaches.flatMap((c) => c.specialties))).sort(), [allCoaches]);

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: border.line,
    background: surface.inset,
    fontFamily: fontSans,
    fontSize: T.bodySm,
    color: color.ink,
    boxSizing: "border-box",
  };

  return (
    <aside style={{ width: isMobile ? "100%" : 220, flexShrink: 0 }}>
      <ScoutBox padding={16}>
        <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", color: color.muted, margin: "0 0 12px" }}>Filters</p>

        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Hourly rate</span>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input type="number" placeholder="Min" value={filters.rateMin ?? ""} onChange={(e) => onChange("rateMin", e.target.value)} style={{ ...fieldStyle, flex: 1 }} />
            <input type="number" placeholder="Max" value={filters.rateMax ?? ""} onChange={(e) => onChange("rateMax", e.target.value)} style={{ ...fieldStyle, flex: 1 }} />
          </div>
          {COACH_RATE_BUCKETS.map((b) => {
            const active = filters.rateMin === String(b.min) && (b.max == null ? !filters.rateMax : filters.rateMax === String(b.max));
            return (
              <button
                key={b.label}
                type="button"
                onClick={() => onBatchChange({ rateMin: String(b.min), rateMax: b.max != null ? String(b.max) : "" })}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 0", border: "none", background: "none", fontFamily: fontSans, fontSize: 13, color: active ? color.forest : color.stone, fontWeight: active ? 600 : 400, cursor: "pointer" }}
              >
                {b.label}
              </button>
            );
          })}
        </label>

        {allFirms.length > 0 && (
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Company</span>
            <select value={filters.firm ?? ""} onChange={(e) => onChange("firm", e.target.value)} style={fieldStyle}>
              <option value="">All companies</option>
              {allFirms.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
        )}

        {allSpecialties.length > 0 && (
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Expertise</span>
            <select value={filters.specialty ?? ""} onChange={(e) => onChange("specialty", e.target.value)} style={fieldStyle}>
              <option value="">All services</option>
              {allSpecialties.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}

        <label style={{ display: "block" }}>
          <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Client focus</span>
          <select value={filters.specialization ?? ""} onChange={(e) => onChange("specialization", e.target.value)} style={fieldStyle}>
            <option value="">Any</option>
            {COACH_CLIENT_SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        {(filters.firm || filters.specialty || filters.specialization || filters.rateMin || filters.rateMax) && (
          <button
            type="button"
            onClick={() => onBatchChange({ firm: "", specialty: "", specialization: "", rateMin: "", rateMax: "" })}
            style={{ marginTop: 14, background: "none", border: "none", fontFamily: fontSans, fontSize: T.caption, color: color.forest, cursor: "pointer", textDecoration: "underline", padding: 0 }}
          >
            Clear filters
          </button>
        )}
      </ScoutBox>
    </aside>
  );
}

function DirectoryRow({
  coach,
  isMobile,
  isPro,
  onSubscribe,
  onFollow,
  following,
  onOpenCoach,
}: {
  coach: CoachListItem;
  isMobile: boolean;
  isPro: boolean;
  onSubscribe: () => void;
  onFollow: (coach: CoachListItem) => void;
  following: boolean;
  onOpenCoach: (coach: CoachListItem) => void;
}) {
  const scoreStyle = (coach.matchScore ?? 0) > 0 ? matchScoreStyle(coach.matchScore!) : null;

  return (
    <div role="button" tabIndex={0} onClick={() => onOpenCoach(coach)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenCoach(coach); } }} style={{ cursor: "pointer" }}>
    <ScoutBox
      padding={isMobile ? "16px 18px" : "18px 22px"}
      style={{
        border: coach.featured ? border.lineStrong : border.line,
        borderTop: scoreStyle ? `2px solid ${scoreStyle.accent}` : undefined,
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
      }}
    >
      <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={isMobile ? 56 : 72} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, color: color.ink, margin: 0 }}>
              {coach.displayName}
              {coach.featured && (
                <span style={{ marginLeft: 8, padding: "1px 7px", background: "rgba(196,168,106,0.15)", fontSize: 12, color: "#7A6020", fontWeight: 600 }}>Featured</span>
              )}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              <CoachStarRating rating={coach.avgRating} count={coach.reviewCount} />
              {coach.currentRole && (
                <span style={{ fontFamily: fontSans, fontSize: 13, color: color.muted }}>
                  {coach.currentRole}{coach.currentCompany ? ` · ${coach.currentCompany}` : ""}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexShrink: 0 }}>
            {(coach.matchScore ?? 0) > 0 && <MatchScoreBadge score={coach.matchScore!} label={coach.matchLabel ?? ""} />}
            <div style={{ textAlign: "right" }}>
              {coach.hourlyRate ? <RateDisplay rate={coach.hourlyRate} isPro={isPro} onSubscribe={onSubscribe} /> : null}
              {coach.location && <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "4px 0 0" }}>{coach.location}</p>}
            </div>
          </div>
        </div>

        {coach.headline && (
          <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.stone, lineHeight: 1.45, margin: "0 0 8px" }}>{coach.headline}</p>
        )}

        {coach.bio && (
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.stone, lineHeight: 1.55, margin: "0 0 10px" }}>{bioSnippet(coach.bio, 160)}</p>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {coach.firms.slice(0, 3).map((f) => (
            <span key={f} style={{ padding: "3px 8px", background: "rgba(26,58,47,0.06)", fontFamily: fontSans, fontSize: 12, color: color.forest, fontWeight: 500 }}>{f}</span>
          ))}
          {coach.specialties.slice(0, 4).map((s) => (
            <span key={s} style={{ padding: "3px 8px", background: "rgba(26,58,47,0.04)", fontFamily: fontSans, fontSize: 12, color: color.forest }}>{s}</span>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
          <ScoutSecondaryBtn onClick={() => onFollow(coach)} style={{ minHeight: isMobile ? 40 : 36, fontSize: 13 }}>
            {following ? "Following" : "+ Follow"}
          </ScoutSecondaryBtn>
          <ScoutPrimaryBtn onClick={() => onOpenCoach(coach)} style={{ minHeight: isMobile ? 40 : 36, fontSize: 13 }}>
            {isPro ? "Free intro call" : "View profile"}
          </ScoutPrimaryBtn>
        </div>
      </div>
    </ScoutBox>
    </div>
  );
}

export function CoachingDirectory({ category, isMobile, isPro, onSubscribe, onOpenCoach }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [allCoaches, setAllCoaches] = useState<CoachListItem[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scored, setScored] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const debouncedSearch = useDebouncedValue(searchInput);
  const [preset, setPreset] = useState<CoachFeaturedPreset | "">("");

  const urlFilters = useMemo(() => parseCoachDirectoryFilters(searchParams), [searchParams]);

  useEffect(() => {
    setSearchInput(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const q = debouncedSearch.trim();
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    const base = category ? `/coaching/c/${categoryToSlug(category)}` : "/coaching";
    router.replace(`${base}?${params.toString()}`, { scroll: false });
  }, [debouncedSearch, category, router, searchParams]);

  const loadCoaches = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, followRes] = await Promise.all([
        fetch("/api/coaches"),
        fetch("/api/coaches/following"),
      ]);
      const data = await listRes.json();
      setAllCoaches(Array.isArray(data.coaches) ? data.coaches : Array.isArray(data) ? data : []);
      setScored(Boolean(data.scored));
      if (followRes.ok) {
        const followed = await followRes.json();
        setFollowedIds(new Set((followed as CoachListItem[]).map((c) => c.id)));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoaches();
  }, [loadCoaches]);

  const activeFilters = useMemo(() => {
    const f = { ...urlFilters, q: debouncedSearch.trim() || undefined };
    if (category) f.category = category;
    if (preset === "professional") {
      /* handled below */
    } else if (preset === "budget") {
      Object.assign(f, featuredPresetFilters("budget"));
    } else if (preset === "popular") {
      Object.assign(f, featuredPresetFilters("popular"));
    }
    return f;
  }, [urlFilters, debouncedSearch, category, preset]);

  const categoryPool = useMemo(
    () => (category ? allCoaches.filter((c) => c.category === category) : allCoaches),
    [allCoaches, category],
  );

  const filteredCoaches = useMemo(() => {
    let list = filterCoaches(categoryPool, activeFilters);
    if (preset === "professional") list = filterProfessionalCoaches(list);
    return sortCoaches(list, activeFilters.sort);
  }, [categoryPool, activeFilters, preset]);

  const spotlightCoaches = useMemo(() => pickSpotlightCoaches(categoryPool, 8), [categoryPool]);

  const setFilters = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const base = category ? `/coaching/c/${categoryToSlug(category)}` : "/coaching";
    router.replace(`${base}?${params.toString()}`, { scroll: false });
  };

  const setFilter = (key: string, value: string) => setFilters({ [key]: value });

  const toggleFollow = async (coach: CoachListItem) => {
    const slug = coach.slug ?? coach.id;
    const isFollowing = followedIds.has(coach.id);
    const res = await fetch(`/api/coaches/${slug}/follow`, { method: isFollowing ? "DELETE" : "POST" });
    if (res.ok) {
      setFollowedIds((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.delete(coach.id);
        else next.add(coach.id);
        return next;
      });
    }
  };

  const title = category ? `${category} Experts` : "All Coaching Experts";
  const subtitle = category ? categoryDescription(category) : "Browse vetted coaches across every category. Book a free intro call to find your fit.";

  const presetPills: { id: CoachFeaturedPreset; label: string }[] = [
    { id: "popular", label: "Popular" },
    { id: "professional", label: "Professional" },
    { id: "budget", label: "Budget-friendly" },
  ];

  return (
    <div style={{ paddingBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: isMobile ? 22 : 26, fontWeight: 500, margin: "0 0 6px", color: color.ink }}>{title}</h2>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, maxWidth: 560, lineHeight: 1.6 }}>{subtitle}</p>
        </div>
        <select
          value={urlFilters.sort ?? "default"}
          onChange={(e) => setFilter("sort", e.target.value === "default" ? "" : e.target.value)}
          style={{ padding: "8px 12px", border: border.line, background: surface.inset, fontFamily: fontSans, fontSize: T.bodySm, color: color.ink }}
        >
          <option value="default">Best match</option>
          <option value="match">Match score</option>
          <option value="rating">Highest rated</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="search"
          placeholder="Search coaches…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ flex: 1, minWidth: isMobile ? "100%" : 240, padding: "10px 14px", border: border.line, background: surface.inset, fontFamily: fontSans, fontSize: T.bodySm, color: color.ink }}
        />
        {presetPills.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset((cur) => (cur === p.id ? "" : p.id))}
            style={{
              padding: "8px 14px",
              border: preset === p.id ? border.lineStrong : border.line,
              background: preset === p.id ? "rgba(26,58,47,0.08)" : surface.card,
              fontFamily: fontSans,
              fontSize: T.bodySm,
              fontWeight: preset === p.id ? 600 : 400,
              color: color.forest,
              cursor: "pointer",
              borderRadius: 999,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!scored && !loading && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 12px" }}>
          Add a resume or target roles on your profile to see personalized match scores.
        </p>
      )}

      <FeaturedCarousel coaches={spotlightCoaches} isMobile={isMobile} isPro={isPro} onSubscribe={onSubscribe} onOpenCoach={onOpenCoach} />

      <div style={{ display: "flex", gap: 20, flexDirection: isMobile ? "column" : "row", alignItems: "flex-start" }}>
        <FilterSidebar
          allCoaches={categoryPool}
          filters={{
            q: searchInput,
            rateMin: searchParams.get("rateMin") ?? "",
            rateMax: searchParams.get("rateMax") ?? "",
            firm: searchParams.get("firm") ?? "",
            specialty: searchParams.get("specialty") ?? "",
            specialization: searchParams.get("specialization") ?? "",
            sort: searchParams.get("sort") ?? "",
          }}
          onChange={setFilter}
          onBatchChange={setFilters}
          isMobile={isMobile}
        />
        <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, marginBottom: 14 }}>
            {loading ? "Loading…" : `${filteredCoaches.length} coach${filteredCoaches.length !== 1 ? "es" : ""}`}
            {!isPro && <span style={{ marginLeft: 10, color: "#b45309" }}>Subscribe to see rates and book sessions</span>}
          </p>

          {!loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredCoaches.map((c) => (
                <DirectoryRow
                  key={c.id}
                  coach={c}
                  isMobile={isMobile}
                  isPro={isPro}
                  onSubscribe={onSubscribe}
                  onFollow={toggleFollow}
                  following={followedIds.has(c.id)}
                  onOpenCoach={onOpenCoach}
                />
              ))}
              {filteredCoaches.length === 0 && (
                <p style={{ color: color.muted, fontSize: 14, textAlign: "center", padding: "40px 0" }}>No coaches match your filters.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
