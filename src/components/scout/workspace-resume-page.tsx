"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { WorkspaceContent, WorkspaceScroll } from "./workspace-content";
import { ResumeCollectionView, type ResumeCollectionAsset } from "./resume-collection-view";
import { ProfileResumeEditor } from "./profile-resume-editor";
import {
  ResumeAnalyzingModal,
  ResumeUploadSuccessModal,
  useResumeUploadFlow,
} from "./resume-upload-flow";
import { GrowthUpgradeModal } from "./growth-upgrade-modal";
import { RP } from "@/lib/resume-page-tokens";
import { useIsMobile } from "@/hooks/use-mobile";

export function WorkspaceResumePage({ editAssetId }: { editAssetId?: string | null }) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { withClientScope, openPricing } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<ResumeCollectionAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);

  const refreshAssets = useCallback(async () => {
    const res = await fetch(withClientScope("/api/assets"));
    if (!res.ok) return;
    const data = await res.json();
    const rows = (Array.isArray(data) ? data : data.assets ?? []) as (ResumeCollectionAsset & { type?: string })[];
    setAssets(rows.filter((a) => a.type === "RESUME"));
  }, [withClientScope]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(withClientScope("/api/assets")).then((r) => r.json()),
      fetch(withClientScope("/api/profile")).then((r) => r.json()),
    ])
      .then(([assetData, profileData]) => {
        const rows = (Array.isArray(assetData) ? assetData : assetData.assets ?? []) as (ResumeCollectionAsset & { type?: string })[];
        setAssets(rows.filter((a) => a.type === "RESUME"));
        if (Array.isArray(profileData?.targetRoles)) setTargetRoles(profileData.targetRoles);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [withClientScope]);

  const handleAssetDelete = async (assetId: string) => {
    await fetch(withClientScope(`/api/assets/${assetId}`), { method: "DELETE" });
    void refreshAssets();
  };

  const uploadFlow = useResumeUploadFlow({
    onComplete: () => void refreshAssets(),
    onFailed: (message) => {
      setUploadError(message);
      void refreshAssets();
    },
    onCancel: handleAssetDelete,
    assetApiUrl: (id) => withClientScope(`/api/assets/${id}`),
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(withClientScope("/api/resume"), { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed — try again.");
        return;
      }
      if (res.status === 202 && data.asset?.id) {
        void refreshAssets();
        uploadFlow.startJob(data.asset.id, data.defaultName || data.asset.name || file.name.replace(/\.[^/.]+$/, ""));
        return;
      }
      if (data.asset?.id) {
        void refreshAssets();
        router.push(`/resume/edit/${data.asset.id}`);
      }
    } catch {
      setUploadError("Upload failed — try again.");
    } finally {
      setUploading(false);
    }
  };

  const openEditor = (assetId: string) => {
    router.push(`/resume/edit/${assetId}`);
  };

  const closeEditor = () => {
    router.push("/resume");
  };

  const makePrimary = async (id: string) => {
    setAssets((prev) => prev.map((a) => ({ ...a, isPrimary: a.id === id })));
    const res = await fetch(withClientScope(`/api/assets/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: true }),
    });
    if (!res.ok) void refreshAssets();
  };

  const deleteAsset = async (id: string) => {
    if (!window.confirm("Delete this resume? This cannot be undone.")) return;
    await handleAssetDelete(id);
    if (editAssetId === id) closeEditor();
  };

  if (editAssetId) {
    return (
      <ProfileResumeEditor
        open
        layout="page"
        assetId={editAssetId}
        onClose={closeEditor}
        onUpdated={() => void refreshAssets()}
      />
    );
  }

  return (
    <>
      <WorkspaceScroll>
        <WorkspaceContent>
          <div style={{ background: RP.pageBg, minHeight: "100%", padding: isMobile ? "16px 0" : "24px 0" }}>
            {uploadError && (
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: RP.urgent, marginBottom: 12 }}>{uploadError}</p>
            )}
            {loading ? (
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: RP.textMuted }}>Loading resumes…</p>
            ) : (
              <ResumeCollectionView
                assets={assets}
                uploading={uploading}
                onUploadClick={() => inputRef.current?.click()}
                onOpenResume={openEditor}
                onMakePrimary={(id) => void makePrimary(id)}
                onDelete={(id) => void deleteAsset(id)}
                onDownload={(asset) => {
                  if (asset.url) window.open(asset.url, "_blank");
                }}
              />
            )}
          </div>
        </WorkspaceContent>
      </WorkspaceScroll>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleUpload(f);
          e.target.value = "";
        }}
      />

      {uploadFlow.showAnalyzingModal && (
        <ResumeAnalyzingModal
          isMobile={isMobile}
          onContinueBrowsing={uploadFlow.continueBrowsing}
          onCancel={() => void uploadFlow.cancelUpload()}
        />
      )}
      {uploadFlow.showSuccessModal && uploadFlow.job && (
        <ResumeUploadSuccessModal
          defaultName={uploadFlow.job.defaultName}
          saving={uploadFlow.savingMeta}
          isMobile={isMobile}
          targetRoles={targetRoles}
          onSave={(name, targetJobTitle) => void uploadFlow.finishSuccess(name, targetJobTitle)}
          onViewResume={() => {
            const assetId = uploadFlow.viewResume();
            if (assetId) openEditor(assetId);
          }}
        />
      )}
      {showUpgrade && (
        <GrowthUpgradeModal trigger="limit_hit" onClose={() => setShowUpgrade(false)} onOpenPricing={openPricing} />
      )}
    </>
  );
}
