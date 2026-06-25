"use client";

import { useCallback, useEffect, useState } from "react";
import {
  mergeRecommendationPriorities,
  PIPELINE_RECOMMENDATION_PRIORITIES,
  type RecommendationPreferencesState,
} from "@/lib/recommendation-preferences";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";

type ProfilePayload = {
  parsedData?: { location?: string | null } | null;
  priorities?: string[];
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: border.line,
  borderRadius: 0,
  fontFamily: fontSans,
  fontSize: T.caption,
  boxSizing: "border-box",
  background: surface.card,
};

function ChipToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 10px",
        border: active ? border.lineStrong : border.line,
        background: active ? "rgba(26,58,47,0.08)" : surface.inset,
        color: active ? color.forest : color.muted,
        fontFamily: fontSans,
        fontSize: T.label,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {label}
    </button>
  );
}

export function PipelinePreferencesPanel({
  actingUserId,
  onLoaded,
  onApplied,
}: {
  actingUserId?: string | null;
  /** Called once when profile prefs are loaded (pre-fill, no refresh). */
  onLoaded?: (prefs: RecommendationPreferencesState) => void;
  onApplied: (prefs: RecommendationPreferencesState) => void;
}) {
  const isMobile = useIsMobile();
  const [location, setLocation] = useState("");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [baseline, setBaseline] = useState<RecommendationPreferencesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile");
      const data = (await res.json().catch(() => ({}))) as ProfilePayload & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load profile.");
        return;
      }
      const next: RecommendationPreferencesState = {
        location: data.parsedData?.location?.trim() ?? "",
        priorities: Array.isArray(data.priorities) ? data.priorities : [],
      };
      setLocation(next.location);
      setPriorities(next.priorities);
      setBaseline(next);
      onLoaded?.(next);
    } catch {
      setError("Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile, actingUserId, onLoaded]);

  const dirty =
    baseline != null &&
    (location.trim() !== baseline.location.trim() ||
      JSON.stringify([...priorities].sort()) !== JSON.stringify([...baseline.priorities].sort()));

  const handleApply = async () => {
    setSaving(true);
    setError(null);
    setSavedFlash(false);
    try {
      const profileRes = await fetch("/api/profile");
      const profile = (await profileRes.json().catch(() => ({}))) as ProfilePayload & {
        parsedData?: Record<string, unknown> | null;
      };
      if (!profileRes.ok) {
        setError("Could not save — profile unavailable.");
        return;
      }

      const parsedData = {
        ...(profile.parsedData && typeof profile.parsedData === "object" ? profile.parsedData : {}),
        location: location.trim() || null,
      };

      const patchRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parsedData,
          priorities,
        }),
      });
      if (!patchRes.ok) {
        const err = (await patchRes.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? "Could not save preferences.");
        return;
      }

      const applied: RecommendationPreferencesState = {
        location: location.trim(),
        priorities: [...priorities],
      };
      setBaseline(applied);
      setSavedFlash(true);
      onApplied(applied);
      window.setTimeout(() => setSavedFlash(false), 2500);
    } catch {
      setError("Could not save preferences.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScoutBox stack padding={22} style={{ height: "100%" }}>
      <ScoutLabel>Match preferences</ScoutLabel>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 14px", lineHeight: 1.5 }}>
        Used for recommended roles — remote, local area, and relocation scope.
      </p>

      {loading ? (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, margin: 0 }}>Loading…</p>
      ) : (
        <>
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ display: "block", fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.muted, marginBottom: 4 }}>
              Your location
            </span>
            <input
              style={inputStyle}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Baltimore, MD"
            />
          </label>

          <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.muted, margin: "0 0 8px" }}>
            Work & relocation
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {PIPELINE_RECOMMENDATION_PRIORITIES.map((pref) => (
              <ChipToggle
                key={pref}
                label={pref}
                active={priorities.includes(pref)}
                onClick={() =>
                  setPriorities((prev) => mergeRecommendationPriorities(prev, pref, !prev.includes(pref)))
                }
              />
            ))}
          </div>

          {!location.trim() && (
            <p style={{ fontFamily: fontSans, fontSize: T.label, color: "#9A6B2E", margin: "0 0 12px", lineHeight: 1.45 }}>
              Add your city to filter out international on-site roles.
            </p>
          )}

          {error && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "0 0 10px" }}>{error}</p>
          )}
          {savedFlash && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, margin: "0 0 10px" }}>
              Preferences saved — refreshing matches…
            </p>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ScoutPrimaryBtn onClick={() => void handleApply()} disabled={saving || !dirty}>
              {saving ? "Saving…" : "Apply to recommendations"}
            </ScoutPrimaryBtn>
            {dirty && !saving && (
              <ScoutSecondaryBtn
                onClick={() => {
                  if (!baseline) return;
                  setLocation(baseline.location);
                  setPriorities(baseline.priorities);
                }}
              >
                Reset
              </ScoutSecondaryBtn>
            )}
          </div>
        </>
      )}
    </ScoutBox>
  );
}
