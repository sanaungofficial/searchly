"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CoachAvatar, CoachStarRating } from "@/components/scout/coach-avatar";
import { CoachingDirectoryCard, type CoachCompanyLookupItem } from "@/components/scout/coaching-directory-card";
import { CoachQuickFiltersBar, CoachFiltersDrawer } from "@/components/scout/coaching-directory-filters";
import { COACH_MATCH_NEEDS_SIGNAL_HINT } from "@/lib/coach-goal-signals";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { categoryToSlug } from "@/lib/coach-categories";
import {
  filterCoaches,
  parseCoachDirectoryFilters,
  pickSpotlightCoaches,
  sortCoaches,
  SPOTLIGHT_BADGE_LABELS,
} from "@/lib/coach-directory";
import { writeCoachMatchCache } from "@/lib/coach-match-cache";
import type { CoachListItem, CoachSpotlightBadge } from "@/lib/coach-types";
import { useRequireAuthRedirect } from "@/hooks/use-auth-return-path";
import { useWorkspace } from "@/contexts/workspace-context";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  category?: string | null;
  isMobile: boolean;
  isPro: boolean;
  onSubscribe: () => void;
  onOpenCoach: (coach: CoachListItem) => void;
  myCoachIds?: Set<string>;
  onMyCoachIdsChange?: (ids: Set<string>) => void;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "var(--scout-border)",
  borderRadius: "var(--scout-radius)",
  fontFamily: fontSans,
  fontSize: T.bodySm,
  boxSizing: "border-box",
  background: surface.card,
  color: color.ink,
};

function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
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
    <div style={{ marginTop: 0, marginBottom: 20 }}>
      <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, margin: "0 0 14px", color: color.ink }}>
        Get started with an expert
      </p>
      <div
        style={{
          display: "flex",
          gap: 16,
          overflowX: "auto",
          paddingBottom: 12,
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {coaches.map((c) => (
          <div key={c.id} style={{ flex: isMobile ? "0 0 300px" : "0 0 320px", scrollSnapAlign: "start" }}>
            <ScoutBox padding={18} style={{ border: "var(--scout-border)", height: "100%" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <CoachAvatar name={c.displayName} photoUrl={c.photoUrl} size={48} rounded />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: color.ink }}>{c.displayName}</p>
                  {c.spotlightBadge && <div style={{ marginBottom: 6 }}><SpotlightBadge badge={c.spotlightBadge} /></div>}
                  <CoachStarRating rating={c.avgRating} count={c.reviewCount} />
                </div>
              </div>
              {c.headline && (
                <p style={{ fontFamily: fontSans, fontSize: 13, color: color.stone, lineHeight: 1.5, margin: "0 0 10px" }}>
                  {c.headline.slice(0, 90)}{c.headline.length > 90 ? "…" : ""}
                </p>
              )}
              {c.firms.length > 0 && (
                <p style={{ fontFamily: fontSans, fontSize: 12, color: color.forest, margin: "0 0 14px", fontWeight: 500 }}>
                  {c.firms.slice(0, 3).join(" · ")}
                </p>
              )}
              <ScoutPrimaryBtn onClick={() => onOpenCoach(c)} style={{ width: "100%", minHeight: 40, fontSize: 13 }}>
                View profile
              </ScoutPrimaryBtn>
            </ScoutBox>
          </div>
        ))}
      </div>
    </div>
  );
}

function countActiveFilters(params: URLSearchParams): number {
  let n = 0;
  if (params.get("firm")) n++;
  if (params.get("specialty")) n++;
  if (params.get("specialization")) n++;
  if (params.get("rateMin")) n++;
  if (params.get("rateMax")) n++;
  if (params.get("professional") === "1") n++;
  if (params.get("internal") === "1") n++;
  return n;
}

