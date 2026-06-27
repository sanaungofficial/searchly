"use client";

import { useEffect, useMemo, useState } from "react";
import { CompanyLogo } from "@/components/scout/company-logo";
import { CoachCompanyDrawer } from "@/components/scout/coach-company-drawer";
import { ScoutBox } from "@/components/scout/scout-box";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  buildCoachExperienceCompanies,
  type CoachCompanyLookupMeta,
  type CoachExperienceCompany,
} from "@/lib/coach-experience-companies";
import { normalizeCompanySlug } from "@/lib/company-catalog";
import type { CoachListItem } from "@/lib/coach-types";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type TrackedRow = {
  id: string;
  name: string;
  companyIntelId?: string | null;
};

type SuggestRow = {
  catalogSlug: string;
  name: string;
  logoUrl?: string | null;
  website?: string | null;
  careersUrl?: string | null;
};

function metaForCompany(
  company: CoachExperienceCompany,
  lookup: Record<string, CoachCompanyLookupMeta>,
): CoachCompanyLookupMeta {
  const hit = lookup[company.key];
  return {
    name: hit?.name ?? company.displayName,
    logoUrl: hit?.logoUrl ?? null,
    website: hit?.website ?? null,
    careersUrl: hit?.careersUrl ?? null,
  };
}

function ExperienceRow({
  company,
  meta,
  onWatchlist,
  onClick,
}: {
  company: CoachExperienceCompany;
  meta: CoachCompanyLookupMeta;
  onWatchlist: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: surface.card,
        border: border.line,
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <CompanyLogo
        name={meta.name}
        logoUrl={meta.logoUrl}
        website={meta.website}
        careersUrl={meta.careersUrl}
        size={36}
        borderRadius={8}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.ink, margin: 0, lineHeight: 1.3 }}>
          {company.label}
        </p>
        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "2px 0 0" }}>
          {onWatchlist ? "On your watchlist · View details" : "View company · Add to watchlist"}
        </p>
      </div>
      <span style={{ fontFamily: fontSans, fontSize: 13, color: color.forest, fontWeight: 600, flexShrink: 0 }}>
        →
      </span>
    </button>
  );
}

export function CoachExperienceCompanies({
  coach,
  isMobile = false,
  embedded = false,
}: {
  coach: Pick<CoachListItem, "currentCompany" | "firms" | "displayName">;
  isMobile?: boolean;
  embedded?: boolean;
}) {
  const { withClientScope } = useWorkspace();
  const companies = useMemo(
    () => buildCoachExperienceCompanies(coach),
    [coach.currentCompany, coach.firms],
  );
  const [lookup, setLookup] = useState<Record<string, CoachCompanyLookupMeta>>({});
  const [watchlistBySlug, setWatchlistBySlug] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<CoachExperienceCompany | null>(null);

  useEffect(() => {
    if (!companies.length) return;
    let cancelled = false;

    fetch("/api/coaches/companies/suggest?limit=80")
      .then((r) => (r.ok ? r.json() : []))
      .then((items: SuggestRow[]) => {
        if (cancelled || !Array.isArray(items)) return;
        const map: Record<string, CoachCompanyLookupMeta> = {};
        for (const item of items) {
          const slug = item.catalogSlug?.toLowerCase();
          if (!slug) continue;
          map[slug] = {
            name: item.name,
            logoUrl: item.logoUrl ?? null,
            website: item.website ?? null,
            careersUrl: item.careersUrl ?? null,
          };
        }
        setLookup(map);
      })
      .catch(() => {});

    fetch(withClientScope("/api/companies"))
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: TrackedRow[]) => {
        if (cancelled || !Array.isArray(rows)) return;
        const bySlug: Record<string, string> = {};
        for (const row of rows) {
          const slug = normalizeCompanySlug(row.name);
          if (slug) bySlug[slug] = row.id;
        }
        setWatchlistBySlug(bySlug);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [companies.length, withClientScope]);

  if (!companies.length) return null;

  const selectedMeta = selected ? metaForCompany(selected, lookup) : null;
  const selectedTrackedId = selected ? watchlistBySlug[selected.key] ?? null : null;

  const content = (
  <>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {companies.map((company) => (
        <ExperienceRow
          key={company.key}
          company={company}
          meta={metaForCompany(company, lookup)}
          onWatchlist={Boolean(watchlistBySlug[company.key])}
          onClick={() => setSelected(company)}
        />
      ))}
    </div>
    {selected && selectedMeta && (
      <CoachCompanyDrawer
        company={selected}
        meta={selectedMeta}
        trackedId={selectedTrackedId}
        isMobile={isMobile}
        onClose={() => setSelected(null)}
        onWatchlistChange={(slug, trackedId) => {
          setWatchlistBySlug((prev) => ({ ...prev, [slug]: trackedId }));
        }}
      />
    )}
  </>
  );

  if (embedded) {
    return (
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>
          {coach.displayName.split(" ")[0]}&apos;s experience
        </h3>
        {content}
      </div>
    );
  }

  return (
    <ScoutBox padding={isMobile ? 16 : 20} style={{ marginBottom: 16 }}>
      <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Experience</h3>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 14px", lineHeight: 1.45 }}>
        Companies this coach has worked at. Open a profile or add to your watchlist.
      </p>
      {content}
    </ScoutBox>
  );
}
