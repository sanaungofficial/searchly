"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CompanyLogo } from "@/components/scout/company-logo";
import type { CompanyEnrichmentCache } from "@/lib/hirebase-company-sync";

type CachedJob = {
  title: string;
  location: string | null;
  department: string | null;
  url: string | null;
};

type JobsCache = {
  jobs: CachedJob[];
  scanned_url: string;
  source?: string | null;
  hirebase_slug?: string | null;
  total_count?: number | null;
};

export type CompanyIntelDetail = {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  careersUrl: string | null;
  catalogType: string | null;
  watchlistCount: number;
  enrichmentCache: CompanyEnrichmentCache | null;
  enrichmentFetchedAt: string | null;
  jobsCache: JobsCache | null;
  lastJobsFetchedAt: string | null;
  jobCount: number;
  jobsSource: string | null;
  hirebaseSlug: string | null;
  hirebaseJobBoard: string | null;
  hirebaseOpenJobs: number | null;
  hirebaseLinkedIn: string | null;
  hirebaseLogo: string | null;
  hirebaseSubindustries: string[];
  hirebaseSyncedAt: string | null;
  hirebaseProfileAt: string | null;
  stale: boolean;
  scannable: boolean;
  inTop50Catalog: boolean;
};

function formatWhen(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

function externalHref(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[rgba(17,17,17,0.06)] last:border-0">
      <span className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-[#52493F] leading-relaxed break-words">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--scout-muted)] mb-3">{title}</h3>
      {children}
    </section>
  );
}

export function CompanyIntelDrawer({
  intelId,
  onClose,
  onUpdated,
}: {
  intelId: string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [company, setCompany] = useState<CompanyIntelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/company-scans/${intelId}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't load company intel.");
        setCompany(null);
        return;
      }
      setCompany(body.company);
    } catch {
      setError("Network error — couldn't load company intel.");
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [intelId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function scanJobs() {
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch(`/api/admin/company-scans/${intelId}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setScanError(body.error ?? "Scan failed.");
        return;
      }
      setCompany(body.company);
      onUpdated?.();
    } catch {
      setScanError("Network error — couldn't scan jobs.");
    } finally {
      setScanning(false);
    }
  }

  if (!mounted) return null;

  const intel = company?.enrichmentCache ?? null;
  const jobs = company?.jobsCache?.jobs ?? [];
  const hirebaseLogo = company?.hirebaseLogo;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[200]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-[var(--scout-surface)] z-[201] shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={company?.name ?? "Company intel"}
      >
        <div className="px-6 py-5 border-b border-[rgba(17,17,17,0.08)] flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            {hirebaseLogo ? (
              <img
                src={hirebaseLogo}
                alt=""
                className="rounded-none object-contain bg-[var(--scout-inset)] border border-[rgba(17,17,17,0.08)]"
                style={{ width: 44, height: 44 }}
              />
            ) : (
              <CompanyLogo
                name={company?.name ?? "Company"}
                website={company?.website}
                careersUrl={company?.careersUrl}
                enrichmentWebsiteUrl={intel?.websiteUrl}
                size={44}
                borderRadius={0}
              />
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[#1A1A1A] truncate">
                {loading ? "Loading…" : company?.name ?? "Company intel"}
              </h2>
              {company && (
                <div className="flex flex-wrap gap-3 mt-1 text-xs">
                  {company.website && (
                    <a href={externalHref(company.website)} target="_blank" rel="noopener noreferrer" className="text-[#52493F] underline">
                      Website
                    </a>
                  )}
                  {company.careersUrl && (
                    <a href={externalHref(company.careersUrl)} target="_blank" rel="noopener noreferrer" className="text-[#52493F] underline">
                      Careers
                    </a>
                  )}
                  {company.hirebaseLinkedIn && (
                    <a href={externalHref(company.hirebaseLinkedIn)} target="_blank" rel="noopener noreferrer" className="text-[#52493F] underline">
                      LinkedIn
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--scout-muted)] hover:text-[#52493F] text-2xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && <p className="text-sm text-[var(--scout-muted)]">Loading company intel…</p>}
          {error && <p className="text-sm text-amber-700">{error}</p>}

          {company && !loading && (
            <>
              <Section title="Overview">
                <div className="rounded-none border border-[rgba(17,17,17,0.08)] bg-[var(--scout-inset)]/60 px-4 py-3">
                  <DetailRow label="Catalog slug" value={company.slug} />
                  <DetailRow label="Type" value={company.catalogType} />
                  <DetailRow label="Watchlists" value={String(company.watchlistCount)} />
                  <DetailRow label="Profile updated" value={formatWhen(company.enrichmentFetchedAt)} />
                  <DetailRow
                    label="Scan status"
                    value={
                      !company.scannable
                        ? "Not scannable"
                        : company.stale
                          ? "Stale — needs refresh"
                          : "Fresh"
                    }
                  />
                </div>
              </Section>

              {(company.hirebaseProfileAt || company.hirebaseSlug) && (
                <Section title="Hirebase">
                  <div className="rounded-none border border-[rgba(17,17,17,0.08)] bg-[var(--scout-inset)]/60 px-4 py-3">
                    <DetailRow label="Slug" value={company.hirebaseSlug} />
                    <DetailRow label="Job board" value={company.hirebaseJobBoard} />
                    <DetailRow
                      label="Open roles"
                      value={company.hirebaseOpenJobs != null ? company.hirebaseOpenJobs.toLocaleString() : null}
                    />
                    <DetailRow
                      label="Sub-industries"
                      value={company.hirebaseSubindustries.length ? company.hirebaseSubindustries.join(", ") : null}
                    />
                    <DetailRow label="Synced" value={formatWhen(company.hirebaseSyncedAt)} />
                  </div>
                </Section>
              )}

              <Section title="Company profile">
                {!intel ? (
                  <p className="text-sm text-[var(--scout-muted)]">No enrichment yet. Run Hirebase sync or AI enrich from the watchlist.</p>
                ) : (
                  <div>
                    {intel.description && (
                      <p className="text-sm text-[#52493F] leading-relaxed mb-4">{intel.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {intel.employeeCount && (
                        <span className="rounded-none bg-[var(--scout-inset)] px-2 py-1 text-xs text-[#52493F]">{intel.employeeCount} employees</span>
                      )}
                      {intel.industry && (
                        <span className="rounded-none bg-[var(--scout-inset)] px-2 py-1 text-xs text-[#52493F]">{intel.industry}</span>
                      )}
                      {intel.founded && (
                        <span className="rounded-none bg-[var(--scout-inset)] px-2 py-1 text-xs text-[#52493F]">Founded {intel.founded}</span>
                      )}
                      {intel.headquarters && (
                        <span className="rounded-none bg-[var(--scout-inset)] px-2 py-1 text-xs text-[#52493F]">{intel.headquarters}</span>
                      )}
                      {intel.glassdoorRating && (
                        <span className="rounded-none bg-[rgba(26,58,47,0.08)] border border-[rgba(26,58,47,0.15)] px-2 py-1 text-xs text-[#1A3A2F]">★ {intel.glassdoorRating} Glassdoor</span>
                      )}
                    </div>

                    {(intel.fundingStage || intel.totalFunding || (intel.keyInvestors?.length ?? 0) > 0) && (
                      <div className="rounded-none border border-[rgba(17,17,17,0.08)] px-4 py-3 mb-4">
                        <DetailRow label="Funding stage" value={intel.fundingStage} />
                        <DetailRow label="Total funding" value={intel.totalFunding} />
                        <DetailRow label="Investors" value={intel.keyInvestors?.join(", ")} />
                      </div>
                    )}

                    {(intel.leadership?.length ?? 0) > 0 && (
                      <div className="grid gap-2 mb-4">
                        {intel.leadership!.map((leader, i) => (
                          <div key={i} className="rounded-none border border-[rgba(17,17,17,0.08)] px-3 py-2">
                            <div className="text-sm font-medium text-[#1A1A1A]">{leader.name}</div>
                            <div className="text-xs text-[var(--scout-muted)]">{leader.title}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(intel.recentNews?.length ?? 0) > 0 && (
                      <div className="space-y-2">
                        {intel.recentNews!.map((item, i) => (
                          <div key={i} className="rounded-none border border-[rgba(17,17,17,0.08)] px-3 py-2">
                            <div className="text-sm font-medium text-[#1A1A1A]">{item.title}</div>
                            <div className="text-xs text-[var(--scout-muted)] mt-1">{item.summary}</div>
                            <div className="text-xs text-[var(--scout-muted)] mt-1">{item.date}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {intel._primarySource === "hirebase" && (
                      <p className="text-xs text-[var(--scout-muted)] mt-3">Primary source: Hirebase verified profile</p>
                    )}
                  </div>
                )}
              </Section>

              <Section title="Cached roles">
                <div className="flex items-center gap-3 mb-3">
                  <button
                    type="button"
                    onClick={scanJobs}
                    disabled={scanning || !company.scannable}
                    className="rounded-none bg-stone-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {scanning ? "Scanning…" : jobs.length > 0 ? "Re-scan jobs" : "Scan jobs"}
                  </button>
                  <span className="text-xs text-[var(--scout-muted)]">
                    Last scanned {formatWhen(company.lastJobsFetchedAt)}
                    {company.jobsSource ? ` · ${company.jobsSource}` : ""}
                  </span>
                </div>
                {scanError && <p className="text-xs text-amber-700 mb-3">{scanError}</p>}
                {!company.scannable && (
                  <p className="text-sm text-[var(--scout-muted)] mb-3">Add a careers URL or configure Hirebase to scan roles.</p>
                )}
                {jobs.length === 0 ? (
                  <p className="text-sm text-[var(--scout-muted)]">No cached roles yet.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {jobs.slice(0, 50).map((job, i) => (
                      <div key={`${job.title}-${i}`} className="rounded-none border border-[rgba(17,17,17,0.08)] px-3 py-2">
                        <div className="text-sm font-medium text-[#1A1A1A]">{job.title}</div>
                        <div className="text-xs text-[var(--scout-muted)] mt-1">
                          {[job.location, job.department].filter(Boolean).join(" · ") || "No location"}
                        </div>
                        {job.url && (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#52493F] underline mt-1 inline-block"
                          >
                            View posting
                          </a>
                        )}
                      </div>
                    ))}
                    {jobs.length > 50 && (
                      <p className="text-xs text-[var(--scout-muted)]">Showing first 50 of {jobs.length} cached roles.</p>
                    )}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </aside>
    </>,
    document.body
  );
}
