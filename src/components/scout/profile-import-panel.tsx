"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { UserAssetsList, type UserAssetListItem } from "@/components/scout/user-assets-list";
import { UploadDocumentModal } from "@/components/scout/upload-document-modal";
import { UnifiedImportModal } from "@/components/scout/unified-import-modal";
import { ImportCompleteView } from "@/components/scout/import-complete-view";
import { ImportHistoryTable } from "@/components/scout/import-history-table";
import { WorkspaceSegmentTabs } from "@/components/scout/workspace-segment-tabs";
import type { ImportRunDetail, ImportRunListItem } from "@/lib/client-import/import-run";
import { withClientUserId } from "@/lib/workspace-urls";
import { formatApiErrorMessage, readResponseJson } from "@/lib/api-error-message";
import { IMPORT_HISTORY_UNAVAILABLE_CODE } from "@/lib/client-import/import-history-constants";
import { color, fontSans } from "@/lib/typography";

const STRATEGY_FILE_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type ImportTab = "new" | "history";

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
  const api = useCallback((path: string) => withClientUserId(path, clientUserId), [clientUserId]);

  const [error, setError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ImportTab>("new");
  const [selectedRun, setSelectedRun] = useState<ImportRunDetail | null>(null);
  const [historyRuns, setHistoryRuns] = useState<ImportRunListItem[]>([]);
  const [historyUnavailable, setHistoryUnavailable] = useState<{
    migrationPath: string;
    migrationUrl: string;
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [referenceFiles, setReferenceFiles] = useState<UserAssetListItem[]>([]);
  const [referenceUploading, setReferenceUploading] = useState(false);
  const [showReferenceUpload, setShowReferenceUpload] = useState(false);

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

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setError(null);
    try {
      const res = await fetch(api(`/api/admin/clients/${clientUserId}/import/history`));
      const data = await readResponseJson(res);
      if (!res.ok) {
        if (data.code === IMPORT_HISTORY_UNAVAILABLE_CODE) {
          setHistoryUnavailable({
            migrationPath: typeof data.migrationPath === "string" ? data.migrationPath : "",
            migrationUrl: typeof data.migrationUrl === "string" ? data.migrationUrl : "",
          });
          setHistoryRuns([]);
          return;
        }
        throw new Error(formatApiErrorMessage(data.error, "Failed to load import history"));
      }
      setHistoryUnavailable(null);
      setHistoryRuns(Array.isArray(data.runs) ? data.runs : []);
    } catch (e) {
      setError(formatApiErrorMessage(e, "Failed to load import history"));
    } finally {
      setHistoryLoading(false);
    }
  }, [api, clientUserId]);

  const loadRunDetail = useCallback(
    async (runId: string) => {
      setError(null);
      try {
        const res = await fetch(api(`/api/admin/clients/${clientUserId}/import/runs/${runId}`));
        const data = await readResponseJson(res);
        if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Failed to load import details"));
        setSelectedRun(data.run as ImportRunDetail);
      } catch (e) {
        setError(formatApiErrorMessage(e, "Failed to load import details"));
      }
    },
    [api, clientUserId],
  );

  useEffect(() => {
    refreshReferenceFiles();
  }, [clientUserId, refreshReferenceFiles]);

  useEffect(() => {
    if (activeTab === "history") loadHistory();
  }, [activeTab, loadHistory]);

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

  function handleImportComplete(runId: string) {
    setShowImportModal(false);
    void loadRunDetail(runId);
  }

  function handleStartAnother() {
    setSelectedRun(null);
    setActiveTab("new");
    setShowImportModal(true);
  }

  if (selectedRun) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40 }}>
        <ImportCompleteView
          run={selectedRun}
          clientUserId={clientUserId}
          isMobile={isMobile}
          onStartAnother={handleStartAnother}
          onBackToHistory={() => {
            setSelectedRun(null);
            setActiveTab("history");
            void loadHistory();
          }}
        />
      </div>
    );
  }

  return (
    <div className="bruddle" style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 40 }}>
      <div>
        <h2 style={{ fontFamily: fontSans, fontSize: isMobile ? 20 : 22, fontWeight: 700, color: color.forest, margin: "0 0 6px" }}>
          Import
        </h2>
        <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: 0, lineHeight: 1.5 }}>
          Import jobs, companies, or onboarding questionnaires for this client — review before anything is written.
        </p>
      </div>

      <WorkspaceSegmentTabs
        tabs={[
          { id: "new", label: "New import" },
          { id: "history", label: "History" },
        ]}
        active={activeTab}
        onChange={setActiveTab}
        isMobile={isMobile}
        variant="bruddle"
      />

      {error && <p style={{ fontFamily: fontSans, fontSize: 13, color: "#b04040", margin: 0 }}>{error}</p>}

      {activeTab === "new" ? (
        <>
          <ScoutBox padding={isMobile ? 16 : 22}>
            {sectionHeading(
              "Client data",
              "Import a jobs list, companies list, or onboarding questionnaire. Choose the type first, then upload or paste on the next step.",
            )}
            <ScoutPrimaryBtn type="button" onClick={() => setShowImportModal(true)}>
              Import
            </ScoutPrimaryBtn>
          </ScoutBox>

          <ScoutBox padding={isMobile ? 16 : 22}>
            {sectionHeading(
              "Files (reference)",
              "Store strategy PDFs or Word docs for reference. No content extraction — files appear in the client asset library.",
            )}
            <UserAssetsList
              assets={referenceFiles}
              onDelete={handleRemoveReferenceFile}
              emptyMessage="No strategy reference files yet."
            />
            <div style={{ marginTop: 12 }}>
              <ScoutSecondaryBtn type="button" onClick={() => setShowReferenceUpload(true)} disabled={referenceUploading}>
                {referenceUploading ? "Uploading…" : "Upload strategy file"}
              </ScoutSecondaryBtn>
            </div>
          </ScoutBox>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <ScoutSecondaryBtn type="button" onClick={() => void loadHistory()} disabled={historyLoading}>
              {historyLoading ? "Refreshing…" : "Refresh"}
            </ScoutSecondaryBtn>
          </div>
          <ImportHistoryTable
            runs={historyRuns}
            loading={historyLoading}
            isMobile={isMobile}
            onDetails={(runId) => void loadRunDetail(runId)}
            onRefresh={() => void loadHistory()}
            unavailable={historyUnavailable}
          />
        </div>
      )}

      <UnifiedImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        clientUserId={clientUserId}
        onPatchProfile={onPatchProfile}
        onImportComplete={handleImportComplete}
        onSuccess={(message) => {
          setShowImportModal(false);
          setError(message);
        }}
      />

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
    </div>
  );
}
