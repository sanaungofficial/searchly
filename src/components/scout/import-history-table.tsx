"use client";

import type { ImportRunListItem } from "@/lib/client-import/import-run";
import {
  importRunFileLabel,
  importStatusColor,
  importStatusLabel,
} from "@/lib/client-import/import-run";
import { ScoutBox, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, fontSans, type as T } from "@/lib/typography";

type Props = {
  runs: ImportRunListItem[];
  loading?: boolean;
  isMobile?: boolean;
  onDetails: (runId: string) => void;
  onRefresh?: () => void;
};

const thStyle: React.CSSProperties = {
  fontFamily: fontSans,
  fontSize: 11,
  fontWeight: 700,
  color: color.muted,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: border.lineStrong,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  fontFamily: fontSans,
  fontSize: 13,
  color: color.ink,
  padding: "12px",
  borderBottom: border.line,
  verticalAlign: "top",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CountCell({ created, updated, skipped, failed }: Pick<ImportRunListItem, "createdCount" | "updatedCount" | "skippedCount" | "failedCount">) {
  return (
    <span style={{ fontSize: 12, lineHeight: 1.5, color: color.stone }}>
      <span style={{ color: color.forest }}>{created}</span> created ·{" "}
      <span style={{ color: color.forest }}>{updated}</span> updated · {skipped} skipped
      {failed > 0 ? (
        <>
          {" "}
          · <span style={{ color: "#b04040" }}>{failed} failed</span>
        </>
      ) : null}
    </span>
  );
}

export function ImportHistoryTable({ runs, loading, isMobile, onDetails, onRefresh }: Props) {
  if (loading) {
    return (
      <ScoutBox padding={20}>
        <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: 0 }}>Loading import history…</p>
      </ScoutBox>
    );
  }

  if (!runs.length) {
    return (
      <ScoutBox padding={20}>
        <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: "0 0 12px" }}>
          No imports yet. Run your first import from the New import tab.
        </p>
        {onRefresh && (
          <ScoutSecondaryBtn type="button" onClick={onRefresh}>
            Refresh
          </ScoutSecondaryBtn>
        )}
      </ScoutBox>
    );
  }

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {runs.map((run) => (
          <ScoutBox key={run.id} padding={14}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.ink, margin: 0 }}>
                {run.importTypeLabel}
              </p>
              <span style={{ fontSize: 11, fontWeight: 700, color: importStatusColor(run.status), textTransform: "uppercase" }}>
                {importStatusLabel(run.status)}
              </span>
            </div>
            <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "0 0 6px" }}>
              {formatDate(run.createdAt)} · {importRunFileLabel(run.fileName, run.sourceKind)}
            </p>
            {run.importedByName && (
              <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "0 0 8px" }}>
                By {run.importedByName}
              </p>
            )}
            <CountCell {...run} />
            <div style={{ marginTop: 12 }}>
              <ScoutSecondaryBtn type="button" onClick={() => onDetails(run.id)}>
                Details
              </ScoutSecondaryBtn>
            </div>
          </ScoutBox>
        ))}
      </div>
    );
  }

  return (
    <ScoutBox padding={0} style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 960 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: "14%" }}>Date & time</th>
            <th style={{ ...thStyle, width: "10%" }}>Status</th>
            <th style={{ ...thStyle, width: "12%" }}>Imported by</th>
            <th style={{ ...thStyle, width: "14%" }}>File</th>
            <th style={{ ...thStyle, width: "14%" }}>Type</th>
            <th style={{ ...thStyle, width: "24%" }}>Counts</th>
            <th style={{ ...thStyle, width: "8%" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td style={tdStyle}>{formatDate(run.createdAt)}</td>
              <td style={tdStyle}>
                <span style={{ fontWeight: 700, fontSize: 12, color: importStatusColor(run.status), textTransform: "uppercase" }}>
                  {importStatusLabel(run.status)}
                </span>
              </td>
              <td style={{ ...tdStyle, color: color.stone }}>{run.importedByName ?? "—"}</td>
              <td style={{ ...tdStyle, wordBreak: "break-word" }}>{importRunFileLabel(run.fileName, run.sourceKind)}</td>
              <td style={tdStyle}>{run.importTypeLabel}</td>
              <td style={tdStyle}>
                <CountCell {...run} />
              </td>
              <td style={tdStyle}>
                <button
                  type="button"
                  onClick={() => onDetails(run.id)}
                  style={{
                    border: "none",
                    background: "none",
                    padding: 0,
                    fontFamily: fontSans,
                    fontSize: T.bodySm,
                    fontWeight: 600,
                    color: color.forest,
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScoutBox>
  );
}