export function CoachingDirectory({ category, isMobile, isPro, onSubscribe, onOpenCoach, myCoachIds: myCoachIdsProp, onMyCoachIdsChange }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requireAuth = useRequireAuthRedirect();
  const { userRole, isImpersonating, user, authChecked } = useWorkspace();
  const isAdmin = userRole === "ADMIN";
  const canSelfAssignCoach = userRole === "USER" || isImpersonating || isAdmin;
  const canAdminAssignCoach = isImpersonating || isAdmin;
  const [allCoaches, setAllCoaches] = useState<CoachListItem[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [localMyCoachIds, setLocalMyCoachIds] = useState<Set<string>>(new Set());
  const myCoachIds = myCoachIdsProp ?? localMyCoachIds;
  const setMyCoachIds = onMyCoachIdsChange ?? setLocalMyCoachIds;
  const [loading, setLoading] = useState(true);
  const [scored, setScored] = useState(false);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const debouncedSearch = useDebouncedValue(searchInput);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [companyLookup, setCompanyLookup] = useState<Record<string, CoachCompanyLookupItem>>({});

  const urlFilters = useMemo(() => parseCoachDirectoryFilters(searchParams), [searchParams]);
  const activeFilterCount = countActiveFilters(searchParams);
  const professionalFilter = searchParams.get("professional") === "1";
  const internalFilter = searchParams.get("internal") === "1";

  const sidebarFilters = useMemo(
    () => ({
      rateMin: searchParams.get("rateMin") ?? "",
      rateMax: searchParams.get("rateMax") ?? "",
      firm: searchParams.get("firm") ?? "",
      specialty: searchParams.get("specialty") ?? "",
      specialization: searchParams.get("specialization") ?? "",
      professional: professionalFilter,
      internal: internalFilter,
    }),
    [searchParams, professionalFilter, internalFilter],
  );

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
    setLoadError(null);
    try {
      const [listRes, followRes] = await Promise.all([
        fetch("/api/coaches"),
        fetch("/api/coaches/following"),
      ]);
      if (!listRes.ok) {
        const errBody = await listRes.json().catch(() => ({}));
        setLoadError(typeof errBody.error === "string" ? errBody.error : "Could not load coaches.");
        setAllCoaches([]);
        return;
      }
      const data = await listRes.json();
      const coaches = Array.isArray(data.coaches) ? data.coaches : Array.isArray(data) ? data : [];
      setAllCoaches(coaches);
      setScored(Boolean(data.scored));
      if (Array.isArray(data.myCoachIds)) {
        setMyCoachIds(new Set(data.myCoachIds as string[]));
      }
      const hint = typeof data.hint === "string" ? data.hint : COACH_MATCH_NEEDS_SIGNAL_HINT;
      writeCoachMatchCache({
        coaches,
        fetchedAt: Date.now(),
        scored: Boolean(data.scored),
        needsProfile: !data.scored,
        hint: !data.scored ? hint : null,
      });
      if (followRes.ok) {
        const followed = await followRes.json();
        setFollowedIds(new Set((followed as CoachListItem[]).map((c) => c.id)));
      }
    } catch {
      setLoadError("Could not load coaches. Try refreshing.");
      setAllCoaches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoaches();
  }, [loadCoaches]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/coaches/companies/suggest?limit=50")
      .then((res) => (res.ok ? res.json() : []))
      .then((items: Array<{ catalogSlug: string; name: string; logoUrl?: string | null; website?: string | null }>) => {
        if (cancelled || !Array.isArray(items)) return;
        const map: Record<string, CoachCompanyLookupItem> = {};
        for (const item of items) {
          const slug = item.catalogSlug?.toLowerCase();
          if (!slug) continue;
          map[slug] = {
            name: item.name,
            logoUrl: item.logoUrl ?? null,
            website: item.website ?? null,
            careersUrl: null,
          };
        }
        setCompanyLookup(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const activeFilters = useMemo(() => {
    const f = { ...urlFilters, q: debouncedSearch.trim() || undefined };
    if (category) f.category = category;
    return f;
  }, [urlFilters, debouncedSearch, category]);

  const categoryPool = useMemo(
    () => (category ? allCoaches.filter((c) => c.category === category) : allCoaches),
    [allCoaches, category],
  );

  const filteredCoaches = useMemo(() => {
    const list = filterCoaches(categoryPool, activeFilters);
    return sortCoaches(list, activeFilters.sort);
  }, [categoryPool, activeFilters]);

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

  const clearFilters = () => {
    setSearchInput("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("firm");
    params.delete("specialty");
    params.delete("specialization");
    params.delete("rateMin");
    params.delete("rateMax");
    params.delete("professional");
    params.delete("internal");
    const base = category ? `/coaching/c/${categoryToSlug(category)}` : "/coaching";
    router.replace(base, { scroll: false });
  };

  const toggleProfessionalFilter = (checked: boolean) => {
    setFilters({ professional: checked ? "1" : "" });
  };

  const toggleInternalFilter = (checked: boolean) => {
    setFilters({ internal: checked ? "1" : "" });
  };

  const toggleFollow = async (coach: CoachListItem) => {
    if (!authChecked || !user) {
      requireAuth("login");
      return;
    }
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

  const toggleMyCoach = async (coach: CoachListItem) => {
    if (!authChecked || !user) {
      requireAuth("login");
      return;
    }
    const isAssigned = myCoachIds.has(coach.id);
    if (!isAssigned && coach.isInternal && !canAdminAssignCoach) return;
    if (!isAssigned && coach.requiresAssignment && !canAdminAssignCoach) return;
    const res = isAssigned
      ? await fetch(`/api/coaching/coach-assignment?coachProfileId=${encodeURIComponent(coach.id)}`, { method: "DELETE" })
      : await fetch("/api/coaching/coach-assignment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coachProfileId: coach.id }),
        });
    if (res.ok) {
      const data = await res.json();
      setMyCoachIds(new Set((data.coachIds as string[]) ?? []));
    }
  };

  const sectionTitle = category ? `${category} Experts` : "All coaches";

  const filtersActive = activeFilterCount > 0 || debouncedSearch.trim().length > 0;

  return (
    <div>
      <FeaturedCarousel coaches={spotlightCoaches} isMobile={isMobile} isPro={isPro} onSubscribe={onSubscribe} onOpenCoach={onOpenCoach} />

      <ScoutBox padding={isMobile ? 18 : 22} style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "flex-start", flexDirection: isMobile ? "column" : "row", gap: 16, marginBottom: 16 }}>
          <div>
            <ScoutLabel>{sectionTitle}</ScoutLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.6, maxWidth: 560 }}>
              {category
                ? "Experts in this category, ranked by how well they match your profile."
                : "Book one-on-one time with an expert coach to make progress on your goals."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <ScoutSecondaryBtn onClick={() => void loadCoaches()} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </ScoutSecondaryBtn>
            {activeFilterCount > 0 && (
              <ScoutSecondaryBtn onClick={clearFilters}>Clear ({activeFilterCount})</ScoutSecondaryBtn>
            )}
            <select
              value={urlFilters.sort ?? "default"}
              onChange={(e) => setFilter("sort", e.target.value === "default" ? "" : e.target.value)}
              style={{ padding: "8px 12px", border: "var(--scout-border)", background: surface.inset, fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, minHeight: 40 }}
            >
              <option value="default">Sort by default</option>
              <option value="match">Match score</option>
              <option value="rating">Highest rated</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        <input
          type="search"
          placeholder="Search by name, specialty, or Kimchi coach…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ ...inputStyle, marginBottom: 14 }}
        />

        <CoachQuickFiltersBar
          allCoaches={categoryPool}
          filters={sidebarFilters}
          activeCount={activeFilterCount}
          onChange={setFilter}
          onBatchChange={setFilters}
          onInternalChange={toggleInternalFilter}
          onOpenAllFilters={() => setShowAllFilters(true)}
        />

        {loadError && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#b45309", margin: "12px 0 0", lineHeight: 1.5 }}>
            {loadError}
          </p>
        )}

        {!scored && !loading && !loadError && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "14px 0 0", lineHeight: 1.5, padding: "10px 12px", background: surface.inset, border: "var(--scout-border)" }}>
            {COACH_MATCH_NEEDS_SIGNAL_HINT}
          </p>
        )}
      </ScoutBox>

      <div style={{ marginBottom: 32 }}>
        {!loading && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 14px", lineHeight: 1.45 }}>
            {filteredCoaches.length} coach{filteredCoaches.length !== 1 ? "es" : ""}
            {!isPro && <span style={{ marginLeft: 10, color: "#b45309" }}>Subscribe to see rates and book sessions</span>}
          </p>
        )}

        {loading ? (
          <ScoutBox style={{ padding: 48, textAlign: "center" }}>
            <p style={{ color: color.mutedLight, fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>Loading coaches…</p>
          </ScoutBox>
        ) : filteredCoaches.length === 0 ? (
          <ScoutBox style={{ padding: 48, textAlign: "center" }}>
            <p style={{ color: color.muted, fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>
              {allCoaches.length === 0
                ? "No coaches are available right now."
                : filtersActive
                  ? "No coaches match your filters — try broadening your search or clearing filters."
                  : "No coaches in this category."}
            </p>
            {filtersActive && allCoaches.length > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  marginTop: 14,
                  background: "none",
                  border: "var(--scout-border)",
                  padding: "8px 14px",
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  color: color.forest,
                  cursor: "pointer",
                }}
              >
                Clear filters
              </button>
            )}
          </ScoutBox>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredCoaches.map((c) => (
              <CoachingDirectoryCard
                key={c.id}
                coach={c}
                isMobile={isMobile}
                isPro={isPro}
                onSubscribe={onSubscribe}
                onFollow={toggleFollow}
                following={followedIds.has(c.id)}
                onOpenCoach={onOpenCoach}
                isMyCoach={myCoachIds.has(c.id)}
                canSelfAssignCoach={canSelfAssignCoach}
                canAdminAssignCoach={canAdminAssignCoach}
                onToggleMyCoach={toggleMyCoach}
                companyLookup={companyLookup}
              />
            ))}
          </div>
        )}
      </div>

      <CoachFiltersDrawer
        open={showAllFilters}
        onClose={() => setShowAllFilters(false)}
        allCoaches={categoryPool}
        filters={sidebarFilters}
        activeCount={activeFilterCount}
        onChange={setFilter}
        onBatchChange={setFilters}
        onProfessionalChange={toggleProfessionalFilter}
        onInternalChange={toggleInternalFilter}
        onClear={clearFilters}
      />
    </div>
  );
}
