"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientImportPreview } from "@/lib/client-import/types";
import {
  COMPANIES_DESTINATION_FIELDS,
  DEFAULT_COMPANY_IMPORT_OPTIONS,
  countMappedColumns,
  skipAllUnmapped,
  validateCompaniesMapping,
  type CompaniesColumnMapping,
  type CompaniesDestinationFieldId,
  type CompanyImportOptions,
  type CompaniesSheetPreview,
} from "@/lib/client-import/company-field-mapping";
import { ScoutModal } from "@/components/scout/scout-modal";
import { ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { withClientUserId } from "@/lib/workspace-urls";
import { formatApiErrorMessage, readResponseJson } from "@/lib/api-error-message";
import { border, color, fontSans, radius, surface, type as T } from "@/lib/typography";

type WizardStep = "upload" | "map" | "options";

type Props = {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  title?: string;
  onComplete: (result: { preview: ClientImportPreview; companyImportOptions: CompanyImportOptions }) => void;
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
  const steps: Array<{ id: WizardStep; label: string }> = [
    { id: "upload", label: "Upload" },
    { id: "map", label: "Map columns" },
    { id: "options", label: "Options" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
      {steps.map((s, i) => (
        <span
          key={s.id}
          style={{
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: i === idx ? 700 : 500,
            color: i <= idx ? color.forest : color.muted,
            padding: "4px 10px",
            border: i === idx ? `1.5px solid ${color.forest}` : "var(--scout-border)",
            background: i === idx ? "rgba(74,139,106,0.08)" : surface.inset,
          }}
        >
          {i + 1}. {s.label}
        </span>
      ))}
    </div>
  );
}

export function CompaniesImportWizard({
  open,
  onClose,
  clientUserId,
  title = "Import companies list",
  onComplete,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const api = useCallback((path: string) => withClientUserId(path, clientUserId), [clientUserId]);

  const [step, setStep] = useState<WizardStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sheetPreview, setSheetPreview] = useState<CompaniesSheetPreview | null>(null);
  const [columns, setColumns] = useState<CompaniesColumnMapping[]>([]);
  const [importOptions, setImportOptions] = useState<CompanyImportOptions>(DEFAULT_COMPANY_IMPORT_OPTIONS);
  const [mappingRecommendation, setMappingRecommendation] = useState<string | null>(null);

  const mappedCounts = useMemo(() => countMappedColumns(columns), [columns]);

  const reset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setPasteText("");
    setLoading(false);
    setError(null);
    setSheetPreview(null);
    setColumns([]);
    setImportOptions(DEFAULT_COMPANY_IMPORT_OPTIONS);
    setMappingRecommendation(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

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

      const res = await fetch(api(`/api/admin/clients/${clientUserId}/import/companies/preview`), {
        method: "POST",
        body: form,
      });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Failed to read file"));

      const preview = data.preview as CompaniesSheetPreview;
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
    const validation = validateCompaniesMapping(columns);
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
      const res = await fetch(api(`/api/admin/clients/${clientUserId}/import/companies/build`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetPreview,
          columns,
          includeUnmappedInNotes: importOptions.includeUnmappedInNotes,
        }),
      });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Failed to build preview"));

      const preview = data.preview as ClientImportPreview;
      if (!preview.companies.length) {
        throw new Error(preview.warnings[0] ?? "No companies found with current mapping.");
      }

      const recommendation =
        typeof data.mappingRecommendation === "string"
          ? data.mappingRecommendation
          : preview.mappingRecommendation ?? null;
      setMappingRecommendation(recommendation);

      onComplete({
        preview: { ...preview, mappingRecommendation: recommendation },
        companyImportOptions: importOptions,
      });
    } catch (e) {
      setError(formatApiErrorMessage(e, "Failed to build preview"));
    } finally {
      setLoading(false);
    }
  }

  function updateColumn(index: number, patch: Partial<CompaniesColumnMapping>) {
    setColumns((prev) => prev.map((col) => (col.columnIndex === index ? { ...col, ...patch } : col)));
  }

  const usedSingleDestinations = new Set(
    columns
      .filter((c) => !c.skipped && c.destination && c.destination !== "notes")
      .map((c) => c.destination as CompaniesDestinationFieldId),
  );

  return (
    <ScoutModal open={open} onClose={onClose} maxWidth={860} bruddle>
      <ScoutLabel>Companies import</ScoutLabel>
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
            Upload an Excel/CSV export or paste rows with a header row. Map Company (required), Priority, and fold
            descriptive columns into notes.
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
                  setFile(e.target.files?.[0] ?? null);
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
                placeholder="Company, Industry, Location/HQ, Fit Notes, Priority…"
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
            {mappedCounts.unmapped > 0 ? ` · ${mappedCounts.unmapped} unmapped (can fold into notes)` : ""}
          </p>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 12px", lineHeight: 1.5 }}>
            Industry, location, drive time, and fit notes should map to Notes — multiple columns are allowed. Unmapped
            descriptive columns are included in notes automatically unless you skip them.
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
                          const destination = (e.target.value || null) as CompaniesDestinationFieldId | null;
                          updateColumn(col.columnIndex, { destination, skipped: false });
                        }}
                        style={selectStyle}
                      >
                        <option value="">— Not mapped —</option>
                        {COMPANIES_DESTINATION_FIELDS.map((field) => (
                          <option
                            key={field.id}
                            value={field.id}
                            disabled={
                              !field.allowMultiple &&
                              usedSingleDestinations.has(field.id) &&
                              col.destination !== field.id
                            }
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

      {step === "options" && (
        <>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 16px", lineHeight: 1.55 }}>
            Choose how to handle companies that already exist on this client&apos;s watchlist (matched by name).
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontFamily: fontSans, fontSize: T.bodySm }}>
            <input
              type="checkbox"
              checked={importOptions.dedupeEnabled}
              onChange={(e) => setImportOptions((o) => ({ ...o, dedupeEnabled: e.target.checked }))}
            />
            Check for existing companies before import
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontFamily: fontSans, fontSize: T.bodySm }}>
            <input
              type="checkbox"
              checked={importOptions.includeUnmappedInNotes}
              onChange={(e) => setImportOptions((o) => ({ ...o, includeUnmappedInNotes: e.target.checked }))}
            />
            Fold unmapped descriptive columns into notes
          </label>

          {importOptions.dedupeEnabled && (
            <div style={{ display: "grid", gap: 12, marginBottom: 8 }}>
              <label>
                <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, fontWeight: 600 }}>
                  When a match is found
                </span>
                <select
                  value={importOptions.onMatch}
                  onChange={(e) =>
                    setImportOptions((o) => ({
                      ...o,
                      onMatch: e.target.value as CompanyImportOptions["onMatch"],
                    }))
                  }
                  style={{ ...selectStyle, marginTop: 6 }}
                >
                  <option value="add_missing">Fill missing priority / notes only</option>
                  <option value="replace">Replace priority and notes</option>
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
                      onNoMatch: e.target.value as CompanyImportOptions["onNoMatch"],
                    }))
                  }
                  style={{ ...selectStyle, marginTop: 6 }}
                >
                  <option value="create">Create new company</option>
                  <option value="skip">Skip row</option>
                </select>
              </label>
            </div>
          )}

          {mappingRecommendation && (
            <div style={{ marginTop: 16, padding: 12, background: surface.inset, border: "var(--scout-border)" }}>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, margin: "0 0 6px" }}>
                Mapping summary
              </p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: 0, lineHeight: 1.5 }}>
                {mappingRecommendation}
              </p>
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
              else if (step === "options") setStep("map");
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
        {step === "options" && (
          <ScoutPrimaryBtn onClick={finishWizard} disabled={loading}>
            {loading ? "Importing…" : "Import companies"}
          </ScoutPrimaryBtn>
        )}
      </div>
    </ScoutModal>
  );
}
