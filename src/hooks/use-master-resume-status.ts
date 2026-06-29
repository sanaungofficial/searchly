"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { profileHasResumeMaterial } from "@/lib/master-resume-shared";
import { formatApiErrorMessage, readResponseJson } from "@/lib/api-error-message";

type MasterResumeStatus = {
  loading: boolean;
  hasMasterResume: boolean;
  canCreateFromProfile: boolean;
  creating: boolean;
  createError: string | null;
  refresh: () => void;
  createFromProfile: () => Promise<string | null>;
};

export function useMasterResumeStatus(): MasterResumeStatus {
  const { withClientScope } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [hasMasterResume, setHasMasterResume] = useState(false);
  const [canCreateFromProfile, setCanCreateFromProfile] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(withClientScope("/api/assets")).then((r) => r.json()),
      fetch(withClientScope("/api/profile")).then((r) => r.json()),
    ])
      .then(([assets, profile]) => {
        const resumes = Array.isArray(assets)
          ? assets.filter((a: { type?: string }) => a.type === "RESUME")
          : [];
        const hasResume = resumes.length > 0;
        setHasMasterResume(hasResume);
        if (profile?.error) {
          setCanCreateFromProfile(false);
          return;
        }
        setCanCreateFromProfile(
          !hasResume &&
            profileHasResumeMaterial(
              {
                parsedData: profile.parsedData,
                summary: profile.summary,
                resumeText: profile.resumeText,
                linkedinUrl: profile.linkedinUrl,
              },
              { name: profile.name, email: profile.email },
            ),
        );
      })
      .catch(() => {
        setHasMasterResume(false);
        setCanCreateFromProfile(false);
      })
      .finally(() => setLoading(false));
  }, [withClientScope]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createFromProfile = useCallback(async (): Promise<string | null> => {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(withClientScope("/api/resume/create-from-profile"), { method: "POST" });
      const data = await readResponseJson(res);
      if (!res.ok) {
        setCreateError(formatApiErrorMessage(data.error, "Could not create resume from profile"));
        return null;
      }
      const asset = data.asset as { id?: string } | undefined;
      const assetId = asset?.id ?? null;
      refresh();
      return assetId;
    } catch (e) {
      setCreateError(formatApiErrorMessage(e, "Could not create resume from profile"));
      return null;
    } finally {
      setCreating(false);
    }
  }, [refresh, withClientScope]);

  return {
    loading,
    hasMasterResume,
    canCreateFromProfile,
    creating,
    createError,
    refresh,
    createFromProfile,
  };
}
