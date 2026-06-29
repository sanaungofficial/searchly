"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AdminClientImportPanel } from "@/components/admin/admin-client-import-panel";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { UserAssetsList, type UserAssetListItem } from "@/components/scout/user-assets-list";
import { UploadDocumentModal } from "@/components/scout/upload-document-modal";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { mergeIntakeTrackedCompanies } from "@/lib/intake-tracked-companies";
import { type IntakeParseResult } from "@/lib/career-strategy";
import { normalizeQaQuestion, normalizeQaTags } from "@/lib/application-qa";
import { withClientUserId } from "@/lib/workspace-urls";
import { notifyCreditsChanged } from "@/lib/credits";
import { formatApiErrorMessage, readResponseJson } from "@/lib/api-error-message";
import { color, fontSans, surface } from "@/lib/typography";

const QUESTIONNAIRE_ACCEPT = ".pdf,.doc,.docx,.txt";
const STRATEGY_FILE_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 100,
  padding: "10px 12px",
  border: "var(--scout-border)",
  borderRadius: "var(--scout-radius)",
  fontFamily: fontSans,
  fontSize: 14,
  lineHeight: 1.5,
  color: color.forest,
  background: surface.inset,
  resize: "vertical",
  boxSizing: "border-box",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  headline: "Headline",
  summary: "Summary",
  linkedinUrl: "LinkedIn URL",
  targetRoles: "Target roles",
  targetSalary: "Target salary",
  currentSalary: "Current salary",
  employmentStatus: "Employment status",
  jobTimeline: "Job timeline",
  careerMotivation: "Motivation",
  priorities: "Priorities",
  targetMarket: "Target market",
  relocationOpenness: "Relocation",
  workAuthorization: "Work authorization",
  securityClearance: "Security clearance",
  searchDuration: "Search duration",
  positioningStatement: "Positioning statement",
};

const INTAKE_CONTEXT_LABELS: Record<string, string> = {
  recentEmployer: "Recent employer",
  recentTitle: "Recent title",
  industries: "Industries",
  companyStages: "Company stage",
  avoidNotes: "Avoid / pass",
  searchActivity: "Search activity",
  activeOffers: "Active offers",
  benefitsMustHaves: "Benefits must-haves",
  dealBreakers: "Deal breakers",
};

function formatValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function sectionHeading(title: string, subtitle?: string) {
  return (
    <>
      <p
        style={{
          fontFamily: fontSans,
          fontSize: 13,
          fontWeight: 600,
          color: color.muted,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          margin: "0 0 8px",
        }}
      >
        {title}
        <span
          style={{
            marginLeft: 8,
            fontSize: 11,
            fontWeight: 500,
            color: color.forest,
            textTransform: "none",
            letterSpacing: 0,
          }}
        >
          Admin only
        </span>
      </p>
      {subtitle ? (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 12px", lineHeight: 1.55 }}>
          {subtitle}
        </p>
      ) : null}
    </>
  );
}

type Props = {
  clientUserId: string;
  onPatchProfile: (patch: Record<string, unknown>) => Promise<void>;
  isMobile?: boolean;
};

