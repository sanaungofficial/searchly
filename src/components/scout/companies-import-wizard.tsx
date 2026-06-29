"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientImportPreview } from "@/lib/client-import/types";
import {
  DEFAULT_COMPANY_IMPORT_OPTIONS,
  applyCompaniesFieldSelection,
  buildCompanyNotesFromRow,
  colForDestination,
  countMappedColumns,
  noteColumnsFromMapping,
  validateCompaniesMapping,
  type CompaniesColumnMapping,
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
    { id: "map", label: "Map fields" },
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

function firstSampleCompanyRow(preview: CompaniesSheetPreview, companyCol: number): number | null {
  for (let r = preview.headerRowIndex + 1; r < preview.rows.length; r++) {
    const name = (preview.rows[r]?.[companyCol] ?? "").trim();
    if (name) return r;
  }
  return null;
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
  const noteColumns = useMemo(() => noteColumnsFromMapping(columns), [columns]);
  const companyCol = colForDestination(columns, "company");
  const priorityCol = colForDestination(columns, "priority");

  const notesPreview = useMemo(() => {
    if (!sheetPreview || companyCol < 0 || !importOptions.includeUnmappedInNotes) return null;
    const rowIdx = firstSampleCompanyRow(sheetPreview, companyCol);
    if (rowIdx == null) return null;
    const headers = columns.map((c) => c.header);
    const skipped = columns.filter((c) => c.skipped || c.isEmpty).map((c) => c.columnIndex);
    const category = sheetPreview.rowCategories?.[rowIdx] ?? null;
    return buildCompanyNotesFromRow(
      sheetPreview.rows[rowIdx] ?? [],
      headers,
      companyCol,
      priorityCol >= 0 ? priorityCol : null,
      { includeUnmappedInNotes: true, skippedColumnIndexes: skipped, category },
    );
  }, [sheetPreview, columns, companyCol, priorityCol, importOptions.includeUnmappedInNotes]);

  const selectableColumns = useMemo(() => columns.filter((c) => !c.isEmpty), [columns]);

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

  function setCompanyColumn(colIndex: number) {
    setColumns((prev) => {
      const priority = colForDestination(prev, "priority");
      const validPriority = priority >= 0 && priority !== colIndex ? priority : null;
      return applyCompaniesFieldSelection(prev, colIndex, validPriority);
    });
  }

  function setPriorityColumn(colIndex: number | null) {
    setColumns((prev) => {
      const company = colForDestination(prev, "company");
      if (company < 0) return prev;
      return applyCompaniesFieldSelection(prev, company, colIndex);
    });
  }

  function toggleNoteColumnSkip(colIndex: number, skipped: boolean) {
    setColumns((prev) => prev.map((col) => (col.columnIndex === colIndex ? { ...col, skipped } : col)));
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
            Upload an Excel/CSV export or paste rows with a header row. Pick the company name column (required) and
            optional priority — everything else becomes structured notes automatically.
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
                placeholder="Company, Industry, Location, Drive, Local Asset Base, Fit Notes, Priority…"
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
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 16px" }}>
            {sheetPreview.filename} · {sheetPreview.sheetName} · {sheetPreview.dataRowCount} data row(s)
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <label>
              <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, fontWeight: 600 }}>
                Company column *
              </span>
              <select
                value={companyCol >= 0 ? companyCol : ""}
                onChange={(e) => setCompanyColumn(Number(e.target.value))}
                style={{ ...selectStyle, marginTop: 6 }}
              >
                <option value="" disabled>
                  Select column…
                </option>
                {selectableColumns.map((col) => (
                  <option key={col.columnIndex} value={col.columnIndex}>
                    {col.header}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, fontWeight: 600 }}>
                Priority column (optional)
              </span>
              <select
                value={priorityCol >= 0 ? priorityCol : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setPriorityColumn(val === "" ? null : Number(val));
                }}
                style={{ ...selectStyle, marginTop: 6 }}
              >
                <option value="">— None —</option>
                {selectableColumns
                  .filter((col) => col.columnIndex !== companyCol)
                  .map((col) => (
                    <option key={col.columnIndex} value={col.columnIndex}>
                      {col.header}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              fontFamily: fontSans,
              fontSize: T.bodySm,
            }}
          >
            <input
              type="checkbox"
              checked={importOptions.includeUnmappedInNotes}
              onChange={(e) => setImportOptions((o) => ({ ...o, includeUnmappedInNotes: e.target.checked }))}
            />
            Include other columns in notes (one line per field)
          </label>

          {importOptions.includeUnmappedInNotes && noteColumns.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, margin: "0 0 8px" }}>
                {noteColumns.length} column(s) will merge into notes
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  maxHeight: 160,
                  overflowY: "auto",
                  padding: "10px 12px",
                  background: surface.inset,
                  border: "var(--scout-border)",
                }}
              >
                {noteColumns.map((col) => (
                  <label
                    key={col.columnIndex}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontFamily: fontSans,
                      fontSize: T.bodySm,
                      color: col.skipped ? color.muted : color.stone,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!col.skipped}
                      onChange={(e) => toggleNoteColumnSkip(col.columnIndex, !e.target.checked)}
                    />
                    <span style={{ fontWeight: 600 }}>{col.header}</span>
                    <span style={{ color: color.muted, fontSize: T.caption }}>
                      {col.sampleValues[0] ? `e.g. ${col.sampleValues[0]}` : ""}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {notesPreview && (
            <div style={{ marginBottom: 8, padding: 12, background: surface.inset, border: "var(--scout-border)" }}>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, margin: "0 0 8px" }}>
                Notes preview (first company row)
              </p>
              <pre
                style={{
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: color.stone,
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.5,
                }}
              >
                {notesPreview}
              </pre>
            </div>
          )}

          {!mappedCounts.companyMapped && (
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#b04040", margin: "8px 0 0" }}>
              Select a company column to continue.
            </p>
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
            Dedupe by company name before import
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
          <ScoutPrimaryBtn onClick={continueFromMap} disabled={loading || !mappedCounts.companyMapped}>
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
