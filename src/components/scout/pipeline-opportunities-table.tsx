"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JobMeta } from "@/lib/job-meta";
import { companyLogoFromJobData } from "@/lib/cached-job";
import type { PipelineTagSummary } from "@/lib/pipeline-tags";
import { normalizePipelineTags } from "@/lib/pipeline-tags";
import {
  DEFAULT_PIPELINE_VISIBLE_COLUMNS,
  PIPELINE_COLUMNS,
  PIPELINE_SORT_OPTIONS,
  STAGE_SORT_ORDER,
  formatSavedDays,
  readStoredPipelineColumns,
  storePipelineColumns,
  type PipelineColumnId,
  type PipelineSortField,
} from "./pipeline-opportunities-columns";
import {
  PipelineStageBadge,
  PipelineStageFilterChip,
  PipelineStagePicker,
} from "./pipeline-stage-badge";
import { PipelineTagChip } from "./pipeline-job-tags";
import { CompanyLogo } from "./company-logo";
import { KANBAN_STAGES, STAGE_LABELS, type KanbanCard, type KanbanStage } from "./workspace-data";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type ScopePath = (path: string) => string;

type Props = {
  cards: KanbanCard[];
  scopePath: ScopePath;
  onOpenDrawer: (cardId: number) => void;
  onChangeStage: (cardId: number, stage: KanbanStage) => void;
};

const ACTIVE_STAGES: KanbanStage[] = ["saved", "applied", "interview", "offer"];
const line = "var(--scout-border)";