export function ProfileImportPanel({ clientUserId, onPatchProfile, isMobile }: Props) {
  const api = (path: string) => withClientUserId(path, clientUserId);

  const [intakeNotes, setIntakeNotes] = useState("");
  const [parsing, setParsing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [parseResult, setParseResult] = useState<IntakeParseResult | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [referenceFiles, setReferenceFiles] = useState<UserAssetListItem[]>([]);
  const [referenceUploading, setReferenceUploading] = useState(false);
  const [showReferenceUpload, setShowReferenceUpload] = useState(false);

  const questionnaireInputRef = useRef<HTMLInputElement>(null);

  const refreshReferenceFiles = useCallback(() => {
    fetch(api("/api/assets"))
      .then((r) => r.json())
      .then((assets: Array<{ id: string; name: string; url: string; createdAt: string; type: string }>) => {
        if (!Array.isArray(assets)) return;
        setReferenceFiles(
          assets
            .filter((a) => a.type === "JOB_SEARCH_STRATEGY")
            .map((a) => ({
              id: a.id,
              type: "JOB_SEARCH_STRATEGY" as const,
              name: a.name,
              url: a.url,
              createdAt: a.createdAt,
            })),
        );
      })
      .catch(() => {});
  }, [clientUserId]);

  useEffect(() => {
    fetch(api("/api/ai/career-strategy"))
      .then((r) => r.json())
      .then((data) => {
        if (data.intakeNotes != null) setIntakeNotes(String(data.intakeNotes));
      })
      .catch(() => {});
    refreshReferenceFiles();
  }, [clientUserId, refreshReferenceFiles]);

  async function saveIntakeNotes() {
    const res = await fetch(api("/api/ai/career-strategy"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intakeNotes: intakeNotes.trim() }),
    });
    const data = await readResponseJson(res);
    if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Failed to save intake notes"));
  }

  async function handleQuestionnaireFile(file: File) {
    setExtracting(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      let text = "";
      if (ext === "txt") {
        text = (await file.text()).trim();
      } else {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(api(`/api/admin/clients/${clientUserId}/import/extract-text`), {
          method: "POST",
          body: form,
        });
        const data = await readResponseJson(res);
        if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Could not read file"));
        text = String(data.text ?? "").trim();
      }
      if (!text) throw new Error("No text found in file");
      setIntakeNotes((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
    } catch (e) {
      setError(formatApiErrorMessage(e, "Failed to read questionnaire file"));
    } finally {
      setExtracting(false);
    }
  }

  async function handleParseIntake() {
    if (!intakeNotes.trim()) {
      setError("Paste questionnaire text or upload a file first.");
      return;
    }
    setParsing(true);
    setError(null);
    try {
      await saveIntakeNotes();
      const res = await fetch(api("/api/ai/strategy-intake"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: intakeNotes }),
      });
      const data = await readResponseJson(res);
      if (res.status === 402) {
        notifyCreditsChanged();
        setShowUpgrade(true);
        return;
      }
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Parse failed"));
      setParseResult(data as IntakeParseResult);
      setShowApplyModal(true);
      notifyCreditsChanged();
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
    const existingKeys = new Set(
      (existingData.entries ?? []).map((e) => normalizeQaQuestion(e.question)),
    );

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

  async function applyParsedFields() {
    if (!parseResult) return;
    setError(null);
    try {
      const patch: Record<string, unknown> = { ...(parseResult.proposed ?? {}) };
      if (Object.keys(patch).length > 0) {
        if (patch.name) {
          await onPatchProfile({ name: patch.name });
          delete patch.name;
        }
        if (Object.keys(patch).length > 0) {
          await onPatchProfile(patch);
        }
      }

      const trackedCompanies = mergeIntakeTrackedCompanies(parseResult);
      const messages: string[] = [];

      if (trackedCompanies.length > 0) {
        const res = await fetch(api("/api/companies/intake-apply"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestedTrackedCompanies: trackedCompanies }),
        });
        const data = await readResponseJson(res);
        if (!res.ok) {
          throw new Error(formatApiErrorMessage(data.error, "Failed to add target companies"));
        }
        const added = Number(data.added ?? 0);
        const updated = Number(data.updated ?? 0);
        messages.push(`Target companies: ${added} added, ${updated} updated.`);
      }

      const qaResult = await applyApplicationQa(parseResult.suggestedApplicationQa);
      if (qaResult.added || qaResult.skipped) {
        messages.push(
          `Application Q&A: ${qaResult.added} added${qaResult.skipped ? `, ${qaResult.skipped} skipped (duplicate)` : ""}.`,
        );
      }

      setShowApplyModal(false);
      setParseResult(null);
      if (messages.length) {
        setApplySuccess(messages.join(" "));
        window.setTimeout(() => setApplySuccess(null), 12000);
      }
    } catch (e) {
      setError(formatApiErrorMessage(e, "Failed to apply profile updates"));
    }
  }

  async function handleReferenceUpload(file: File) {
    setReferenceUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", "JOB_SEARCH_STRATEGY");
      const res = await fetch(api("/api/assets/upload"), { method: "POST", body: form });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Upload failed"));
      refreshReferenceFiles();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Failed to upload file"));
      throw e;
    } finally {
      setReferenceUploading(false);
    }
  }

  async function handleReferenceFilesSelected(files: File[]) {
    if (!files.length) return;
    for (const file of files) {
      try {
        await handleReferenceUpload(file);
      } catch {
        return;
      }
    }
    setShowReferenceUpload(false);
  }

  async function handleRemoveReferenceFile(id: string) {
    try {
      const res = await fetch(api(`/api/assets?id=${encodeURIComponent(id)}`), { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      refreshReferenceFiles();
    } catch {
      setError("Failed to remove file");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40 }}>
      <div>
        <h2 style={{ fontFamily: fontSans, fontSize: isMobile ? 20 : 22, fontWeight: 700, color: color.forest, margin: "0 0 6px" }}>
          Import
        </h2>
        <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: 0, lineHeight: 1.5 }}>
          One place to load trackers, onboarding questionnaires, and reference strategy files for this client.
        </p>
      </div>

      {applySuccess && (
        <ScoutBox padding={16} style={{ background: "rgba(74,139,106,0.08)", borderColor: "rgba(74,139,106,0.35)" }}>
          <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.forest, margin: 0 }}>{applySuccess}</p>
        </ScoutBox>
      )}

      {error && (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: "#b04040", margin: 0 }}>{error}</p>
      )}

      <ScoutBox padding={isMobile ? 16 : 22}>
        {sectionHeading(
          "Trackers",
          "Upload the Google Sheet export (.xlsx or .csv) with job tracker, contacts, target companies, and role tabs. Review before apply — nothing writes automatically.",
        )}
        <AdminClientImportPanel clientUserId={clientUserId} embedded />
      </ScoutBox>

      <ScoutBox padding={isMobile ? 16 : 22}>
        {sectionHeading(
          "Questionnaire / intake",
          "Paste onboarding answers or upload a questionnaire (.txt, .pdf, .docx). Parse to update profile fields, preferences, target companies, and Application Q&A.",
        )}
        <input
          ref={questionnaireInputRef}
          type="file"
          accept={QUESTIONNAIRE_ACCEPT}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleQuestionnaireFile(file);
            e.target.value = "";
          }}
        />
        <textarea
          value={intakeNotes}
          onChange={(e) => setIntakeNotes(e.target.value)}
          placeholder="Paste client intake or questionnaire responses here…"
          style={{ ...textareaStyle, minHeight: 140 }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          <ScoutSecondaryBtn
            type="button"
            onClick={() => questionnaireInputRef.current?.click()}
            disabled={extracting || parsing}
          >
            {extracting ? "Reading file…" : "Upload questionnaire"}
          </ScoutSecondaryBtn>
          <ScoutPrimaryBtn type="button" onClick={handleParseIntake} disabled={parsing || extracting || !intakeNotes.trim()}>
            {parsing ? "Parsing…" : "Parse & review profile updates"}
          </ScoutPrimaryBtn>
        </div>
        {parsing && (
          <div style={{ marginTop: 16 }}>
            <KimchiProcessLoader preset="strategyIntake" variant="inline" />
          </div>
        )}
        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "10px 0 0" }}>
          Intake parse uses 1 AI credit. Saved notes also feed Career Strategy generation.
        </p>
      </ScoutBox>

      <ScoutBox padding={isMobile ? 16 : 22}>
        {sectionHeading(
          "Files (reference)",
          "Store strategy PDFs or Word docs for reference. No content extraction — files appear in the client asset library.",
        )}
        <UserAssetsList
          assets={referenceFiles}
          onRemove={handleRemoveReferenceFile}
          emptyMessage="No strategy reference files yet."
        />
        <div style={{ marginTop: 12 }}>
          <ScoutSecondaryBtn type="button" onClick={() => setShowReferenceUpload(true)} disabled={referenceUploading}>
            {referenceUploading ? "Uploading…" : "Upload strategy file"}
          </ScoutSecondaryBtn>
        </div>
      </ScoutBox>

      {showApplyModal && parseResult && (
        <ApplyProfileModal
          result={parseResult}
          onClose={() => setShowApplyModal(false)}
          onApply={applyParsedFields}
        />
      )}

      {showReferenceUpload && (
        <UploadDocumentModal
          open={showReferenceUpload}
          onClose={() => setShowReferenceUpload(false)}
          accept={STRATEGY_FILE_ACCEPT}
          title="Upload strategy reference"
          hint="PDF or Word — stored only, not parsed."
          onFilesSelected={handleReferenceFilesSelected}
          uploading={referenceUploading}
        />
      )}

      {showUpgrade && <GrowthUpgradeModal trigger="limit_hit" onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}

