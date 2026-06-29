"use client";

import Link from "next/link";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { color, fontSans } from "@/lib/typography";
import {
  RESUME_MISSING_BODY,
  RESUME_MISSING_HEADLINE,
} from "@/lib/user-facing-copy";

type Props = {
  headline?: string;
  body?: string;
  canCreateFromProfile?: boolean;
  onCreateFromProfile?: () => void;
  creating?: boolean;
  createError?: string | null;
  compact?: boolean;
  profileAssetsHref?: string;
};

export function MasterResumeGate({
  headline = RESUME_MISSING_HEADLINE,
  body = RESUME_MISSING_BODY,
  canCreateFromProfile = false,
  onCreateFromProfile,
  creating = false,
  createError = null,
  compact = false,
  profileAssetsHref = "/profile/assets",
}: Props) {
  return (
    <div
      style={{
        padding: compact ? "20px 0 8px" : "32px 0 16px",
        textAlign: compact ? "left" : "center",
        maxWidth: compact ? undefined : 420,
        margin: compact ? undefined : "0 auto",
      }}
    >
      <p
        style={{
          fontFamily: fontSans,
          fontSize: compact ? 15 : 16,
          fontWeight: 600,
          color: color.ink,
          margin: "0 0 8px",
        }}
      >
        {headline}
      </p>
      <p
        style={{
          fontFamily: fontSans,
          fontSize: 14,
          color: color.muted,
          margin: "0 0 16px",
          lineHeight: 1.55,
        }}
      >
        {body}
      </p>
      {createError && (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: "#C4574A", margin: "0 0 12px" }}>
          {createError}
        </p>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: compact ? "column" : "row",
          gap: 10,
          justifyContent: compact ? "stretch" : "center",
          flexWrap: "wrap",
        }}
      >
        {canCreateFromProfile && onCreateFromProfile && (
          <ScoutPrimaryBtn
            type="button"
            onClick={onCreateFromProfile}
            disabled={creating}
            style={{
              minHeight: 44,
              justifyContent: "center",
              opacity: creating ? 0.7 : 1,
              width: compact ? "100%" : undefined,
            }}
          >
            {creating ? "Creating…" : "Create as a resume"}
          </ScoutPrimaryBtn>
        )}
        <Link href={profileAssetsHref} style={{ textDecoration: "none", width: compact ? "100%" : undefined }}>
          <ScoutSecondaryBtn
            type="button"
            style={{
              minHeight: 44,
              justifyContent: "center",
              width: compact ? "100%" : undefined,
            }}
          >
            {canCreateFromProfile ? "Upload a resume" : "Go to Profile → Resumes"}
          </ScoutSecondaryBtn>
        </Link>
      </div>
    </div>
  );
}
