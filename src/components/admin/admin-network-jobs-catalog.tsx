"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { NetworkJobSource } from "@prisma/client";
import { JobDrawer } from "@/components/scout/job-drawer";
import { CompanyLogo } from "@/components/scout/company-logo";
import {
  buildNetworkProspectCard,
  networkAgencyDisplayName,
  previewPlainText,
  type NetworkJobListing,
} from "@/lib/network-job-display";
import { networkExecThreadRecruitingFirmLabel } from "@/lib/network-employer-labels";
import {
  networkSourceAdminName,
  networkSourceChannelCode,
} from "@/lib/network-source-labels";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { color, displayTitleStyle, fontMono, fontSans, border, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";

type CatalogSource = NetworkJobSource | "ALL";

type CatalogStats = {
  total: number;
  execthread: number;
  topechelon: number;
};

type CatalogResponse = {
  ok?: boolean;
  jobs?: NetworkJobListing[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  stats?: CatalogStats;
};

const PAGE_SIZE = 25;

const SOURCE_TABS: { id: CatalogSource; label: string }[] = [
  { id: "ALL", label: "All scraped" },
  { id: "EXECTHREAD", label: "ExecThread" },
  { id: "TOPECHELON", label: "Top Echelon" },
];

function CatalogJobCard({
  job,
  onOpen,
}: {
  job: NetworkJobListing;
  onOpen: () => void;
}) {
  const company = networkAgencyDisplayName(job);
  const recruitingFirm =
    job.source === "EXECTHREAD" ? networkExecThreadRecruitingFirmLabel(job) : job.agencyName;
  const summary = previewPlainText(job.description);
  const syncedLabel = job.sharedAtLabel ?? null;

  return (
    <ScoutBox padding={18}>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        style={{ display: "flex", gap: 16, alignItems: "flex-start", cursor: "pointer" }}
      >
        <CompanyLogo
          name={company}
          logoUrl={job.agencyLogoUrl?.trim() || null}
          website={job.agencyWebsite ?? null}
          skipDomainLookup
          size={44}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span
              style={{
                padding: "2px 8px",
                border: "var(--scout-border)",
                fontFamily: fontMono,
                fontSize: T.label,
                fontWeight: 700,
                color: color.forest,
              }}
            >
              {networkSourceChannelCode(job.source)}
            </span>
            {job.networkStatusLabel && (
              <span
                style={{
                  padding: "2px 8px",
                  border: "var(--scout-border)",
                  fontFamily: fontSans,
                  fontSize: T.label,
                  fontWeight: 600,
                  color: color.forest,
                }}
              >
                {job.networkStatusLabel}
              </span>
            )}
            {job.networkId && (
              <span style={{ fontFamily: fontMono, fontSize: T.label, color: color.mutedLight }}>
                {job.networkId}
              </span>
            )}
          </div>

          <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>
            {job.positionTitle}
          </p>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 4px" }}>
            {company}
            {job.location ? ` · ${job.location}` : ""}
          </p>
          {syncedLabel && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, margin: "0 0 8px" }}>
              Synced {syncedLabel}
            </p>
          )}
          {recruitingFirm && recruitingFirm !== company && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 8px" }}>
              Recruiting firm: {recruitingFirm}
            </p>
          )}
          {summary && (
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.caption,
                color: color.muted,
                margin: 0,
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {summary}
            </p>
          )}
        </div>
      </div>
    </ScoutBox>
  );
}