export function PipelineOpportunitiesTable({
  cards,
  scopePath,
  onOpenDrawer,
  onChangeStage,
}: Props) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<PipelineSortField>("saved");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [stageFilter, setStageFilter] = useState<Set<KanbanStage>>(() => new Set(ACTIVE_STAGES));
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<PipelineColumnId[]>(DEFAULT_PIPELINE_VISIBLE_COLUMNS);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [library, setLibrary] = useState<PipelineTagSummary[]>([]);
  const [page, setPage] = useState(1);
  const columnsRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 25;

  useEffect(() => {
    setVisibleColumns(readStoredPipelineColumns());
  }, []);

  useEffect(() => {
    void fetch(scopePath("/api/user/pipeline-tags"), { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { tags: [] }))
      .then((data: { tags?: PipelineTagSummary[] }) => setLibrary(data.tags ?? []))
      .catch(() => setLibrary([]));
  }, [scopePath]);

  const columnDefs = useMemo(
    () => PIPELINE_COLUMNS.filter((c) => visibleColumns.includes(c.id)),
    [visibleColumns],
  );

  const stageCounts = useMemo(() => {
    const counts: Record<KanbanStage, number> = {
      saved: 0,
      applied: 0,
      interview: 0,
      offer: 0,
      closed: 0,
    };
    for (const card of cards) counts[card.stage] += 1;
    return counts;
  }, [cards]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((card) => {
      if (!stageFilter.has(card.stage)) return false;
      if (tagFilter) {
        const ext = card as KanbanCard & { _pipelineTags?: string[]; _meta?: JobMeta };
        const tags = normalizePipelineTags(ext._pipelineTags ?? ext._meta?.pipelineTags ?? []);
        if (!tags.some((t) => t.toLowerCase() === tagFilter.toLowerCase())) return false;
      }
      if (!q) return true;
      return (
        card.role.toLowerCase().includes(q) ||
        card.company.toLowerCase().includes(q) ||
        (card as KanbanCard & { _meta?: JobMeta })._meta?.location?.toLowerCase().includes(q)
      );
    });
  }, [cards, search, stageFilter, tagFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "role":
          return dir * a.role.localeCompare(b.role);
        case "company":
          return dir * a.company.localeCompare(b.company);
        case "stage":
          return dir * (STAGE_SORT_ORDER[a.stage] - STAGE_SORT_ORDER[b.stage]);
        case "fit":
          return dir * ((a.fit ?? 0) - (b.fit ?? 0));
        case "saved":
        default:
          return dir * ((a.days ?? 999) - (b.days ?? 999));
      }
    });
  }, [filtered, sort, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, stageFilter, tagFilter, sort, sortDir]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (columnsOpen && columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnsOpen(false);
      }
      if (sortOpen && sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
      if (filterOpen && filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [columnsOpen, sortOpen, filterOpen]);

  function toggleColumn(id: PipelineColumnId) {
    setVisibleColumns((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      if (next.length === 0) return prev;
      storePipelineColumns(next);
      return next;
    });
  }

  function toggleStageFilter(stage: KanbanStage) {
    setStageFilter((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) {
        if (next.size <= 1) return prev;
        next.delete(stage);
      } else {
        next.add(stage);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === pageRows.length) setSelected(new Set());
    else setSelected(new Set(pageRows.map((c) => c.id)));
  }

  const bulkChangeStage = useCallback(
    (stage: KanbanStage) => {
      for (const id of selected) onChangeStage(id, stage);
      setSelected(new Set());
    },
    [selected, onChangeStage],
  );

  const tagOptions = useMemo(() => {
    const seen = new Map<string, PipelineTagSummary>();
    for (const row of library) seen.set(row.label.toLowerCase(), row);
    for (const card of cards) {
      const ext = card as KanbanCard & { _pipelineTags?: string[]; _meta?: JobMeta };
      for (const tag of normalizePipelineTags(ext._pipelineTags ?? ext._meta?.pipelineTags ?? [])) {
        const key = tag.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, { label: tag, color: "purple", variant: "light", jobCount: 1, inLibrary: false });
        }
      }
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [library, cards]);

  function renderCell(col: PipelineColumnId, row: KanbanCard) {
    const ext = row as KanbanCard & { _url?: string; _meta?: JobMeta; _pipelineTags?: string[] };
    const tags = normalizePipelineTags(ext._pipelineTags ?? ext._meta?.pipelineTags ?? []);
    const lookup = new Map(library.map((r) => [r.label.toLowerCase(), r]));

    switch (col) {
      case "role":
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <CompanyLogo {...companyLogoFromJobData(row.company, ext._meta)} size={28} />
            <span
              style={{
                fontFamily: fontSans,
                fontSize: T.body,
                fontWeight: 600,
                color: color.ink,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.role}
            </span>
          </div>
        );
      case "company":
        return <CellText value={row.company} />;
      case "stage":
        return <PipelineStageBadge stage={row.stage} />;
      case "tags":
        if (!tags.length) return <CellText value={null} />;
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }} onClick={(e) => e.stopPropagation()}>
            {tags.slice(0, 4).map((tag) => {
              const def = lookup.get(tag.toLowerCase());
              return (
                <PipelineTagChip
                  key={tag}
                  label={tag}
                  compact
                  color={def?.color}
                  variant={def?.variant}
                />
              );
            })}
            {tags.length > 4 && (
              <span style={{ fontFamily: fontSans, fontSize: 11, color: color.muted }}>+{tags.length - 4}</span>
            )}
          </div>
        );
      case "location":
        return <CellText value={ext._meta?.location ?? null} />;
      case "saved":
        return <CellText value={formatSavedDays(row.days)} />;
      case "fit":
        return row.fit ? <CellText value={`${row.fit}%`} /> : <CellText value={null} />;
      default:
        return null;
    }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: surface.card }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          borderBottom: line,
          background: "#FAFAFA",
        }}
      >
        <input
          type="search"
          placeholder="Search roles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 180,
            maxWidth: 360,
            padding: "8px 12px",
            border: line,
            borderRadius: 0,
            fontFamily: fontSans,
            fontSize: T.bodySm,
            background: "#fff",
          }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {ACTIVE_STAGES.map((stage) => (
            <PipelineStageFilterChip
              key={stage}
              stage={stage}
              active={stageFilter.has(stage)}
              count={stageCounts[stage]}
              onToggle={() => toggleStageFilter(stage)}
            />
          ))}
          {stageCounts.closed > 0 && (
            <PipelineStageFilterChip
              stage="closed"
              active={stageFilter.has("closed")}
              count={stageCounts.closed}
              onToggle={() => toggleStageFilter("closed")}
            />
          )}
        </div>

        <div ref={filterRef} style={{ position: "relative" }}>
          <button type="button" onClick={() => setFilterOpen((v) => !v)} style={toolbarBtn(Boolean(tagFilter))}>
            + Add filter{tagFilter ? " (1)" : ""}
          </button>
          {filterOpen && (
            <div style={{ ...popoverStyle, width: 260 }}>
              <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: 11, fontWeight: 700, color: color.muted }}>
                FILTER BY TAG
              </p>
              {tagOptions.length === 0 ? (
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
                  No tags yet — add tags from a job drawer.
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                  {tagOptions.map((row) => (
                    <button
                      key={row.label}
                      type="button"
                      onClick={() => {
                        setTagFilter(tagFilter?.toLowerCase() === row.label.toLowerCase() ? null : row.label);
                        setFilterOpen(false);
                      }}
                      style={{
                        border: tagFilter?.toLowerCase() === row.label.toLowerCase() ? "1.5px solid #161616" : "1.5px solid rgba(22,22,22,0.15)",
                        background: tagFilter?.toLowerCase() === row.label.toLowerCase() ? "rgba(174,122,255,0.12)" : "#fff",
                        borderRadius: 0,
                        padding: "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      <PipelineTagChip label={row.label} compact color={row.color} variant={row.variant} />
                    </button>
                  ))}
                </div>
              )}
              {tagFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setTagFilter(null);
                    setFilterOpen(false);
                  }}
                  style={{ ...footerBtn(false), marginTop: 10, width: "100%" }}
                >
                  Clear tag filter
                </button>
              )}
            </div>
          )}
        </div>

        <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, whiteSpace: "nowrap" }}>
          {sorted.length.toLocaleString()} role{sorted.length === 1 ? "" : "s"}
        </span>

        <div ref={sortRef} style={{ position: "relative" }}>
          <button type="button" onClick={() => setSortOpen((v) => !v)} style={toolbarBtn(false)}>
            ↕ Sort
          </button>
          {sortOpen && (
            <div style={popoverStyle}>
              {PIPELINE_SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (sort === opt.id) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                    else {
                      setSort(opt.id);
                      setSortDir(opt.id === "saved" ? "asc" : "desc");
                    }
                    setSortOpen(false);
                  }}
                  style={menuItem(sort === opt.id)}
                >
                  {opt.label}
                  {sort === opt.id ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </button>
              ))}
            </div>
          )}
        </div>

        <div ref={columnsRef} style={{ position: "relative" }}>
          <button type="button" onClick={() => setColumnsOpen((v) => !v)} style={toolbarBtn(false)}>
            ⊞ Columns
          </button>
          {columnsOpen && (
            <div style={{ ...popoverStyle, width: 240, maxHeight: 360, overflowY: "auto" }}>
              <p style={{ margin: "0 0 8px", padding: "0 4px", fontFamily: fontSans, fontSize: 11, fontWeight: 700, color: color.muted }}>
                OPPORTUNITIES
              </p>
              {PIPELINE_COLUMNS.map((col) => (
                <label
                  key={col.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 4px",
                    cursor: "pointer",
                    fontFamily: fontSans,
                    fontSize: 13,
                    color: color.ink,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.id)}
                    onChange={() => toggleColumn(col.id)}
                  />
                  {col.label}
                </label>
              ))}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, paddingTop: 10, borderTop: line }}>
                <button type="button" onClick={() => setColumnsOpen(false)} style={footerBtn(false)}>
                  Cancel
                </button>
                <button type="button" onClick={() => setColumnsOpen(false)} style={footerBtn(true)}>
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 16px",
            borderBottom: line,
            background: "rgba(174,122,255,0.08)",
          }}
        >
          <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>
            {selected.size} selected
          </span>
          <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <select
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value as KanbanStage;
                if (v) bulkChangeStage(v);
                e.target.value = "";
              }}
              style={{
                padding: "6px 12px",
                border: "1.5px solid #161616",
                borderRadius: 0,
                fontFamily: fontSans,
                fontSize: T.caption,
                fontWeight: 600,
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <option value="" disabled>
                Change stage…
              </option>
              {KANBAN_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            style={{ ...footerBtn(false), marginLeft: "auto" }}
          >
            Clear selection
          </button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "#F5F5F5", borderBottom: line }}>
              <th style={{ ...thStyle, width: 40 }}>
                <input
                  type="checkbox"
                  checked={pageRows.length > 0 && selected.size === pageRows.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th style={{ ...thStyle, width: 120 }}>Actions</th>
              {columnDefs.map((col) => (
                <th key={col.id} style={{ ...thStyle, minWidth: col.minWidth }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={columnDefs.length + 2}
                  style={{ padding: 40, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, textAlign: "center" }}
                >
                  {cards.length === 0
                    ? "No roles in your pipeline yet — save one from Find opportunities or paste a job URL."
                    : "No roles match your filters."}
                </td>
              </tr>
            )}
            {pageRows.map((row) => {
              const ext = row as KanbanCard & { _url?: string };
              return (
                <tr
                  key={row.id}
                  onClick={() => onOpenDrawer(row.id)}
                  style={{
                    borderBottom: line,
                    cursor: "pointer",
                    background: selected.has(row.id) ? "rgba(174,122,255,0.06)" : "#fff",
                  }}
                  onMouseEnter={(e) => {
                    if (!selected.has(row.id)) e.currentTarget.style.background = "#FAFAFA";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = selected.has(row.id) ? "rgba(174,122,255,0.06)" : "#fff";
                  }}
                >
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(row.id)) next.delete(row.id);
                          else next.add(row.id);
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <PipelineStagePicker
                        stage={row.stage}
                        onChange={(s) => onChangeStage(row.id, s)}
                      />
                      {ext._url && (
                        <a
                          href={ext._url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontFamily: fontSans, fontSize: 11, color: color.muted, textDecoration: "underline" }}
                        >
                          ↗
                        </a>
                      )}
                    </div>
                  </td>
                  {columnDefs.map((col) => (
                    <td key={col.id} style={tdStyle}>
                      {renderCell(col.id, row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length > PAGE_SIZE && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            borderTop: line,
            background: "#FAFAFA",
          }}
        >
          <span style={{ fontFamily: fontSans, fontSize: 12, color: color.muted }}>
            Page {page} of {totalPages}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={pageBtn(page <= 1)}>
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={pageBtn(page >= totalPages)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CellText({ value }: { value: string | null | undefined }) {
  return (
    <span
      style={{
        fontFamily: fontSans,
        fontSize: T.bodySm,
        color: value ? color.ink : color.muted,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        display: "block",
      }}
    >
      {value ?? "—"}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  padding: "12px 14px",
  textAlign: "left",
  fontFamily: fontSans,
  fontSize: T.caption,
  fontWeight: 700,
  color: color.muted,
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  zIndex: 1,
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  verticalAlign: "middle",
  overflow: "hidden",
};

const popoverStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  right: 0,
  background: "#fff",
  border: border.line,
  borderRadius: 0,
  boxShadow: "3px 3px 0 #161616",
  padding: 12,
  zIndex: 50,
  minWidth: 200,
};

function toolbarBtn(active: boolean): React.CSSProperties {
  return {
    padding: "7px 12px",
    borderRadius: 0,
    border: active ? "1.5px solid #161616" : "1.5px solid rgba(22,22,22,0.15)",
    background: active ? "rgba(174,122,255,0.12)" : "#fff",
    boxShadow: active ? "2px 2px 0 #161616" : "none",
    fontFamily: fontSans,
    fontSize: T.bodySm,
    fontWeight: 600,
    color: color.ink,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function menuItem(active: boolean): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "8px 10px",
    border: "none",
    borderRadius: 0,
    background: active ? "rgba(174,122,255,0.1)" : "transparent",
    fontFamily: fontSans,
    fontSize: 13,
    cursor: "pointer",
    color: color.ink,
  };
}

function footerBtn(primary: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 0,
    border: primary ? "1.5px solid #161616" : "none",
    background: primary ? "#161616" : "transparent",
    color: primary ? "#fff" : color.muted,
    fontFamily: fontSans,
    fontSize: T.bodySm,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 0,
    border: "1.5px solid rgba(22,22,22,0.15)",
    background: "#fff",
    fontFamily: fontSans,
    fontSize: T.bodySm,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
