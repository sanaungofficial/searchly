"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type CareerStrategyDocument,
  EMPTY_STRATEGY,
  normalizeStrategyDocument,
  type IntakeParseResult,
  type StrategyProfileFields,
} from "@/lib/career-strategy";
import { openStrategyPdf } from "@/lib/career-strategy-pdf";
import { notifyCreditsChanged } from "@/lib/credits";
import { formatApiErrorMessage, readResponseJson } from "@/lib/api-error-message";
import { GrowthUpgradeModal } from "./growth-upgrade-modal";
import { KimchiProcessLoader } from "./kimchi-process-loader";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { border, color, fontSans, surface, T } from "@/lib/typography";

type TrackedCompanyRow = {
  id: string;
  name: string;
  priority: string | null;
  notes: string | null;
  candidateEdge: string | null;
};

export type CareerStrategyProfile = {
  name: string;
  headline: string | null;
  targetRoles: string[];
  targetSalary: string | null;
  currentSalary: string | null;
  employmentStatus: string | null;
  jobTimeline: string | null;
  careerMotivation: string | null;
  priorities: string[];
  targetMarket: string | null;
  relocationOpenness: string | null;
  workAuthorization: string | null;
  securityClearance: string | null;
  searchDuration: string | null;
  positioningStatement: string | null;
  parsedData: { location?: string | null } | null;
  resumeUrl: string | null;
};

type Props = {
  profile: CareerStrategyProfile;
  onPatchProfile: (patch: Record<string, unknown>) => Promise<void>;
  isMobile?: boolean;
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

function timelineLabel(v: string | null): string {
  if (v === "asap") return "Immediate";
  if (v === "3-6mo") return "3–6 months";
  if (v === "open") return "Open / flexible";
  return v ?? "—";
}

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 100,
  padding: "10px 12px",
  border: border.line,
  borderRadius: 0,
  fontFamily: fontSans,
  fontSize: 14,
  lineHeight: 1.5,
  color: color.forest,
  background: surface.inset,
  resize: "vertical",
  boxSizing: "border-box",
};

