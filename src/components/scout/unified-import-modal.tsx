"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ClientImportApplyResult, ClientImportPreview } from "@/lib/client-import/types";
import type { VisibleImportType } from "@/lib/client-import/import-types";
import { VISIBLE_IMPORT_TYPE_CONFIGS, getImportTypeConfig } from "@/lib/client-import/import-types";
import type { CompanyImportOptions } from "@/lib/client-import/company-field-mapping";
import type { JobTrackerImportOptions } from "@/lib/client-import/job-field-mapping";
import type { IntakeParseResult } from "@/lib/career-strategy";
import { JobTrackerImportWizard } from "@/components/scout/job-tracker-import-wizard";
import { CompaniesImportWizard } from "@/components/scout/companies-import-wizard";
import { ApplyProfileModal } from "@/components/scout/profile-import-apply-modal";
import { ScoutModal } from "@/components/scout/scout-modal";
import { ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { mergeIntakeTrackedCompanies } from "@/lib/intake-tracked-companies";
import { normalizeQaQuestion, normalizeQaTags } from "@/lib/application-qa";
import { withClientUserId } from "@/lib/workspace-urls";
import { notifyCreditsChanged } from "@/lib/credits";
import { formatApiErrorMessage, readResponseJson } from "@/lib/api-error-message";
import { border, color, fontSans, radius, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";

function DocumentUploadIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="10" width="65" height="82" rx="6" fill="#F5F5F5" stroke="#D0D0D0" strokeWidth="2" />
      <rect x="28" y="24" width="42" height="4" rx="2" fill="#D0D0D0" />
      <rect x="28" y="34" width="36" height="4" rx="2" fill="#D0D0D0" />
      <rect x="28" y="44" width="40" height="4" rx="2" fill="#D0D0D0" />
      <circle cx="85" cy="85" r="20" fill={color.forest} />
      <path d="M85 77v16M77 85l8-8 8 8" stroke={color.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type FlowStep = "pick" | "input";

type Props = {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  onPatchProfile: (patch: Record<string, unknown>) => Promise<void>;
  onSuccess?: (message: string) => void;
  /** Navigate to import complete screen with persisted run id. */
  onImportComplete?: (runId: string) => void;
};

export function UnifiedImportModal({ open, onClose, clientUserId, onPatchProfile, onSuccess, onImportComplete }: Props) {
  const isMobile = useIsMobile();
  const api = (path: string) => withClientUserId(path, clientUserId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [flowStep, setFlowStep] = useState<FlowStep>("pick");
  const [importType, setImportType] = useState<VisibleImportType>("job_tracker");
  const [files, setFiles] = useState<File[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showJobTrackerWizard, setShowJobTrackerWizard] = useState(false);
  const [showCompaniesWizard, setShowCompaniesWizard] = useState(false);
  const [jobImportOptions, setJobImportOptions] = useState<JobTrackerImportOptions | undefined>();
  const [companyImportOptions, setCompanyImportOptions] = useState<CompanyImportOptions | undefined>();

  const [intakeResult, setIntakeResult] = useState<IntakeParseResult | null>(null);
  const [showApplyProfile, setShowApplyProfile] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const config = getImportTypeConfig(importType);

  const resetState = useCallback(() => {
    setFlowStep("pick");
    setFiles([]);
    setPasteText("");
    setError(null);
    setShowJobTrackerWizard(false);
    setShowCompaniesWizard(false);
    setJobImportOptions(undefined);
    setCompanyImportOptions(undefined);
    setIntakeResult(null);
    setShowApplyProfile(false);
  }, []);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const onFiles = useCallback((list: FileList | null) => {
    if (!list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    setError(null);
  }, []);

  function buildImportMeta(sourceKindOverride?: "file" | "paste") {
    const sourceKind =
      sourceKindOverride ?? (files.length > 0 || pasteText.trim() ? (files.length > 0 ? "file" : "paste") : "paste");
    const fileName =
      files.length === 1
        ? files[0]?.name ?? null
        : files.length > 1
          ? `${files[0]?.name ?? "file"} +${files.length - 1}`
          : null;
    return { importType, fileName, sourceKind };
  }

  async function recordIntakeRun(input: {
    profileUpdated: boolean;
    companiesAdded: number;
    companiesUpdated: number;
    qaAdded: number;
    qaSkipped: number;
    errors?: string[];
  }): Promise<string | undefined> {
    const res = await fetch(api(`/api/admin/clients/${clientUserId}/import/runs`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intake: input,
        importMeta: buildImportMeta(files.length > 0 ? "file" : "paste"),
      }),
    });
    const data = await readResponseJson(res);
    if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Failed to record import"));
    return typeof data.runId === "string" ? data.runId : undefined;
  }

  async function extractFileText(file: File): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "txt") return (await file.text()).trim();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(api(`/api/admin/clients/${clientUserId}/import/extract-text`), {
      method: "POST",
      body: form,
    });
    const data = await readResponseJson(res);
    if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Could not read file"));
    return String(data.text ?? "").trim();
  }

  async function handleParseApplicationInfo(notes: string) {
    const res = await fetch(api("/api/ai/career-strategy"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intakeNotes: notes.trim() }),
    });
    const patchData = await readResponseJson(res);
    if (!res.ok) throw new Error(formatApiErrorMessage(patchData.error, "Failed to save intake notes"));

    const parseRes = await fetch(api("/api/ai/strategy-intake"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    const data = await readResponseJson(parseRes);
    if (parseRes.status === 402) {
      notifyCreditsChanged();
      setShowUpgrade(true);
      return;
    }
    if (!parseRes.ok) throw new Error(formatApiErrorMessage(data.error, "Parse failed"));
    setIntakeResult(data as IntakeParseResult);
    setShowApplyProfile(true);
    notifyCreditsChanged();
  }

  function handleContinueFromPick() {
    setError(null);
    if (importType === "job_tracker") {
      setShowJobTrackerWizard(true);
    } else if (importType === "target_companies") {
      setShowCompaniesWizard(true);
    } else {
      setFlowStep("input");
    }
  }

  async function handleParse() {
    if (importType === "job_tracker") {
      setShowJobTrackerWizard(true);
      return;
    }
    if (importType === "target_companies") {
      setShowCompaniesWizard(true);
      return;
    }
    if (importType !== "application_info") return;

    const hasPaste = pasteText.trim().length > 0;
    const hasFiles = files.length > 0;
    if (!hasPaste && !hasFiles) {
      setError("Upload a file or paste text to import.");
      return;
    }

    setParsing(true);
    setError(null);

    try {
      let notes = pasteText.trim();
      if (!notes && files.length) {
        const parts: string[] = [];
        for (const file of files) {
          const text = await extractFileText(file);
          if (text) parts.push(text);
        }
        notes = parts.join("\n\n");
      }
      if (!notes) throw new Error("No text found to parse.");
      await handleParseApplicationInfo(notes);
    } catch (e) {
      setError(formatApiErrorMessage(e, "Parse failed"));
    } finally {
      setParsing(false);
    }
  }

  async function applyApplicationQa(suggested: IntakeParseResult["suggestedApplicationQa"]) {
    if (!suggested?.length) return { added: 0, skipped: 0 };
    const existingRes = await fetch(api("/api/user/application-qa"));
    const existingData = (await existingRes.json()) as { entries?: Array<{ question: string }> };
    const existingKeys = new Set((existingData.entries ?? []).map((e) => normalizeQaQuestion(e.question)));
    let added = 0;
    let skipped = 0;
    const seen = new Set<string>();
    for (const row of suggested) {
      const key = normalizeQaQuestion(row.question);
      if (seen.has(key) || existingKeys.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      const tags = normalizeQaTags(row.tags?.length ? row.tags : ["onboarding"]);
      const res = await fetch(api("/api/user/application-qa"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: row.question, answer: row.answer, tags }),
      });
      if (res.ok) {
        added += 1;
        existingKeys.add(key);
      }
    }
    return { added, skipped };
  }

  async function handleApplyProfile() {
    if (!intakeResult) return;
    setApplying(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = { ...(intakeResult.proposed ?? {}) };
      let profileUpdated = false;
      if (Object.keys(patch).length > 0) {
        if (patch.name) {
          await onPatchProfile({ name: patch.name });
          delete patch.name;
          profileUpdated = true;
        }
        if (Object.keys(patch).length > 0) {
          await onPatchProfile(patch);
          profileUpdated = true;
        }
      }

      const trackedCompanies = mergeIntakeTrackedCompanies(intakeResult);
      let companiesAdded = 0;
      let companiesUpdated = 0;

      if (trackedCompanies.length > 0) {
        const res = await fetch(api("/api/companies/intake-apply"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestedTrackedCompanies: trackedCompanies }),
        });
        const data = await readResponseJson(res);
        if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Failed to add target companies"));
        companiesAdded = Number(data.added ?? 0);
        companiesUpdated = Number(data.updated ?? 0);
      }

      const qaResult = await applyApplicationQa(intakeResult.suggestedApplicationQa);

      const runId = await recordIntakeRun({
        profileUpdated,
        companiesAdded,
        companiesUpdated,
        qaAdded: qaResult.added,
        qaSkipped: qaResult.skipped,
      });

      setShowApplyProfile(false);
      setIntakeResult(null);
      resetState();
      onClose();

      if (runId && onImportComplete) {
        onImportComplete(runId);
      } else {
        onSuccess?.("Profile updated from intake.");
      }
    } catch (e) {
      setError(formatApiErrorMessage(e, "Failed to apply profile updates"));
    } finally {
      setApplying(false);
    }
  }

  async function handleApplyImport(
    activePreview: ClientImportPreview,
    jobOptionsOverride?: JobTrackerImportOptions,
    metaOverride?: ReturnType<typeof buildImportMeta>,
    companyOptionsOverride?: CompanyImportOptions,
  ) {
    if (!activePreview) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientUserId}/import/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: activePreview,
          applyResume: false,
          jobImportOptions: jobOptionsOverride ?? jobImportOptions,
          companyImportOptions: companyOptionsOverride ?? companyImportOptions,
          importMeta: metaOverride ?? buildImportMeta(),
        }),
      });
      const data = (await readResponseJson(res)) as ClientImportApplyResult & { error?: string; runId?: string };
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Apply failed"));

      resetState();
      onClose();

      if (data.runId && onImportComplete) {
        onImportComplete(data.runId);
      } else {
        onSuccess?.("Import complete.");
      }
    } catch (e) {
      setError(formatApiErrorMessage(e, "Apply failed"));
    } finally {
      setApplying(false);
    }
  }

  async function handleJobWizardComplete(result: {
    preview: ClientImportPreview;
    jobImportOptions: JobTrackerImportOptions;
  }) {
    setShowJobTrackerWizard(false);
    setJobImportOptions(result.jobImportOptions);
    await handleApplyImport(result.preview, result.jobImportOptions, {
      importType: "job_tracker",
      fileName: result.preview.sourceFiles[0]?.filename ?? null,
      sourceKind: result.preview.sourceFiles.length ? "file" : "paste",
    });
  }

  async function handleCompaniesWizardComplete(result: {
    preview: ClientImportPreview;
    companyImportOptions: CompanyImportOptions;
  }) {
    setShowCompaniesWizard(false);
    setCompanyImportOptions(result.companyImportOptions);
    await handleApplyImport(result.preview, undefined, {
      importType: "target_companies",
      fileName: result.preview.sourceFiles[0]?.filename ?? null,
      sourceKind: result.preview.sourceFiles.length ? "file" : "paste",
    }, result.companyImportOptions);
  }

  const showMainModal = open && !showApplyProfile && !showJobTrackerWizard && !showCompaniesWizard && !applying;

  const dropBorder = isDragging ? color.forest : "rgba(26,58,47,0.25)";
  const dropBg = isDragging ? "rgba(26,58,47,0.06)" : surface.inset;

  return (
    <>
      <ScoutModal open={showMainModal} onClose={handleClose} maxWidth={760} bruddle>
        {flowStep === "pick" ? (
          <>
            <ScoutLabel>Import</ScoutLabel>
            <ScoutDisplayTitle size={22} style={{ margin: "8px 0 20px" }}>
              What are you importing?
            </ScoutDisplayTitle>

            <label style={{ display: "block", marginBottom: 20 }}>
              <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, fontWeight: 600 }}>
                Import type
              </span>
              <select
                value={importType}
                onChange={(e) => {
                  setImportType(e.target.value as VisibleImportType);
                  setError(null);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 6,
                  padding: "10px 12px",
                  border: border.lineStrong,
                  borderRadius: radius.box,
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  background: "#fff",
                  color: color.forest,
                }}
              >
                {VISIBLE_IMPORT_TYPE_CONFIGS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: color.muted,
                  margin: "8px 0 0",
                  lineHeight: 1.5,
                }}
              >
                {config.description}
                {config.usesAi ? " Uses 1 AI credit." : ""}
              </p>
            </label>

            {error && (
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#b04040", margin: "0 0 12px" }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <ScoutSecondaryBtn onClick={handleClose}>Cancel</ScoutSecondaryBtn>
              <ScoutPrimaryBtn onClick={handleContinueFromPick}>Continue</ScoutPrimaryBtn>
            </div>
          </>
        ) : (
          <>
            <ScoutLabel>Import</ScoutLabel>
            <ScoutDisplayTitle size={22} style={{ margin: "8px 0 8px" }}>
              {config.label}
            </ScoutDisplayTitle>
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.bodySm,
                color: color.muted,
                margin: "0 0 20px",
                lineHeight: 1.5,
              }}
            >
              {config.description}
              {config.usesAi ? " Uses 1 AI credit." : ""}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 16,
                marginBottom: 20,
              }}
            >
              {config.supportsFile && (
                <div>
                  <p
                    style={{
                      fontFamily: fontSans,
                      fontSize: T.caption,
                      fontWeight: 600,
                      color: color.muted,
                      margin: "0 0 8px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    File upload
                  </p>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      onFiles(e.dataTransfer.files);
                    }}
                    onClick={() => inputRef.current?.click()}
                    style={{
                      minHeight: isMobile ? 140 : 200,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      padding: 16,
                      border: `2px dashed ${dropBorder}`,
                      borderRadius: radius.box,
                      background: dropBg,
                      cursor: parsing ? "not-allowed" : "pointer",
                    }}
                  >
                    <DocumentUploadIcon />
                    <p
                      style={{
                        fontFamily: fontSans,
                        fontSize: T.bodySm,
                        fontWeight: 600,
                        color: color.ink,
                        margin: 0,
                        textAlign: "center",
                      }}
                    >
                      Drop files or click to browse
                    </p>
                    <p
                      style={{
                        fontFamily: fontSans,
                        fontSize: T.caption,
                        color: color.muted,
                        margin: 0,
                        textAlign: "center",
                      }}
                    >
                      {config.accept}
                    </p>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept={config.accept}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      onFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {files.length > 0 && (
                    <ul
                      style={{
                        fontFamily: fontSans,
                        fontSize: T.caption,
                        margin: "8px 0 0",
                        paddingLeft: 18,
                        color: color.stone,
                      }}
                    >
                      {files.map((f) => (
                        <li key={`${f.name}-${f.size}`}>{f.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {config.supportsPaste && (
                <div>
                  <p
                    style={{
                      fontFamily: fontSans,
                      fontSize: T.caption,
                      fontWeight: 600,
                      color: color.muted,
                      margin: "0 0 8px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Paste text
                  </p>
                  <textarea
                    value={pasteText}
                    onChange={(e) => {
                      setPasteText(e.target.value);
                      setError(null);
                    }}
                    placeholder={config.pastePlaceholder}
                    style={{
                      width: "100%",
                      minHeight: isMobile ? 140 : 200,
                      padding: "12px 14px",
                      border: border.lineStrong,
                      borderRadius: radius.box,
                      fontFamily: fontSans,
                      fontSize: T.bodySm,
                      lineHeight: 1.55,
                      resize: "vertical",
                      boxSizing: "border-box",
                      background: surface.inset,
                      color: color.forest,
                    }}
                  />
                </div>
              )}
            </div>

            {parsing && (
              <div style={{ marginBottom: 16 }}>
                <KimchiProcessLoader
                  preset={importType === "application_info" ? "strategyIntake" : undefined}
                  title="Parsing import…"
                  variant="inline"
                />
              </div>
            )}

            {error && (
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#b04040", margin: "0 0 12px" }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <ScoutSecondaryBtn
                onClick={() => {
                  setFlowStep("pick");
                  setFiles([]);
                  setPasteText("");
                  setError(null);
                }}
                disabled={parsing}
              >
                Back
              </ScoutSecondaryBtn>
              <ScoutSecondaryBtn onClick={handleClose} disabled={parsing || applying}>
                Cancel
              </ScoutSecondaryBtn>
              {(files.length > 0 || pasteText.trim()) && (
                <ScoutSecondaryBtn
                  onClick={() => {
                    setFiles([]);
                    setPasteText("");
                  }}
                  disabled={parsing}
                >
                  Clear
                </ScoutSecondaryBtn>
              )}
              <ScoutPrimaryBtn
                onClick={handleParse}
                disabled={parsing || applying || (!files.length && !pasteText.trim())}
              >
                {parsing ? "Parsing…" : "Parse & review"}
              </ScoutPrimaryBtn>
            </div>
          </>
        )}
      </ScoutModal>

      {applying && (
        <ScoutModal open maxWidth={480} bruddle onClose={() => {}}>
          <KimchiProcessLoader title="Applying import…" variant="inline" />
        </ScoutModal>
      )}

      {showJobTrackerWizard && (
        <JobTrackerImportWizard
          open={showJobTrackerWizard}
          onClose={() => setShowJobTrackerWizard(false)}
          clientUserId={clientUserId}
          title="Import jobs list"
          onComplete={handleJobWizardComplete}
        />
      )}

      {showCompaniesWizard && (
        <CompaniesImportWizard
          open={showCompaniesWizard}
          onClose={() => setShowCompaniesWizard(false)}
          clientUserId={clientUserId}
          title="Import companies list"
          onComplete={handleCompaniesWizardComplete}
        />
      )}

      {showApplyProfile && intakeResult && (
        <ApplyProfileModal
          result={intakeResult}
          onClose={() => setShowApplyProfile(false)}
          onApply={handleApplyProfile}
        />
      )}

      {showUpgrade && <GrowthUpgradeModal trigger="limit_hit" onClose={() => setShowUpgrade(false)} />}
    </>
  );
}
