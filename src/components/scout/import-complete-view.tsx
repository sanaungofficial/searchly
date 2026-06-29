"use client";

import Link from "next/link";
import type { ImportRunDetail } from "@/lib/client-import/import-run";
import {
  downloadImportErrorsCsv,
  importRunFileLabel,
  importStatusColor,
  importStatusLabel,
  importTypeLabel,
  primaryVerifyLinkForImportType,
} from "@/lib/client-import/import-run";
import { ImportAuditDetails, importResultHasChanges } from "@/components/scout/import-audit-details";
import { ScoutBox, ScoutDisplayTitle, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, bruddleHeadingStyle, color, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  run: ImportRunDetail;
  clientUserId: string;
  isMobile?: boolean;
  onStartAnother: () => void;
  onBackToHistory?: () => void;
};

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "warn" | "error";
}) {
  const bg =
    tone === "success"
      ? "rgba(74,139,106,0.1)"
      : tone === "warn"
        ? "rgba(184,134,11,0.1)"
        : tone === "error"
          ? "rgba(176,64,64,0.08)"
          : surface.inset;
  const accent =
    tone === "success" ? color.forest : tone === "warn" ? "#b8860b" : tone === "error" ? "#b04040" : color.stone;

  return (
    <ScoutBox
      padding={16}
      style={{
        flex: "1 1 140px",
        minWidth: 120,
        background: bg,
        borderColor: border.lineStrong,
      }}
    >
      <p style={{ fontFamily: fontSans, fontSize: 28, fontWeight: 700, color: accent, margin: "0 0 4px", lineHeight: 1.1 }}>
        {value}
      </p>
      <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.muted, margin: 0 }}>{label}</p>
    </ScoutBox>
  );
}

function formatRunDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ImportCompleteView({ run, clientUserId, isMobile, onStartAnother, onBackToHistory }: Props) {
  const { result } = run;
  const hasChanges = importResultHasChanges(result);
  const primaryLink = primaryVerifyLinkForImportType(run.importType, clientUserId);

  return (
    <div className="bruddle" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <ScoutDisplayTitle size={isMobile ? 22 : 26} style={{ margin: "0 0 6px" }}>
          Import complete!
        </ScoutDisplayTitle>
        <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: 0, lineHeight: 1.5 }}>
          {hasChanges
            ? "Your import finished. Review the summary below, then spot-check imported items."
            : "Import finished — nothing new was written (rows may have been skipped or already matched)."}
        </p>
      </div>

      <ScoutBox padding={isMobile ? 14 : 18}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: "1 1 200px" }}>
            <p style={{ ...bruddleHeadingStyle("h6"), margin: "0 0 4px" }}>{importTypeLabel(run.importType)}</p>
            <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>
              {importRunFileLabel(run.fileName, run.sourceKind)} · {formatRunDate(run.createdAt)}
            </p>
            {run.importedByName && (
              <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "4px 0 0" }}>
                Imported by {run.importedByName}
              </p>
            )}
          </div>
          <span
            style={{
              alignSelf: "flex-start",
              padding: "4px 10px",
              border: `1.5px solid ${importStatusColor(run.status)}`,
              color: importStatusColor(run.status),
              fontFamily: fontSans,
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {importStatusLabel(run.status)}
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <StatCard label="Updated" value={run.updatedCount} tone="success" />
          <StatCard label="Created" value={run.createdCount} tone="success" />
          <StatCard label="Skipped / unchanged" value={run.skippedCount} tone="neutral" />
          <StatCard label="Errors" value={run.failedCount} tone={run.failedCount > 0 ? "error" : "neutral"} />
        </div>
      </ScoutBox>

      {primaryLink && (
        <ScoutBox padding={16} style={{ background: "rgba(74,139,106,0.06)", borderColor: "rgba(74,139,106,0.25)" }}>
          <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.forest, margin: "0 0 8px" }}>
            View imported items
          </p>
          <Link
            href={primaryLink.href}
            style={{
              fontFamily: fontSans,
              fontSize: T.bodySm,
              fontWeight: 600,
              color: color.forest,
              textDecoration: "underline",
            }}
          >
            {primaryLink.label} →
          </Link>
        </ScoutBox>
      )}

      {run.errors.length > 0 && (
        <ScoutBox padding={16}>
          <p style={{ ...bruddleHeadingStyle("h6"), margin: "0 0 8px", color: "#b04040" }}>
            Failed rows ({run.errors.length})
          </p>
          <ScoutSecondaryBtn type="button" onClick={() => downloadImportErrorsCsv(run.errors)}>
            Download failed rows
          </ScoutSecondaryBtn>
        </ScoutBox>
      )}

      <ScoutBox padding={isMobile ? 16 : 20}>
        <p style={{ ...bruddleHeadingStyle("h6"), margin: "0 0 12px" }}>Details</p>
        <ImportAuditDetails result={result} clientUserId={clientUserId} showVerifyLinks={false} />
      </ScoutBox>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <ScoutPrimaryBtn type="button" onClick={onStartAnother}>
          Start another import
        </ScoutPrimaryBtn>
        {onBackToHistory && (
          <ScoutSecondaryBtn type="button" onClick={onBackToHistory}>
            Back to history
          </ScoutSecondaryBtn>
        )}
      </div>
    </div>
  );
}
