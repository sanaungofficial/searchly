"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CompanyLogo } from "@/components/scout/company-logo";
import { CompanyHirebaseProfilePanel } from "@/components/scout/company-hirebase-profile-panel";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { useWorkspace } from "@/contexts/workspace-context";
import type { CoachCompanyLookupMeta, CoachExperienceCompany } from "@/lib/coach-experience-companies";
import { border, color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  company: CoachExperienceCompany;
  meta: CoachCompanyLookupMeta;
  trackedId: string | null;
  isMobile?: boolean;
  onClose: () => void;
  onWatchlistChange?: (slug: string, trackedId: string) => void;
};

export function CoachCompanyDrawer({
  company,
  meta,
  trackedId: trackedIdProp,
  isMobile = false,
  onClose,
  onWatchlistChange,
}: Props) {
  const router = useRouter();
  const { withClientScope, withClientReviewPath } = useWorkspace();
  const [trackedId, setTrackedId] = useState<string | null>(trackedIdProp);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTrackedId(trackedIdProp);
  }, [trackedIdProp]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const openInTargetCompanies = useCallback(() => {
    if (!trackedId) return;
    router.push(withClientReviewPath(`/profile/target-companies/${encodeURIComponent(trackedId)}`));
    onClose();
  }, [trackedId, router, withClientReviewPath, onClose]);

  const addToWatchlist = async () => {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(withClientScope("/api/companies"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: meta.name,
          catalogSlug: company.key,
          website: meta.website,
          careersUrl: meta.careersUrl,
          notes: `From coach profile — ${company.label}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.existing?.id) {
        setTrackedId(data.existing.id);
        onWatchlistChange?.(company.key, data.existing.id);
        return;
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not add company.");
        return;
      }
      const id = data.id as string;
      setTrackedId(id);
      onWatchlistChange?.(company.key, id);
    } catch {
      setError("Network error — try again.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 220, backdropFilter: isMobile ? "none" : "blur(1px)" }}
      />
      <div
        style={{
          position: "fixed",
          top: isMobile ? 0 : 8,
          right: isMobile ? 0 : 8,
          bottom: isMobile ? 0 : 8,
          left: isMobile ? 0 : undefined,
          width: isMobile ? "100%" : "min(720px, calc(100vw - 16px))",
          maxWidth: isMobile ? "100%" : "calc(100vw - 16px)",
          background: surface.inset,
          border: isMobile ? "none" : border.lineStrong,
          zIndex: 221,
          boxShadow: isMobile ? "none" : "3px 3px 0 rgba(17,17,17,0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: isMobile ? "14px 16px 12px" : "20px 24px 16px",
            borderBottom: border.line,
            background: surface.card,
            flexShrink: 0,
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              top: isMobile ? 12 : 16,
              right: isMobile ? 12 : 20,
              background: "none",
              border: "none",
              fontSize: 18,
              color: color.mutedLight,
              cursor: "pointer",
              padding: "2px 6px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", paddingRight: 36 }}>
            <CompanyLogo
              name={meta.name}
              logoUrl={meta.logoUrl}
              website={meta.website}
              careersUrl={meta.careersUrl}
              size={isMobile ? 48 : 56}
              borderRadius={10}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ ...displayTitleStyle(isMobile ? 20 : 22), margin: 0 }}>{meta.name}</div>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "6px 0 0", lineHeight: 1.45 }}>
                {company.label}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {trackedId ? (
                  <>
                    <ScoutSecondaryBtn onClick={openInTargetCompanies} style={{ minHeight: 38, fontSize: 13 }}>
                      Open in Target Companies →
                    </ScoutSecondaryBtn>
                    <span
                      style={{
                        fontFamily: fontSans,
                        fontSize: 13,
                        fontWeight: 600,
                        color: color.forest,
                        padding: "8px 4px",
                      }}
                    >
                      On your watchlist
                    </span>
                  </>
                ) : (
                  <ScoutPrimaryBtn onClick={() => void addToWatchlist()} disabled={adding} style={{ minHeight: 38, fontSize: 13 }}>
                    {adding ? "Adding…" : "Add to watchlist"}
                  </ScoutPrimaryBtn>
                )}
                {meta.website && (
                  <a
                    href={meta.website.startsWith("http") ? meta.website : `https://${meta.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, padding: "8px 4px" }}
                  >
                    Website ↗
                  </a>
                )}
              </div>
              {error && (
                <p style={{ fontFamily: fontSans, fontSize: 13, color: "#991b1b", margin: "8px 0 0" }}>{error}</p>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: isMobile ? "16px 16px 24px" : "20px 24px 32px",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.label,
              fontWeight: 700,
              color: color.muted,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 0 12px",
            }}
          >
            Company profile
          </p>
          <CompanyHirebaseProfilePanel
            companyName={meta.name}
            website={meta.website}
            slugHint={company.key}
            trackedId={trackedId}
          />
        </div>
      </div>
    </>
  );
}
