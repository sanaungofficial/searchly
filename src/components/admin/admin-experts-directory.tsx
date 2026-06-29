"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CoachHubDrawer } from "@/components/admin/coach-hub-drawer";
import { CoachingDirectoryCard, type CoachCompanyLookupItem } from "@/components/scout/coaching-directory-card";
import { CoachQuickFiltersBar, CoachFiltersDrawer } from "@/components/scout/coaching-directory-filters";
import { CoachingDirectorySidebar } from "@/components/scout/coaching-directory-sidebar";
import { ScoutBox, ScoutLabel, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import {
  filterCoaches,
  parseCoachDirectoryFilters,
  sortCoaches,
} from "@/lib/coach-directory";
import type { CoachListItem } from "@/lib/coach-types";
import { useIsMobile } from "@/hooks/use-mobile";
import { color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

type AdminExpertListItem = CoachListItem & {
  status?: string;
  email?: string | null;
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
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function countActiveFilters(params: URLSearchParams): number {
  let count = 0;
  if (params.get("firm")) count++;
  if (params.get("specialty")) count++;
  if (params.get("specialization")) count++;
  if (params.get("rateMin")) count++;
  if (params.get("rateMax")) count++;
  if (params.get("professional") === "1") count++;
  if (params.get("internal") === "1") count++;
  return count;
}

export function AdminExpertsDirectory() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const [allCoaches, setAllCoaches] = useState<AdminExpertListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const [companyLookup, setCompanyLookup] = useState<Record<string, CoachCompanyLookupItem>>({});
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(searchParams.get("coachId"));
  const debouncedSearch = useDebouncedValue(searchInput);

  const urlFilters = useMemo(() => parseCoachDirectoryFilters(searchParams), [searchParams]);
  const activeFilterCount = countActiveFilters(searchParams);
  const professionalFilter = searchParams.get("professional") === "1";
  const internalFilter = searchParams.get("internal") === "1";

  const sidebarFilters = useMemo(
    () => ({
      firm: urlFilters.firm ?? "",
      specialty: urlFilters.specialty ?? "",
      specialization: urlFilters.specialization ?? "",
      rateMin: urlFilters.rateMin != null ? String(urlFilters.rateMin) : "",
      rateMax: urlFilters.rateMax != null ? String(urlFilters.rateMax) : "",
      professional: professionalFilter,
      internal: internalFilter,
    }),
    [urlFilters, professionalFilter, internalFilter],
  );

  const loadCoaches = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/admin/experts");
      if (!response.ok) throw new Error("Failed to load experts");
      const data = await response.json();
      setAllCoaches(data.coaches ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load experts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCoaches();
  }, [loadCoaches]);

  useEffect(() => {
    setSelectedCoachId(searchParams.get("coachId"));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/coaches/companies/suggest?limit=50")
      .then((response) => (response.ok ? response.json() : []))
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
          };
        }
        setCompanyLookup(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const activeFilters = useMemo(
    () => ({ ...urlFilters, q: debouncedSearch.trim() || undefined }),
    [urlFilters, debouncedSearch],
  );

  const filteredCoaches = useMemo(() => {
    const q = activeFilters.q?.trim().toLowerCase();
    const filtersWithoutQuery = { ...activeFilters, q: undefined };
    let list = filterCoaches(allCoaches, filtersWithoutQuery, { includeInternal: true });
    if (q) {
      list = list.filter((coach) => {
        const item = coach as AdminExpertListItem;
        return (
          coach.displayName.toLowerCase().includes(q) ||
          (coach.headline ?? "").toLowerCase().includes(q) ||
          (coach.bio ?? "").toLowerCase().includes(q) ||
          (item.email ?? "").toLowerCase().includes(q) ||
          coach.firms.some((firm) => firm.toLowerCase().includes(q)) ||
          coach.specialties.some((specialty) => specialty.toLowerCase().includes(q)) ||
          (coach.location ?? "").toLowerCase().includes(q)
        );
      });
    }
    const sort = activeFilters.sort === "match" ? "default" : activeFilters.sort;
    return sortCoaches(list, sort);
  }, [allCoaches, activeFilters]);

  const selectedCoach = allCoaches.find((coach) => coach.id === selectedCoachId) ?? null;

  const setFilters = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`/admin/experts?${params.toString()}`, { scroll: false });
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
    router.replace("/admin/experts", { scroll: false });
  };

  const toggleProfessionalFilter = (checked: boolean) => {
    setFilters({ professional: checked ? "1" : "" });
  };

  const toggleInternalFilter = (checked: boolean) => {
    setFilters({ internal: checked ? "1" : "" });
  };

  const openCoach = useCallback(
    (coach: CoachListItem) => {
      setSelectedCoachId(coach.id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("coachId", coach.id);
      router.replace(`/admin/experts?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const closeCoach = useCallback(() => {
    setSelectedCoachId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("coachId");
    params.delete("tab");
    const query = params.toString();
    router.replace(query ? `/admin/experts?${query}` : "/admin/experts", { scroll: false });
  }, [router, searchParams]);

  const filtersActive = activeFilterCount > 0 || debouncedSearch.trim().length > 0;

  const listSection = (
    <>
      <ScoutBox padding={isMobile ? 18 : 22} style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: isMobile ? "stretch" : "flex-start",
            flexDirection: isMobile ? "column" : "row",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <ScoutLabel>All experts</ScoutLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.6, maxWidth: 560 }}>
              Search and filter every coach profile. Click a card to edit profile details or import from LinkedIn.
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
              value={urlFilters.sort === "match" ? "default" : (urlFilters.sort ?? "default")}
              onChange={(event) => setFilter("sort", event.target.value === "default" ? "" : event.target.value)}
              style={{
                padding: "8px 12px",
                border: "var(--scout-border)",
                background: surface.inset,
                fontFamily: fontSans,
                fontSize: T.bodySm,
                color: color.ink,
                minHeight: 40,
              }}
            >
              <option value="default">Sort by default</option>
              <option value="rating">Highest rated</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        <input
          type="search"
          placeholder="Search by name, specialty, firm, or email…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          style={{ ...inputStyle, marginBottom: 14 }}
        />

        <CoachQuickFiltersBar
          allCoaches={allCoaches}
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
      </ScoutBox>

      <div style={{ marginBottom: 32 }}>
        {!loading && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 14px", lineHeight: 1.45 }}>
            {filteredCoaches.length} expert{filteredCoaches.length !== 1 ? "s" : ""}
            {allCoaches.length !== filteredCoaches.length ? ` of ${allCoaches.length}` : ""}
          </p>
        )}

        {loading ? (
          <ScoutBox style={{ padding: 48, textAlign: "center" }}>
            <p style={{ color: color.mutedLight, fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>Loading experts…</p>
          </ScoutBox>
        ) : filteredCoaches.length === 0 ? (
          <ScoutBox style={{ padding: 48, textAlign: "center" }}>
            <p style={{ color: color.muted, fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>
              {allCoaches.length === 0
                ? "No coach profiles yet."
                : filtersActive
                  ? "No experts match your filters — try broadening your search or clearing filters."
                  : "No experts found."}
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
            {filteredCoaches.map((coach) => (
              <CoachingDirectoryCard
                key={coach.id}
                coach={coach}
                isMobile={isMobile}
                isPro
                onSubscribe={() => {}}
                onFollow={() => {}}
                following={false}
                onOpenCoach={openCoach}
                companyLookup={companyLookup}
                variant="admin"
                adminStatus={coach.status}
              />
            ))}
          </div>
        )}
      </div>

      <CoachFiltersDrawer
        open={showAllFilters}
        onClose={() => setShowAllFilters(false)}
        allCoaches={allCoaches}
        filters={sidebarFilters}
        activeCount={activeFilterCount}
        onChange={setFilter}
        onBatchChange={setFilters}
        onProfessionalChange={toggleProfessionalFilter}
        onInternalChange={toggleInternalFilter}
        onClear={clearFilters}
      />
    </>
  );

  return (
    <div>
      <h1 style={{ ...displayTitleStyle(28), margin: "0 0 8px" }}>Expert directory</h1>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 24px", maxWidth: 720, lineHeight: 1.6 }}>
        Browse every coach profile in Kimchi. Use search and filters to find experts, then open a profile to edit details or fill gaps from LinkedIn.
      </p>

      {isMobile ? (
        listSection
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", gap: 24, alignItems: "start" }}>
          <CoachingDirectorySidebar
            allCoaches={allCoaches}
            filters={sidebarFilters}
            onChange={setFilter}
            onBatchChange={setFilters}
            onProfessionalChange={toggleProfessionalFilter}
            onInternalChange={toggleInternalFilter}
            onClear={clearFilters}
            activeCount={activeFilterCount}
          />
          <div>{listSection}</div>
        </div>
      )}

      {selectedCoachId && (
        <CoachHubDrawer
          coachId={selectedCoachId}
          basePath="/admin/experts"
          coachPreview={
            selectedCoach
              ? {
                  id: selectedCoach.id,
                  displayName: selectedCoach.displayName,
                  photoUrl: selectedCoach.photoUrl,
                  headline: selectedCoach.headline,
                }
              : null
          }
          onClose={closeCoach}
          onCoachUpdated={loadCoaches}
        />
      )}
    </div>
  );
}