export function CareerStrategyPanel({ profile, onPatchProfile, isMobile }: Props) {
  const router = useRouter();
  const [intakeNotes, setIntakeNotes] = useState("");
  const [document, setDocument] = useState<CareerStrategyDocument>(EMPTY_STRATEGY);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseResult, setParseResult] = useState<IntakeParseResult | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [profileChanges, setProfileChanges] = useState<string[]>([]);
  const [isStale, setIsStale] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isPartial, setIsPartial] = useState(false);
  const [partialWarning, setPartialWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<TrackedCompanyRow[]>([]);
  const [editMode, setEditMode] = useState(false);

  const loadStrategy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/career-strategy");
      const data = await readResponseJson(res);
      if (data.error && res.status !== 404) {
        setError(formatApiErrorMessage(data.error));
      } else {
        if (data.document) setDocument(normalizeStrategyDocument(data.document));
        else setDocument(EMPTY_STRATEGY);
        if (data.intakeNotes) setIntakeNotes(String(data.intakeNotes));
        if (data.updatedAt) setUpdatedAt(String(data.updatedAt));
        setProfileChanges((data.profileChanges as string[]) ?? []);
        setIsStale(!!data.isStale);
        setIsPartial(!!data.isPartial);
        setPartialWarning(null);
      }
    } catch (e) {
      setError(formatApiErrorMessage(e, "Failed to load strategy"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStrategy();
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setCompanies(d);
        else if (d.companies) setCompanies(d.companies);
      })
      .catch(() => {});
  }, [loadStrategy]);

  async function saveIntakeNotes() {
    const res = await fetch("/api/ai/career-strategy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intakeNotes: intakeNotes.trim() }),
    });
    const data = await readResponseJson(res);
    if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Failed to save intake notes"));
  }

  async function handleGenerate() {
    if (!profile.resumeUrl) {
      setError("Upload a resume on the Assets tab first.");
      return;
    }
    setGenerating(true);
    setError(null);
    setPartialWarning(null);
    try {
      if (intakeNotes.trim()) {
        await saveIntakeNotes();
      }
      const res = await fetch("/api/ai/career-strategy", { method: "POST" });
      const data = await readResponseJson(res);
      if (res.status === 402) {
        notifyCreditsChanged();
        setShowUpgrade(true);
        return;
      }
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Generation failed"));
      setDocument(normalizeStrategyDocument(data.document));
      setUpdatedAt(data.updatedAt ? String(data.updatedAt) : null);
      setProfileChanges([]);
      setIsStale(false);
      setIsPartial(!!data.isPartial);
      if (data.warning) setPartialWarning(String(data.warning));
      notifyCreditsChanged();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Generation failed"));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveDocument() {
    setSaving(true);
    try {
      const res = await fetch("/api/ai/career-strategy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document, intakeNotes }),
      });
      if (!res.ok) throw new Error("Save failed");
      setUpdatedAt(new Date().toISOString());
      setEditMode(false);
    } catch {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleParseIntake() {
    if (!intakeNotes.trim()) {
      setError("Paste client intake notes first.");
      return;
    }
    setParsing(true);
    setError(null);
    try {
      await saveIntakeNotes();
      const res = await fetch("/api/ai/strategy-intake", {
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

  async function applyParsedFields() {
    if (!parseResult?.proposed) return;
    const patch: Record<string, unknown> = { ...parseResult.proposed };
    if (patch.name) {
      await onPatchProfile({ name: patch.name });
      delete patch.name;
    }
    await onPatchProfile(patch);

    const dreamCompanies = parseResult.suggestedDreamCompanies ?? [];
    if (dreamCompanies.length > 0) {
      await Promise.all(
        dreamCompanies.slice(0, 20).map((name) =>
          fetch("/api/companies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim(), priority: "high" }),
          }).catch(() => null),
        ),
      );
    }

    setShowApplyModal(false);
    setParseResult(null);
    await loadStrategy();
    if (dreamCompanies.length > 0) {
      fetch("/api/companies")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) setCompanies(d);
          else if (d.companies) setCompanies(d.companies);
        })
        .catch(() => {});
    }
  }

  function handleDownloadPdf() {
    const keyParams = [
      { label: "Current Location", value: profile.parsedData?.location ?? "—" },
      { label: "Target Market", value: profile.targetMarket ?? "—" },
      { label: "Target Base Salary", value: profile.targetSalary ?? "—" },
      { label: "Work Arrangement", value: (profile.priorities ?? []).filter((p) => p.includes("Remote") || p.includes("Hybrid")).join(", ") || "—" },
      { label: "Relocation", value: profile.relocationOpenness ?? "—" },
      { label: "Target Start", value: timelineLabel(profile.jobTimeline) },
      { label: "Target Roles", value: profile.targetRoles.join(", ") || "—" },
      { label: "Security Clearance", value: profile.securityClearance ?? "—" },
      { label: "Work Authorization", value: profile.workAuthorization ?? "—" },
      { label: "Search Duration", value: profile.searchDuration ?? "—" },
    ];

    openStrategyPdf({
      candidateName: profile.name,
      headline: profile.headline,
      preparedAt: updatedAt
        ? new Date(updatedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
        : new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      targetPlacementWindow: timelineLabel(profile.jobTimeline),
      keyParameters: keyParams,
      trackedCompanies: companies.map((c) => ({
        name: c.name,
        priority: c.priority,
        notes: c.notes ?? c.candidateEdge,
      })),
      targetRoles: profile.targetRoles,
      document,
    });
  }

  const hasDocument = !!(updatedAt && document.executiveSummary);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {isPartial && (
        <ScoutBox padding={16} style={{ background: "rgba(200, 120, 40, 0.08)", borderColor: "rgba(200, 120, 40, 0.35)" }}>
          <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.forest, margin: "0 0 6px" }}>
            Partial strategy saved
          </p>
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 10px" }}>
            {partialWarning ??
              "Generation was cut short. Review the sections below — regenerate only when you want the full document (uses 1 credit)."}
          </p>
          <ScoutSecondaryBtn onClick={handleGenerate} disabled={generating}>
            {generating ? "Regenerating…" : "Regenerate full strategy"}
          </ScoutSecondaryBtn>
        </ScoutBox>
      )}

      {isStale && profileChanges.length > 0 && (
        <ScoutBox padding={16} style={{ background: "rgba(200, 120, 40, 0.08)", borderColor: "rgba(200, 120, 40, 0.35)" }}>
          <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.forest, margin: "0 0 6px" }}>
            Profile updated since this strategy was generated
          </p>
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 10px" }}>
            Changes: {profileChanges.join(", ")}. Regenerate only if these updates should change the strategy.
          </p>
          <ScoutSecondaryBtn onClick={handleGenerate} disabled={generating}>
            {generating ? "Regenerating…" : "Regenerate strategy"}
          </ScoutSecondaryBtn>
        </ScoutBox>
      )}

      <ScoutBox padding={isMobile ? 16 : 22}>
        <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
          Client intake notes
        </p>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 10px" }}>
          Paste answers from your external intake form. Parse to update profile fields (with your approval), then generate the strategy doc.
        </p>
        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "0 0 10px" }}>
          Full onboarding forms are supported — paste everything. Credentials and passwords are ignored and never stored.
        </p>
        <textarea
          value={intakeNotes}
          onChange={(e) => setIntakeNotes(e.target.value)}
          placeholder="Paste client intake responses here…"
          style={{ ...textareaStyle, minHeight: 140 }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          <ScoutSecondaryBtn onClick={handleParseIntake} disabled={parsing || generating || !intakeNotes.trim()}>
            {parsing ? "Parsing…" : "Parse & review profile updates"}
          </ScoutSecondaryBtn>
          <ScoutPrimaryBtn onClick={handleGenerate} disabled={generating || parsing}>
            {generating ? "Generating…" : hasDocument ? "Regenerate strategy" : "Generate strategy"}
          </ScoutPrimaryBtn>
        </div>
        {parsing && (
          <div style={{ marginTop: 16 }}>
            <KimchiProcessLoader preset="strategyIntake" variant="inline" />
          </div>
        )}
        {generating && (
          <div style={{ marginTop: 16 }}>
            <KimchiProcessLoader preset="careerStrategy" variant="inline" />
          </div>
        )}
        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "10px 0 0" }}>
          Strategy generation uses 1 AI credit and only runs when you click the button above.
        </p>
        {error && (
          <p style={{ fontFamily: fontSans, fontSize: 13, color: "#b04040", marginTop: 10 }}>{error}</p>
        )}
      </ScoutBox>

      {/* Compiled from profile — not duplicated */}
      <ScoutBox padding={isMobile ? 16 : 22}>
        <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>
          Key parameters (from profile)
        </p>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "8px 24px", fontFamily: fontSans, fontSize: 13 }}>
          {[
            ["Location", profile.parsedData?.location],
            ["Target market", profile.targetMarket],
            ["Target salary", profile.targetSalary],
            ["Timeline", timelineLabel(profile.jobTimeline)],
            ["Relocation", profile.relocationOpenness],
            ["Clearance", profile.securityClearance],
            ["Work auth", profile.workAuthorization],
            ["Search duration", profile.searchDuration],
          ].map(([label, val]) => (
            <div key={String(label)}>
              <span style={{ color: color.muted }}>{label}: </span>
              <span style={{ color: color.forest }}>{val || "—"}</span>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "12px 0 0" }}>
          <button type="button" onClick={() => router.push("/profile/preferences")} style={{ background: "none", border: "none", padding: 0, color: color.forest, textDecoration: "underline", cursor: "pointer", fontFamily: fontSans, fontSize: 12 }}>
            Edit in Preferences →
          </button>
        </p>
      </ScoutBox>

      <ScoutBox padding={isMobile ? 16 : 22}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <div>
            <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              Target roles (from profile)
            </p>
            <p style={{ fontFamily: fontSans, fontSize: 13, color: color.forest, margin: "6px 0 0" }}>
              {profile.targetRoles.length ? profile.targetRoles.join(" · ") : "None set"}
            </p>
          </div>
          <button type="button" onClick={() => router.push("/profile/dream-role")} style={{ background: "none", border: "none", padding: 0, color: color.forest, textDecoration: "underline", cursor: "pointer", fontFamily: fontSans, fontSize: 12 }}>
            Edit target roles →
          </button>
        </div>
      </ScoutBox>

      <ScoutBox padding={isMobile ? 16 : 22}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
            Target companies (watchlist)
          </p>
          <button type="button" onClick={() => router.push("/opportunities/companies")} style={{ background: "none", border: "none", padding: 0, color: color.forest, textDecoration: "underline", cursor: "pointer", fontFamily: fontSans, fontSize: 12 }}>
            Manage in Companies →
          </button>
        </div>
        {companies.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>No companies tracked yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: border.line }}>
                <th style={{ textAlign: "left", padding: "6px 8px", color: color.muted, fontWeight: 600 }}>Company</th>
                <th style={{ textAlign: "left", padding: "6px 8px", color: color.muted, fontWeight: 600 }}>Priority</th>
              </tr>
            </thead>
            <tbody>
              {companies.slice(0, 12).map((c) => (
                <tr key={c.id} style={{ borderBottom: border.line }}>
                  <td style={{ padding: "8px" }}>{c.name}</td>
                  <td style={{ padding: "8px", color: color.muted }}>{c.priority ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ScoutBox>

      {/* Strategy document */}
      <ScoutBox padding={isMobile ? 16 : 22}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <div>
            <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, color: color.forest, margin: 0 }}>
              Career Strategy document
            </p>
            {updatedAt && (
              <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "4px 0 0" }}>
                Last updated {new Date(updatedAt).toLocaleString()}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {hasDocument && (
              <>
                <ScoutSecondaryBtn onClick={() => setEditMode(!editMode)}>
                  {editMode ? "Preview" : "Edit"}
                </ScoutSecondaryBtn>
                <ScoutSecondaryBtn onClick={handleDownloadPdf} disabled={!hasDocument}>
                  Download PDF
                </ScoutSecondaryBtn>
                {editMode && (
                  <ScoutPrimaryBtn onClick={handleSaveDocument} disabled={saving}>
                    {saving ? "Saving…" : "Save edits"}
                  </ScoutPrimaryBtn>
                )}
              </>
            )}
          </div>
        </div>

        {loading ? (
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted }}>Loading…</p>
        ) : generating ? (
          <KimchiProcessLoader preset="careerStrategy" variant="centered" />
        ) : !hasDocument ? (
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted }}>
            No strategy yet. Paste intake notes and click Generate strategy.
          </p>
        ) : editMode ? (
          <StrategyEditor document={document} onChange={setDocument} />
        ) : (
          <StrategyViewer document={document} />
        )}
      </ScoutBox>

      {showApplyModal && parseResult && (
        <ApplyProfileModal
          result={parseResult}
          onClose={() => setShowApplyModal(false)}
          onApply={applyParsedFields}
        />
      )}

      {showUpgrade && <GrowthUpgradeModal trigger="limit_hit" onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}

