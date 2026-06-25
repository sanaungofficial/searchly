"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CoachAvatar, CoachStarRating } from "@/components/scout/coach-avatar";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import {
  COACH_CLIENT_SPECIALIZATIONS,
  COACH_RATE_BUCKETS,
  categoryDescription,
  categoryToSlug,
} from "@/lib/coach-categories";
import { bioSnippet } from "@/lib/coach-directory";
import type { CoachFeaturedPreset, CoachListItem } from "@/lib/coach-types";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  category?: string | null;
  isMobile: boolean;
  isPro: boolean;
  onSubscribe: () => void;
};

function coachProfileHref(coach: CoachListItem) {
  return `/coaching/coach/${coach.slug ?? coach.id}`;
}

function RateDisplay({ rate, isPro, onSubscribe }: { rate: number; isPro: boolean; onSubscribe: () => void }) {
  if (isPro) {
    return (
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: color.forest }}>
        ${rate}<span style={{ fontWeight: 400, color: "var(--scout-muted)" }}>/hr</span>
      </span>
    );
  }
  return (
    <span onClick={onSubscribe} title="Subscribe to see rate" style={{ cursor: "pointer", userSelect: "none" }}>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: color.forest, filter: "blur(5px)", pointerEvents: "none" }}>
        ${rate}
      </span>
      <span style={{ fontSize: 14, color: "var(--scout-muted)", filter: "blur(5px)", pointerEvents: "none" }}>/hr</span>
    </span>
  );
}

function FeaturedCarousel({
  coaches,
  isMobile,
  isPro,
  onSubscribe,
}: {
  coaches: CoachListItem[];
  isMobile: boolean;
  isPro: boolean;
  onSubscribe: () => void;
}) {
  if (!coaches.length) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, margin: 0, color: color.ink }}>
          Get started with an expert
        </h3>
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 4,
          scrollSnapType: "x mandatory",
        }}
      >
        {coaches.slice(0, 8).map((c) => (
          <Link
            key={c.id}
            href={coachProfileHref(c)}
            style={{ textDecoration: "none", color: "inherit", flex: isMobile ? "0 0 280px" : "0 0 300px", scrollSnapAlign: "start" }}
          >
            <ScoutBox padding={16} style={{ border: border.lineStrong, height: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <CoachAvatar name={c.displayName} photoUrl={c.photoUrl} size={44} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, margin: 0, color: color.ink }}>{c.displayName}</p>
                  <CoachStarRating rating={c.avgRating} count={c.reviewCount} />
                </div>
                {c.hourlyRate ? <RateDisplay rate={c.hourlyRate} isPro={isPro} onSubscribe={onSubscribe} /> : null}
              </div>
              {c.headline && (
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: color.stone, lineHeight: 1.5, margin: "0 0 10px", fontWeight: 500 }}>
                  {c.headline.slice(0, 90)}{c.headline.length > 90 ? "…" : ""}
                </p>
              )}
              {c.firms.length > 0 && (
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: color.forest, margin: "0 0 12px", fontWeight: 500 }}>
                  {c.firms.slice(0, 3).join(" · ")}
                </p>
              )}
              <ScoutPrimaryBtn style={{ width: "100%", minHeight: 40, fontSize: 13 }}>View profile</ScoutPrimaryBtn>
            </ScoutBox>
          </Link>
        ))}
      </div>
    </div>
  );
}