export function AdminNetworkJobsCatalog() {
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const initialSource = searchParams.get("source");
  const [source, setSource] = useState<CatalogSource>(() => {
    if (initialSource === "EXECTHREAD" || initialSource === "TOPECHELON") return initialSource;
    return "ALL";
  });
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [etCatalogTotal, setEtCatalogTotal] = useState<number | null>(null);
  const [etPreviewLoading, setEtPreviewLoading] = useState(false);
  const [catalogProgress, setCatalogProgress] = useState<{ from: number; totalHits: number | null; complete: boolean } | null>(null);
  const [selectedJob, setSelectedJob] = useState<NetworkJobListing | null>(null);
  const [prospectCard, setProspectCard] = useState<ReturnType<typeof buildNetworkProspectCard> | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (source !== "ALL") params.set("source", source);
      if (appliedQ.trim()) params.set("q", appliedQ.trim());

      const res = await fetch(`/api/admin/network-jobs?${params.toString()}`);
      if (res.ok) {
        setCatalog((await res.json()) as CatalogResponse);
      }
    } finally {
      setLoading(false);
    }
  }, [appliedQ, page, source]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const loadEtPreview = useCallback(async () => {
    setEtPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/execthread/catalog-preview");
      const data = (await res.json()) as { ok?: boolean; totalHits?: number | null; error?: string };
      if (res.ok && data.ok) {
        setEtCatalogTotal(data.totalHits ?? null);
      }
    } finally {
      setEtPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (source === "EXECTHREAD" || source === "ALL") {
      void loadEtPreview();
      void fetch("/api/admin/execthread")
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { catalogImportFrom?: number; catalogImportTotalHits?: number | null; catalogImportComplete?: boolean } | null) => {
          if (data) {
            setCatalogProgress({
              from: data.catalogImportFrom ?? 0,
              totalHits: data.catalogImportTotalHits ?? null,
              complete: data.catalogImportComplete ?? false,
            });
          }
        })
        .catch(() => {});
    }
  }, [loadEtPreview, source]);

  const catalogComplete = catalogProgress?.complete ?? false;

  const stats = catalog?.stats;
  const jobs = catalog?.jobs ?? [];
  const total = catalog?.total ?? 0;
  const totalPages = catalog?.totalPages ?? 1;

  const sourceLabel = useMemo(() => {
    if (source === "ALL") return "scraped network jobs";
    return networkSourceAdminName(source);
  }, [source]);

  const openJob = (job: NetworkJobListing) => {
    const drawerId = -Math.abs(Date.now() % 1_000_000);
    setSelectedJob(job);
    setProspectCard(buildNetworkProspectCard(job, drawerId, { internalView: true }));
  };

  const closeDrawer = () => {
    setSelectedJob(null);
    setProspectCard(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <Link
          href="/admin/dashboard"
          style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, textDecoration: "none" }}
        >
          ← Admin dashboard
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block" }} />
          <ScoutLabel>Network catalog</ScoutLabel>
        </div>
        <ScoutDisplayTitle size={36} style={{ marginBottom: 8 }}>
          Scraped listings
        </ScoutDisplayTitle>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, maxWidth: 720, lineHeight: 1.6 }}>
          Browse everything Kimchi has imported from ExecThread and Top Echelon — same drawer experience as In-Network Roles,
          with internal admin details (fees, apply links, recruiter contacts when available).
        </p>
      </div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          <Stat label="Total scraped" value={String(stats.total)} />
          <Stat label="ExecThread" value={String(stats.execthread)} />
          <Stat label="Top Echelon" value={String(stats.topechelon)} />
          {etCatalogTotal != null && (
            <Stat
              label="ET catalog (live)"
              value={etCatalogTotal.toLocaleString()}
              sub={etPreviewLoading ? "Checking…" : "US/CA filter via EXECTHREAD_SEARCH_JSON"}
            />
          )}
        </div>
      )}

      {(source === "EXECTHREAD" || source === "ALL") && etCatalogTotal != null && stats && !catalogComplete && (
        <ScoutBox padding={20}>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink, margin: "0 0 8px" }}>
            ExecThread catalog import — automated
          </p>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 8px", lineHeight: 1.55, maxWidth: 640 }}>
            Cron imports ~3,000 summaries every 15 minutes until all {etCatalogTotal.toLocaleString()} listings are stored
            ({stats.execthread.toLocaleString()} so far
            {catalogProgress != null ? ` · offset ${catalogProgress.from.toLocaleString()}` : ""}).
            Full descriptions and contacts backfill automatically after the catalog pass completes.
          </p>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0, lineHeight: 1.55 }}>
            Kick it now from Admin → ExecThread → <strong>Run catalog batch now</strong>.
          </p>
        </ScoutBox>
      )}

      <ScoutBox padding={20}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 16,
            borderBottom: "var(--scout-border)",
            paddingBottom: 12,
          }}
        >
          {SOURCE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSource(tab.id);
                setPage(1);
              }}
              style={{
                padding: "8px 14px",
                border: source === tab.id ? "var(--scout-border)" : "var(--scout-border)",
                background: source === tab.id ? "rgba(26,58,47,0.08)" : surface.card,
                fontFamily: fontSans,
                fontSize: T.caption,
                fontWeight: source === tab.id ? 700 : 500,
                color: source === tab.id ? color.forest : color.muted,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: 12,
            alignItems: isMobile ? "stretch" : "flex-end",
            marginBottom: 16,
          }}
        >
          <label style={{ flex: 1, display: "grid", gap: 4 }}>
            <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600 }}>Search scraped jobs</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setAppliedQ(q);
                  setPage(1);
                }
              }}
              placeholder="Title, company, location, ID…"
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "var(--scout-border)",
                fontFamily: fontSans,
                fontSize: T.bodySm,
                background: surface.card,
                boxSizing: "border-box",
              }}
            />
          </label>
          <ScoutPrimaryBtn
            onClick={() => {
              setAppliedQ(q);
              setPage(1);
            }}
            style={{ minHeight: 40 }}
          >
            Search
          </ScoutPrimaryBtn>
          {appliedQ && (
            <ScoutSecondaryBtn
              onClick={() => {
                setQ("");
                setAppliedQ("");
                setPage(1);
              }}
              style={{ minHeight: 40 }}
            >
              Clear
            </ScoutSecondaryBtn>
          )}
        </div>

        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 16px" }}>
          {loading
            ? "Loading…"
            : `${total.toLocaleString()} ${sourceLabel}${appliedQ ? ` matching “${appliedQ}”` : ""}`}
        </p>

        {loading ? (
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>Loading catalog…</p>
        ) : jobs.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
            No scraped jobs yet — run a sync from the admin dashboard, or import ExecThread catalog pages above.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {jobs.map((job) => (
              <CatalogJobCard key={`${job.source}-${job.id}`} job={job} onOpen={() => openJob(job)} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 20,
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <ScoutSecondaryBtn disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </ScoutSecondaryBtn>
            <span style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted }}>
              Page {page} of {totalPages}
            </span>
            <ScoutSecondaryBtn disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </ScoutSecondaryBtn>
          </div>
        )}
      </ScoutBox>

      {prospectCard && selectedJob && (
        <JobDrawer
          card={prospectCard}
          onClose={closeDrawer}
          moveCard={() => {}}
          onDelete={closeDrawer}
          onCardUpdate={() => {}}
          prospectMode
          elevated
        />
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <ScoutBox padding="16px 18px">
      <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "0 0 4px", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 700, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, margin: "4px 0 0" }}>{sub}</p>}
    </ScoutBox>
  );
}