function StrategyViewer({ document: d }: { document: CareerStrategyDocument }) {
  return (
    <div style={{ fontFamily: fontSans, fontSize: 14, color: color.forest, lineHeight: 1.6 }}>
      <Section title="Executive Summary" body={d.executiveSummary} />
      <Section title="Overall Readiness" body={`${d.placementReadiness.overallReadiness}\n\n${d.placementReadiness.overallAssessment}`} />
      {d.placementReadiness.categories.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em", color: color.muted }}>Readiness Assessment</h4>
          {d.placementReadiness.categories.map((c) => (
            <p key={c.category} style={{ margin: "0 0 8px" }}>
              <strong>{c.category}</strong> ({c.score}) — {c.assessment}
            </p>
          ))}
        </div>
      )}
      <Section title="Positioning Directive" body={d.positioningStrategy.coreDirective} />
      {d.positioningStrategy.positioningStatement && (
        <blockquote style={{ borderLeft: `3px solid ${color.forest}`, paddingLeft: 16, margin: "12px 0", fontStyle: "italic" }}>
          {d.positioningStrategy.positioningStatement}
        </blockquote>
      )}
      {d.positioningStrategy.angles.map((a) => (
        <div key={a.title} style={{ marginBottom: 12 }}>
          <strong>{a.title}</strong> <span style={{ color: color.muted }}>({a.whenToUse})</span>
          <p style={{ margin: "4px 0 0" }}>{a.description}</p>
        </div>
      ))}
      <Section title="Search Execution" body={d.searchExecutionStrategy.intro} />
      <Section title="Path Forward" body={`${d.pathForward.summary}\n\n${d.pathForward.closing}`} />
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  if (!body?.trim()) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em", color: color.muted }}>{title}</h4>
      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{body}</p>
    </div>
  );
}

