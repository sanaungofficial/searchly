"use client";

import type { CompensationBand } from "@/lib/network-job-format";
import { COMPENSATION_BAND_LABELS } from "@/lib/network-job-format";
import {
  type NetworkJobFilterOptions,
  type NetworkJobFilters,
  countActiveNetworkFilters,
  toggleFilterValue,
} from "@/lib/network-job-filters";
import { ScoutBox, ScoutLabel } from "./scout-box";
import { fontSans, fontMono, color, surface, border, type as T } from "@/lib/typography";

interface NetworkJobFilterPanelProps {
  filters: NetworkJobFilters;
  options: NetworkJobFilterOptions;
  totalCount: number;
  filteredCount: number;
  onChange: (next: NetworkJobFilters) => void;
  wideLayout?: boolean;
}

function FilterGroup({
  label,
  values,
  selected,
  onToggle,
  formatLabel,
}: {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  formatLabel?: (value: string) => string;
}) {
  if (values.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: color.muted, margin: "0 0 8px" }}>
        {label}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {values.map((value) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onToggle(value)}
              style={{
                padding: "5px 10px",
                border: active ? border.lineStrong : border.line,
                background: active ? surface.inset : surface.card,
                fontFamily: fontSans,
                fontSize: T.caption,
                fontWeight: active ? 600 : 500,
                color: active ? color.forest : color.stone,
                cursor: "pointer",
              }}
            >
              {formatLabel ? formatLabel(value) : value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function NetworkJobFilterPanel({
  filters,
  options,
  totalCount,
  filteredCount,
  onChange,
  wideLayout,
}: NetworkJobFilterPanelProps) {
  const activeCount = countActiveNetworkFilters(filters);

  const set = (patch: Partial<NetworkJobFilters>) => onChange({ ...filters, ...patch });
  const toggle = <K extends keyof NetworkJobFilters>(key: K, value: NetworkJobFilters[K] extends string[] ? string : never) => {
    const current = filters[key] as string[];
    set({ [key]: toggleFilterValue(current, value) } as Partial<NetworkJobFilters>);
  };

  const searchInput = (
    <input
      type="search"
      placeholder="Search roles, companies, recruiters…"
      value={filters.search}
      onChange={(e) => set({ search: e.target.value })}
      style={{
        width: "100%",
        padding: "10px 12px",
        border: border.line,
        background: surface.card,
        fontFamily: fontSans,
        fontSize: T.bodySm,
        color: color.ink,
        marginBottom: 16,
      }}
    />
  );

  const filterGroups = (
    <>
      <FilterGroup label="Location" values={options.locations} selected={filters.locations} onToggle={(v) => toggle("locations", v)} />
      <FilterGroup label="Industry" values={options.industries} selected={filters.industries} onToggle={(v) => toggle("industries", v)} />
      <FilterGroup label="Status" values={options.statuses} selected={filters.statuses} onToggle={(v) => toggle("statuses", v)} />
      <FilterGroup label="Job type" values={options.jobTypes} selected={filters.jobTypes} onToggle={(v) => toggle("jobTypes", v)} />
      <FilterGroup label="Remote" values={options.remoteOptions} selected={filters.remoteOptions} onToggle={(v) => toggle("remoteOptions", v)} />
      <FilterGroup
        label="Compensation"
        values={options.compensationBands}
        selected={filters.compensationBands}
        onToggle={(v) => toggle("compensationBands", v as CompensationBand)}
        formatLabel={(v) => COMPENSATION_BAND_LABELS[v as CompensationBand] ?? v}
      />
      <FilterGroup label="Agency" values={options.agencies} selected={filters.agencies} onToggle={(v) => toggle("agencies", v)} />
    </>
  );

  const summary = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
        {filteredCount === totalCount ? (
          <>{totalCount} roles</>
        ) : (
          <>
            {filteredCount} of {totalCount} roles
          </>
        )}
      </span>
      {activeCount > 0 && (
        <button
          type="button"
          onClick={() =>
            onChange({
              search: "",
              locations: [],
              industries: [],
              statuses: [],
              jobTypes: [],
              remoteOptions: [],
              compensationBands: [],
              agencies: [],
            })
          }
          style={{
            border: "none",
            background: "transparent",
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            color: color.forest,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Clear filters ({activeCount})
        </button>
      )}
    </div>
  );

  if (wideLayout) {
    return (
      <ScoutBox padding={0} style={{ alignSelf: "start" }}>
        <div style={{ padding: "14px 18px", borderBottom: border.line, background: surface.inset }}>
          <ScoutLabel>Filter network roles</ScoutLabel>
        </div>
        <div style={{ padding: "16px 18px 18px" }}>
          {summary}
          {searchInput}
          {filterGroups}
        </div>
      </ScoutBox>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {summary}
      {searchInput}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {options.statuses.map((status) => {
          const active = filters.statuses.includes(status);
          return (
            <button
              key={status}
              type="button"
              onClick={() => toggle("statuses", status)}
              style={{
                padding: "6px 12px",
                border: active ? border.lineStrong : border.line,
                background: active ? surface.card : "transparent",
                fontFamily: fontSans,
                fontSize: T.caption,
                fontWeight: active ? 600 : 500,
                color: active ? color.forest : color.muted,
                cursor: "pointer",
              }}
            >
              {status}
            </button>
          );
        })}
        {options.compensationBands.map((band) => {
          const active = filters.compensationBands.includes(band);
          return (
            <button
              key={band}
              type="button"
              onClick={() => toggle("compensationBands", band)}
              style={{
                padding: "6px 12px",
                border: active ? border.lineStrong : border.line,
                background: active ? surface.card : "transparent",
                fontFamily: fontSans,
                fontSize: T.caption,
                fontWeight: active ? 600 : 500,
                color: active ? color.forest : color.muted,
                cursor: "pointer",
              }}
            >
              {COMPENSATION_BAND_LABELS[band]}
            </button>
          );
        })}
        {activeCount > 0 && (
          <span style={{ fontFamily: fontMono, fontSize: T.label, color: color.mutedLight, alignSelf: "center" }}>
            {activeCount} filter{activeCount === 1 ? "" : "s"} active
          </span>
        )}
      </div>
      <details>
        <summary style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest, cursor: "pointer", marginBottom: 12 }}>
          All filters
        </summary>
        <ScoutBox padding={16}>{filterGroups}</ScoutBox>
      </details>
    </div>
  );
}
