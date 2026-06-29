"use client";

import React from "react";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { mergeIntakeTrackedCompanies } from "@/lib/intake-tracked-companies";
import { type IntakeParseResult } from "@/lib/career-strategy";
import { color, fontSans } from "@/lib/typography";

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

export function ApplyProfileModal({
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