function FilterSidebar({
  coaches,
  filters,
  onChange,
  onBatchChange,
  isMobile,
}: {
  coaches: CoachListItem[];
  filters: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onBatchChange: (patch: Record<string, string>) => void;
  isMobile: boolean;
}) {
  const allFirms = useMemo(() => Array.from(new Set(coaches.flatMap((c) => c.firms))).sort(), [coaches]);
  const allSpecialties = useMemo(() => Array.from(new Set(coaches.flatMap((c) => c.specialties))).sort(), [coaches]);

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
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--scout-muted)", margin: "0 0 12px" }}>
          Filters
        </p>

        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Hourly rate</span>
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
                onClick={() => {
                  onBatchChange({
                    rateMin: String(b.min),
                    rateMax: b.max != null ? String(b.max) : "",
                  });
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 0",
                  border: "none",
                  background: "none",
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  color: active ? color.forest : color.stone,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {b.label}
              </button>
            );
          })}
        </label>

        {allFirms.length > 0 && (
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Company</span>
            <select value={filters.firm ?? ""} onChange={(e) => onChange("firm", e.target.value)} style={fieldStyle}>
              <option value="">All companies</option>
              {allFirms.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
        )}

        {allSpecialties.length > 0 && (
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Expertise</span>
            <select value={filters.specialty ?? ""} onChange={(e) => onChange("specialty", e.target.value)} style={fieldStyle}>
              <option value="">All services</option>
              {allSpecialties.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        )}

        <label style={{ display: "block" }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Client focus</span>
          <select value={filters.specialization ?? ""} onChange={(e) => onChange("specialization", e.target.value)} style={fieldStyle}>
            <option value="">Any</option>
            {COACH_CLIENT_SPECIALIZATIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
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
}: {
  coach: CoachListItem;
  isMobile: boolean;
  isPro: boolean;
  onSubscribe: () => void;
  onFollow: (coach: CoachListItem) => void;
  following: boolean;
}) {
  const href = coachProfileHref(coach);

  return (
    <ScoutBox
      padding={isMobile ? "16px 18px" : "18px 22px"}
      style={{ border: coach.featured ? border.lineStrong : border.line, display: "flex", alignItems: "flex-start", gap: 16 }}
    >
      <Link href={href} style={{ flexShrink: 0 }}>
        <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={isMobile ? 56 : 72} />
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <div>
            <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, color: color.ink, margin: 0 }}>
                {coach.displayName}
                {coach.featured && (
                  <span style={{ marginLeft: 8, padding: "1px 7px", background: "rgba(196,168,106,0.15)", fontSize: 12, color: "#7A6020", fontWeight: 600 }}>
                    Featured
                  </span>
                )}
                {coach.isProfessionalCoach && (
                  <span style={{ marginLeft: 8, padding: "1px 7px", background: "rgba(26,58,47,0.08)", fontSize: 12, color: color.forest, fontWeight: 600 }}>
                    Pro coach
                  </span>
                )}
              </p>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              <CoachStarRating rating={coach.avgRating} count={coach.reviewCount} />
              {coach.currentRole && (
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--scout-muted)" }}>
                  {coach.currentRole}{coach.currentCompany ? ` · ${coach.currentCompany}` : ""}
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {coach.hourlyRate ? <RateDisplay rate={coach.hourlyRate} isPro={isPro} onSubscribe={onSubscribe} /> : null}
            {coach.location && (
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--scout-muted)", margin: "4px 0 0" }}>{coach.location}</p>
            )}
          </div>
        </div>

        {coach.headline && (
          <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: color.stone, lineHeight: 1.45, margin: "0 0 8px" }}>
              {coach.headline}
            </p>
          </Link>
        )}

        {(coach.bio) && (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: color.stone, lineHeight: 1.55, margin: "0 0 10px" }}>
            {bioSnippet(coach.bio, 160)}
          </p>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {coach.firms.slice(0, 3).map((f) => (
            <span key={f} style={{ padding: "3px 8px", background: "rgba(26,58,47,0.06)", fontFamily: "var(--font-ui)", fontSize: 12, color: color.forest, fontWeight: 500 }}>
              {f}
            </span>
          ))}
          {coach.specialties.slice(0, 4).map((s) => (
            <span key={s} style={{ padding: "3px 8px", background: "rgba(26,58,47,0.04)", fontFamily: "var(--font-ui)", fontSize: 12, color: color.forest }}>
              {s}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <ScoutSecondaryBtn onClick={() => onFollow(coach)} style={{ minHeight: isMobile ? 40 : 36, fontSize: 13 }}>
            {following ? "Following" : "+ Follow"}
          </ScoutSecondaryBtn>
          <Link href={href} style={{ textDecoration: "none" }}>
            <ScoutPrimaryBtn style={{ minHeight: isMobile ? 40 : 36, fontSize: 13 }}>
              {isPro ? "Free intro call" : "View profile"}
            </ScoutPrimaryBtn>
          </Link>
        </div>
      </div>
    </ScoutBox>
  );
}

export function CoachingDirectory({ category, isMobile, isPro, onSubscribe }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [coaches, setCoaches] = useState<CoachListItem[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<CoachFeaturedPreset | "">("");

  const filters = useMemo(() => {
    const o: Record<string, string> = {};
    for (const key of ["q", "firm", "specialty", "specialization", "rateMin", "rateMax", "sort"]) {
      const v = searchParams.get(key);
      if (v) o[key] = v;
    }
    return o;
  }, [searchParams]);

  const loadCoaches = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (filters.q) params.set("q", filters.q);
    if (filters.firm) params.set("firm", filters.firm);
    if (filters.specialty) params.set("specialty", filters.specialty);
    if (filters.specialization) params.set("specialization", filters.specialization);
    if (filters.rateMin) params.set("rateMin", filters.rateMin);
    if (filters.rateMax) params.set("rateMax", filters.rateMax);
    if (filters.sort) params.set("sort", filters.sort);
    if (preset) params.set("preset", preset);

    try {
      const [listRes, followRes] = await Promise.all([
        fetch(`/api/coaches?${params}`),
        fetch("/api/coaches/following"),
      ]);
      const list = await listRes.json();
      setCoaches(Array.isArray(list) ? list : []);
      if (followRes.ok) {
        const followed = await followRes.json();
        setFollowedIds(new Set((followed as CoachListItem[]).map((c) => c.id)));
      }
    } finally {
      setLoading(false);
    }
  }, [category, filters, preset]);

  useEffect(() => {
    loadCoaches();
  }, [loadCoaches]);

  const setFilters = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const base = category ? `/coaching/c/${categoryToSlug(category)}` : "/coaching";
    router.push(`${base}?${params.toString()}`);
  };

  const setFilter = (key: string, value: string) => setFilters({ [key]: value });

  const featuredCoaches = useMemo(
    () => coaches.filter((c) => c.featured).length ? coaches.filter((c) => c.featured) : coaches.slice(0, 6),
    [coaches],
  );

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
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: isMobile ? 22 : 26, fontWeight: 500, margin: "0 0 6px", color: color.ink }}>{title}</h2>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, maxWidth: 560, lineHeight: 1.6 }}>{subtitle}</p>
        </div>
        <select
          value={filters.sort ?? "default"}
          onChange={(e) => setFilter("sort", e.target.value === "default" ? "" : e.target.value)}
          style={{
            padding: "8px 12px",
            border: border.line,
            background: surface.inset,
            fontFamily: fontSans,
            fontSize: T.bodySm,
            color: color.ink,
          }}
        >
          <option value="default">Sort by default</option>
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
          value={filters.q ?? ""}
          onChange={(e) => setFilter("q", e.target.value)}
          style={{
            flex: 1,
            minWidth: isMobile ? "100%" : 240,
            padding: "10px 14px",
            border: border.line,
            background: surface.inset,
            fontFamily: fontSans,
            fontSize: T.bodySm,
            color: color.ink,
          }}
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

      <FeaturedCarousel coaches={featuredCoaches} isMobile={isMobile} isPro={isPro} onSubscribe={onSubscribe} />

      <div style={{ display: "flex", gap: 20, flexDirection: isMobile ? "column" : "row" }}>
        <FilterSidebar coaches={coaches} filters={filters} onChange={setFilter} onBatchChange={setFilters} isMobile={isMobile} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", marginBottom: 14 }}>
            {loading ? "Loading…" : `${coaches.length} coach${coaches.length !== 1 ? "es" : ""}`}
            {!isPro && <span style={{ marginLeft: 10, color: "#b45309" }}>Subscribe to see rates and book sessions</span>}
          </p>

          {!loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {coaches.map((c) => (
                <DirectoryRow
                  key={c.id}
                  coach={c}
                  isMobile={isMobile}
                  isPro={isPro}
                  onSubscribe={onSubscribe}
                  onFollow={toggleFollow}
                  following={followedIds.has(c.id)}
                />
              ))}
              {coaches.length === 0 && (
                <p style={{ color: "var(--scout-muted)", fontSize: 14, textAlign: "center", padding: "40px 0" }}>No coaches match your filters.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
