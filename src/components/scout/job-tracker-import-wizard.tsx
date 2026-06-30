"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JobStage } from "@prisma/client";
import type { ClientImportPreview } from "@/lib/client-import/types";
import {
  DEFAULT_JOB_TRACKER_IMPORT_OPTIONS,
  JOB_TRACKER_DESTINATION_FIELDS,
  analyzeStatusValueMappings,
  analyzeYesNoValues,
  buildStatusValueMappingFromRows,
  countMappedColumns,
  pipelineStageOptions,
  skipAllUnmapped,
  validateJobTrackerMapping,
  validateStatusValueMapping,
  type JobTrackerColumnMapping,
  type JobTrackerDestinationFieldId,
  type JobTrackerImportOptions,
  type JobTrackerSheetPreview,
  type JobTrackerStatusValueRow,
} from "@/lib/client-import/job-field-mapping";
import { jobStageLabel } from "@/lib/kimchi-assistant/stages";
import { ScoutModal } from "@/components/scout/scout-modal";
import { ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { withClientUserId } from "@/lib/workspace-urls";
import { formatApiErrorMessage, readResponseJson } from "@/lib/api-error-message";
import { border, color, fontSans, radius, surface, type as T } from "@/lib/typography";

type WizardStep = "upload" | "map" | "values" | "options";

type Props = {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  inferInterviewStage?: boolean;
  title?: string;
  onComplete: (result: { preview: ClientImportPreview; jobImportOptions: JobTrackerImportOptions }) => void;
};

const STEP_LABELS: Record<WizardStep, string> = {
  upload: "Upload",
  map: "Map fields",
  values: "Map status values",
  options: "Import options",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: border.lineStrong,
  borderRadius: radius.box,
  fontFamily: fontSans,
  fontSize: T.bodySm,
  background: "#fff",
  color: color.forest,
};

function StepPills({ step }: { step: WizardStep }) {
  const steps: WizardStep[] = ["upload", "map", "values", "options"];
  const activeIdx = steps.indexOf(step);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
      {steps.map((s, idx) => {
        const done = idx < activeIdx;
        const active = s === step;
        return (
          <span
            key={s}
            style={{
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: radius.box,
              border: active ? `1px solid ${color.forest}` : "var(--scout-border)",
              background: active ? "rgba(26,58,47,0.08)" : done ? surface.inset : "#fff",
              color: active ? color.forest : color.muted,
            }}
          >
            {idx + 1}. {STEP_LABELS[s]}
          </span>
        );
      })}
    </div>
  );
}