function StrategyEditor({
  document: d,
  onChange,
}: {
  document: CareerStrategyDocument;
  onChange: (d: CareerStrategyDocument) => void;
}) {
  const update = (partial: Partial<CareerStrategyDocument>) => onChange({ ...d, ...partial });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Executive Summary</label>
      <textarea style={textareaStyle} value={d.executiveSummary} onChange={(e) => update({ executiveSummary: e.target.value })} />
      <label style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Core Positioning Directive</label>
      <textarea style={textareaStyle} value={d.positioningStrategy.coreDirective} onChange={(e) => update({ positioningStrategy: { ...d.positioningStrategy, coreDirective: e.target.value } })} />
      <label style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Positioning Statement</label>
      <textarea style={{ ...textareaStyle, minHeight: 120 }} value={d.positioningStrategy.positioningStatement} onChange={(e) => update({ positioningStrategy: { ...d.positioningStrategy, positioningStatement: e.target.value } })} />
      <label style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Path Forward Summary</label>
      <textarea style={textareaStyle} value={d.pathForward.summary} onChange={(e) => update({ pathForward: { ...d.pathForward, summary: e.target.value } })} />
      <label style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Closing</label>
      <textarea style={textareaStyle} value={d.pathForward.closing} onChange={(e) => update({ pathForward: { ...d.pathForward, closing: e.target.value } })} />
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
  const entries = Object.entries(result.proposed).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0));
  const contextEntries = Object.entries(result.intakeContext ?? {}).filter(
    ([, v]) => v != null && String(v).trim() !== "",
  );
  const dreamCompanies = result.suggestedDreamCompanies ?? [];
  const canApply = entries.length > 0 || dreamCompanies.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#FFFDF9", maxWidth: 560, width: "100%", maxHeight: "80vh", overflow: "auto", padding: 24, border: border.lineStrong }}>
        <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 8px", color: color.forest }}>Review profile updates</h3>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 16px" }}>{result.summary}</p>
        {entries.length === 0 && contextEntries.length === 0 && dreamCompanies.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: 14 }}>No structured fields found. Try adding more detail to the intake notes.</p>
        ) : (
          <>
            {entries.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13, marginBottom: 16 }}>
                <tbody>
                  {entries.map(([key, val]) => (
                    <tr key={key} style={{ borderBottom: border.line }}>
                      <td style={{ padding: "8px 8px 8px 0", color: color.muted, verticalAlign: "top", width: "40%" }}>{FIELD_LABELS[key] ?? key}</td>
                      <td style={{ padding: "8px 0", color: color.forest }}>{formatValue(val)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {contextEntries.length > 0 && (
              <>
                <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                  Also captured for strategy (from intake notes)
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13, marginBottom: 16 }}>
                  <tbody>
                    {contextEntries.map(([key, val]) => (
                      <tr key={key} style={{ borderBottom: border.line }}>
                        <td style={{ padding: "8px 8px 8px 0", color: color.muted, verticalAlign: "top", width: "40%" }}>{INTAKE_CONTEXT_LABELS[key] ?? key}</td>
                        <td style={{ padding: "8px 0", color: color.forest }}>{formatValue(val)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {dreamCompanies.length > 0 && (
              <p style={{ fontFamily: fontSans, fontSize: 13, color: color.forest, margin: "0 0 16px" }}>
                <strong>{dreamCompanies.length} dream companies</strong> will be added to the watchlist on apply:{" "}
                {dreamCompanies.slice(0, 8).join(", ")}
                {dreamCompanies.length > 8 ? ` +${dreamCompanies.length - 8} more` : ""}
              </p>
            )}
          </>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <ScoutSecondaryBtn onClick={onClose}>Cancel</ScoutSecondaryBtn>
          <ScoutPrimaryBtn onClick={onApply} disabled={!canApply}>Apply to profile</ScoutPrimaryBtn>
        </div>
      </div>
    </div>
  );
}