function ApplyProfileModal({
  result,
  onClose,
  onApply,
}: {
  result: IntakeParseResult;
  onClose: () => void;
  onApply: () => void;
}) {
  const entries = Object.entries(result.proposed).filter(
    ([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0),
  );
  const contextEntries = Object.entries(result.intakeContext ?? {}).filter(
    ([, v]) => v != null && String(v).trim() !== "",
  );
  const trackedCompanies = mergeIntakeTrackedCompanies(result);
  const qaEntries = result.suggestedApplicationQa ?? [];
  const canApply = entries.length > 0 || trackedCompanies.length > 0 || qaEntries.length > 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#FFFDF9",
          maxWidth: 560,
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
          padding: 24,
          border: "var(--scout-border)",
        }}
      >
        <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 8px", color: color.forest }}>
          Review profile updates
        </h3>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 16px" }}>{result.summary}</p>
        {entries.length === 0 && contextEntries.length === 0 && trackedCompanies.length === 0 && qaEntries.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: 14 }}>No structured fields found. Try adding more detail.</p>
        ) : (
          <>
            {entries.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13, marginBottom: 16 }}>
                <tbody>
                  {entries.map(([key, val]) => (
                    <tr key={key} style={{ borderBottom: "var(--scout-border)" }}>
                      <td style={{ padding: "8px 8px 8px 0", color: color.muted, verticalAlign: "top", width: "40%" }}>
                        {FIELD_LABELS[key] ?? key}
                      </td>
                      <td style={{ padding: "8px 0", color: color.forest }}>{formatValue(val)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {contextEntries.length > 0 && (
              <>
                <p
                  style={{
                    fontFamily: fontSans,
                    fontSize: 12,
                    fontWeight: 600,
                    color: color.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    margin: "0 0 8px",
                  }}
                >
                  Also captured for strategy
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13, marginBottom: 16 }}>
                  <tbody>
                    {contextEntries.map(([key, val]) => (
                      <tr key={key} style={{ borderBottom: "var(--scout-border)" }}>
                        <td style={{ padding: "8px 8px 8px 0", color: color.muted, verticalAlign: "top", width: "40%" }}>
                          {INTAKE_CONTEXT_LABELS[key] ?? key}
                        </td>
                        <td style={{ padding: "8px 0", color: color.forest }}>{formatValue(val)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {trackedCompanies.length > 0 && (
              <p style={{ fontFamily: fontSans, fontSize: 13, color: color.forest, margin: "0 0 16px" }}>
                <strong>{trackedCompanies.length} target companies</strong> will be added or updated on apply.
              </p>
            )}
            {qaEntries.length > 0 && (
              <p style={{ fontFamily: fontSans, fontSize: 13, color: color.forest, margin: "0 0 16px" }}>
                <strong>{qaEntries.length} Application Q&A entries</strong> will be added (tagged onboarding; duplicates skipped).
              </p>
            )}
          </>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <ScoutSecondaryBtn onClick={onClose}>Cancel</ScoutSecondaryBtn>
          <ScoutPrimaryBtn onClick={onApply} disabled={!canApply}>
            Apply to profile
          </ScoutPrimaryBtn>
        </div>
      </div>
    </div>
  );
}