export function JobTrackerImportWizard({
  open,
  onClose,
  clientUserId,
  inferInterviewStage = false,
  title = "Import job tracker",
  onComplete,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const api = useCallback((path: string) => withClientUserId(path, clientUserId), [clientUserId]);

  const [step, setStep] = useState<WizardStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sheetPreview, setSheetPreview] = useState<JobTrackerSheetPreview | null>(null);
  const [columns, setColumns] = useState<JobTrackerColumnMapping[]>([]);
  const [statusRows, setStatusRows] = useState<JobTrackerStatusValueRow[]>([]);
  const [defaultUnmatchedStage, setDefaultUnmatchedStage] = useState<JobStage | "">("");
  const [importOptions, setImportOptions] = useState<JobTrackerImportOptions>(DEFAULT_JOB_TRACKER_IMPORT_OPTIONS);

  const stageOptions = useMemo(() => pipelineStageOptions(), []);

  const reset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setPasteText("");
    setLoading(false);
    setError(null);
    setSheetPreview(null);
    setColumns([]);
    setStatusRows([]);
    setDefaultUnmatchedStage("");
    setImportOptions(DEFAULT_JOB_TRACKER_IMPORT_OPTIONS);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const mappedCounts = useMemo(() => countMappedColumns(columns), [columns]);
  const statusValueMapping = useMemo(
    () =>
      buildStatusValueMappingFromRows(statusRows, defaultUnmatchedStage ? defaultUnmatchedStage : null),
    [statusRows, defaultUnmatchedStage],
  );

  const yesNoAnalysis = useMemo(() => {
    if (!sheetPreview) return null;
    return analyzeYesNoValues(sheetPreview, columns);
  }, [sheetPreview, columns]);

  async function parseUpload() {
    if (!file && !pasteText.trim()) {
      setError("Upload a file or paste rows to continue.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      if (pasteText.trim()) form.append("pasteText", pasteText.trim());
      if (inferInterviewStage) form.append("inferInterview", "true");

      const res = await fetch(api(`/api/admin/clients/${clientUserId}/import/job-tracker/preview`), {
        method: "POST",
        body: form,
      });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Failed to read file"));

      const preview = data.preview as JobTrackerSheetPreview;
      setSheetPreview(preview);
      setColumns(preview.columns);
      setStep("map");
    } catch (e) {
      setError(formatApiErrorMessage(e, "Failed to read file"));
    } finally {
      setLoading(false);
    }
  }

  function continueFromMap() {
    const validation = validateJobTrackerMapping(columns);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    if (sheetPreview) {
      const analysis = analyzeStatusValueMappings(sheetPreview, columns);
      setStatusRows(analysis.values);
      setDefaultUnmatchedStage(analysis.defaultUnmatchedStage ?? "");
      if (analysis.hasStatusColumn) {
        setStep("values");
      } else {
        setStep("options");
      }
    }
  }

  function continueFromValues() {
    const validation = validateStatusValueMapping(sheetPreview!, columns, statusValueMapping);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setStep("options");
  }

  async function finishWizard() {
    if (!sheetPreview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(api(`/api/admin/clients/${clientUserId}/import/job-tracker/build`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetPreview,
          columns,
          inferInterview: inferInterviewStage,
          statusValueMapping,
        }),
      });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Failed to build preview"));

      const preview = data.preview as ClientImportPreview;
      if (!preview.pipelineJobs.length) {
        throw new Error(preview.warnings[0] ?? "No jobs found with current mapping.");
      }

      onComplete({
        preview,
        jobImportOptions: {
          ...importOptions,
          statusValueMapping,
        },
      });
    } catch (e) {
      setError(formatApiErrorMessage(e, "Failed to build preview"));
    } finally {
      setLoading(false);
    }
  }

  function updateColumn(index: number, patch: Partial<JobTrackerColumnMapping>) {
    setColumns((prev) => prev.map((col) => (col.columnIndex === index ? { ...col, ...patch } : col)));
  }

  function updateStatusRow(rawValue: string, userStage: JobStage | null) {
    setStatusRows((prev) => prev.map((row) => (row.rawValue === rawValue ? { ...row, userStage } : row)));
  }

  const usedDestinations = new Set(
    columns.filter((c) => !c.skipped && c.destination).map((c) => c.destination as JobTrackerDestinationFieldId),
  );

  return (
    <ScoutModal open={open} onClose={onClose} maxWidth={860} bruddle>
      <ScoutLabel>Job tracker import</ScoutLabel>
      <ScoutDisplayTitle size={22} style={{ margin: "8px 0 12px" }}>
        {title}
      </ScoutDisplayTitle>
      <StepPills step={step} />

      {loading && (
        <div style={{ marginBottom: 16 }}>
          <KimchiProcessLoader title="Processing…" variant="inline" />
        </div>
      )}

      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#b04040", margin: "0 0 12px" }}>{error}</p>
      )}

      {step === "upload" && (
        <>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 16px", lineHeight: 1.55 }}>
            Upload an Excel/CSV export or paste rows with a header row. You will map columns and status values before
            import.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, margin: "0 0 8px" }}>
                File
              </p>
              <ScoutSecondaryBtn type="button" onClick={() => inputRef.current?.click()} disabled={loading}>
                Choose file
              </ScoutSecondaryBtn>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setError(null);
                  e.target.value = "";
                }}
              />
              {file && (
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.stone, margin: "8px 0 0" }}>
                  {file.name}
                </p>
              )}
            </div>
            <div>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, margin: "0 0 8px" }}>
                Or paste rows
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value);
                  setError(null);
                }}
                placeholder="Company Name, Job Title, URL, Yes/No, Application Status…"
                style={{
                  width: "100%",
                  minHeight: 120,
                  padding: "10px 12px",
                  border: border.lineStrong,
                  borderRadius: radius.box,
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  boxSizing: "border-box",
                  background: surface.inset,
                }}
              />
            </div>
          </div>
        </>
      )}

      {step === "map" && sheetPreview && (
        <>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 8px" }}>
            {sheetPreview.filename} · {sheetPreview.sheetName} · {sheetPreview.dataRowCount} data row(s)
          </p>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, margin: "0 0 12px" }}>
            {mappedCounts.mapped} / {mappedCounts.total} columns mapped
            {mappedCounts.unmapped > 0 ? ` · ${mappedCounts.unmapped} unmapped` : ""}
          </p>
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: T.bodySm }}>
              <thead>
                <tr style={{ textAlign: "left", color: color.muted, fontSize: T.caption }}>
                  <th style={{ padding: "8px 6px" }}>Skip</th>
                  <th style={{ padding: "8px 6px" }}>Column</th>
                  <th style={{ padding: "8px 6px" }}>Map to</th>
                  <th style={{ padding: "8px 6px" }}>Sample</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col) => (
                  <tr key={col.columnIndex} style={{ borderTop: "var(--scout-border)" }}>
                    <td style={{ padding: "8px 6px", verticalAlign: "top" }}>
                      <input
                        type="checkbox"
                        checked={col.skipped}
                        onChange={(e) =>
                          updateColumn(col.columnIndex, {
                            skipped: e.target.checked,
                            destination: e.target.checked ? null : col.destination,
                          })
                        }
                      />
                    </td>
                    <td style={{ padding: "8px 6px", verticalAlign: "top", fontWeight: 600 }}>{col.header}</td>
                    <td style={{ padding: "8px 6px", verticalAlign: "top", minWidth: 180 }}>
                      <select
                        value={col.skipped ? "" : (col.destination ?? "")}
                        disabled={col.skipped}
                        onChange={(e) => {
                          const destination = (e.target.value || null) as JobTrackerDestinationFieldId | null;
                          updateColumn(col.columnIndex, { destination, skipped: false });
                        }}
                        style={selectStyle}
                      >
                        <option value="">— Not mapped —</option>
                        {JOB_TRACKER_DESTINATION_FIELDS.map((field) => (
                          <option
                            key={field.id}
                            value={field.id}
                            disabled={usedDestinations.has(field.id) && col.destination !== field.id}
                          >
                            {field.label}
                            {field.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "8px 6px", verticalAlign: "top", color: color.muted, fontSize: T.caption }}>
                      {col.sampleValues.join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mappedCounts.unmapped > 0 && (
            <ScoutSecondaryBtn type="button" onClick={() => setColumns(skipAllUnmapped(columns))}>
              Skip unmapped columns
            </ScoutSecondaryBtn>
          )}
        </>
      )}

      {step === "values" && sheetPreview && (
        <>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 12px", lineHeight: 1.55 }}>
            Spreadsheet status values that Kimchi does not recognize must be mapped to a pipeline stage. Auto-matched
            values are shown for review.
          </p>

          {statusRows.some((row) => row.autoMappedStage) && (
            <div style={{ marginBottom: 16, padding: 12, background: surface.inset, border: "var(--scout-border)" }}>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, margin: "0 0 8px" }}>
                Auto-matched
              </p>
              {statusRows
                .filter((row) => row.autoMappedStage)
                .map((row) => (
                  <p key={row.rawValue} style={{ fontFamily: fontSans, fontSize: T.bodySm, margin: "0 0 4px" }}>
                    “{row.rawValue}” → {jobStageLabel(row.autoMappedStage!)} ({row.count} row
                    {row.count === 1 ? "" : "s"})
                  </p>
                ))}
            </div>
          )}

          {statusRows.some((row) => !row.autoMappedStage) && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, margin: "0 0 8px" }}>
                Needs mapping
              </p>
              {statusRows
                .filter((row) => !row.autoMappedStage)
                .map((row) => (
                  <div
                    key={row.rawValue}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 200px",
                      gap: 12,
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontFamily: fontSans, fontSize: T.bodySm }}>
                      “{row.rawValue}” <span style={{ color: color.muted }}>({row.count})</span>
                    </span>
                    <select
                      value={row.userStage ?? ""}
                      onChange={(e) =>
                        updateStatusRow(row.rawValue, (e.target.value || null) as JobStage | null)
                      }
                      style={selectStyle}
                    >
                      <option value="">— Choose stage —</option>
                      {stageOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              <label style={{ display: "block", marginTop: 12 }}>
                <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, fontWeight: 600 }}>
                  Default stage for any remaining unmatched values
                </span>
                <select
                  value={defaultUnmatchedStage}
                  onChange={(e) => setDefaultUnmatchedStage((e.target.value || "") as JobStage | "")}
                  style={{ ...selectStyle, marginTop: 6 }}
                >
                  <option value="">— None —</option>
                  {stageOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {yesNoAnalysis?.hasYesNoColumn && (
            <div style={{ padding: 12, background: surface.inset, border: "var(--scout-border)" }}>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, margin: "0 0 6px" }}>
                Coach Yes/No column
              </p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: "0 0 8px", lineHeight: 1.5 }}>
                When coach approval is <strong>No</strong>, only in-progress Applying stages are held at Saved until approved. Submitted applications keep their imported stage.
              </p>
              {yesNoAnalysis.unrecognized.length > 0 && (
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#9a6b2f", margin: 0 }}>
                  Unrecognized Yes/No values:{" "}
                  {yesNoAnalysis.unrecognized.map((row) => `"${row.rawValue}" (${row.count})`).join(", ")} — approval
                  gating will not apply for those rows.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {step === "options" && (
        <>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 16px", lineHeight: 1.55 }}>
            Choose how to handle jobs that already exist in this client&apos;s pipeline.
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontFamily: fontSans, fontSize: T.bodySm }}>
            <input
              type="checkbox"
              checked={importOptions.dedupeEnabled}
              onChange={(e) => setImportOptions((o) => ({ ...o, dedupeEnabled: e.target.checked }))}
            />
            Check for existing jobs before import
          </label>

          {importOptions.dedupeEnabled && (
            <div style={{ display: "grid", gap: 12, marginBottom: 8 }}>
              <label>
                <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, fontWeight: 600 }}>
                  Match existing jobs by
                </span>
                <select
                  value={importOptions.matchField}
                  onChange={(e) =>
                    setImportOptions((o) => ({
                      ...o,
                      matchField: e.target.value as JobTrackerImportOptions["matchField"],
                    }))
                  }
                  style={{ ...selectStyle, marginTop: 6 }}
                >
                  <option value="url">Job URL (fallback: company + title)</option>
                  <option value="company_role">Company + job title</option>
                </select>
              </label>
              <label>
                <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, fontWeight: 600 }}>
                  When a match is found
                </span>
                <select
                  value={importOptions.onMatch}
                  onChange={(e) =>
                    setImportOptions((o) => ({
                      ...o,
                      onMatch: e.target.value as JobTrackerImportOptions["onMatch"],
                    }))
                  }
                  style={{ ...selectStyle, marginTop: 6 }}
                >
                  <option value="add_missing">Update changed fields / fill missing</option>
                  <option value="update_all">Update all mapped fields</option>
                  <option value="skip">Skip matched rows</option>
                </select>
              </label>
              <label>
                <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, fontWeight: 600 }}>
                  When no match is found
                </span>
                <select
                  value={importOptions.onNoMatch}
                  onChange={(e) =>
                    setImportOptions((o) => ({
                      ...o,
                      onNoMatch: e.target.value as JobTrackerImportOptions["onNoMatch"],
                    }))
                  }
                  style={{ ...selectStyle, marginTop: 6 }}
                >
                  <option value="create">Create new job</option>
                  <option value="skip">Skip row</option>
                </select>
              </label>
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24, flexWrap: "wrap" }}>
        <ScoutSecondaryBtn onClick={onClose} disabled={loading}>
          Cancel
        </ScoutSecondaryBtn>
        {step !== "upload" && (
          <ScoutSecondaryBtn
            onClick={() => {
              setError(null);
              if (step === "map") setStep("upload");
              else if (step === "values") setStep("map");
              else if (step === "options") {
                setStep(sheetPreview && colHasStatus(columns) ? "values" : "map");
              }
            }}
            disabled={loading}
          >
            Back
          </ScoutSecondaryBtn>
        )}
        {step === "upload" && (
          <ScoutPrimaryBtn onClick={parseUpload} disabled={loading || (!file && !pasteText.trim())}>
            Continue
          </ScoutPrimaryBtn>
        )}
        {step === "map" && (
          <ScoutPrimaryBtn onClick={continueFromMap} disabled={loading}>
            Continue
          </ScoutPrimaryBtn>
        )}
        {step === "values" && (
          <ScoutPrimaryBtn onClick={continueFromValues} disabled={loading}>
            Continue
          </ScoutPrimaryBtn>
        )}
        {step === "options" && (
          <ScoutPrimaryBtn onClick={finishWizard} disabled={loading}>
            {loading ? "Importing…" : "Import jobs"}
          </ScoutPrimaryBtn>
        )}
      </div>
    </ScoutModal>
  );
}

function colHasStatus(columns: JobTrackerColumnMapping[]): boolean {
  return columns.some((c) => !c.skipped && c.destination === "status");
}
