"use client";

import React, { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

function PrefChip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>{label}</p>
      <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: "var(--scout-radius)", background: "var(--scout-inset)", border: "1px solid rgba(0,0,0,0.08)", fontSize: 14, color: "#1C3A2F", fontFamily: "var(--font-ui)" }}>{value}</span>
    </div>
  );
}

function SectionHeader({ title, onEdit }: { title: string; onEdit?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 style={{ fontFamily: fontSans, fontSize: T.heading, fontWeight: 600, color: color.forest, margin: 0 }}>{title}</h3>
      {onEdit && (
        <button onClick={onEdit} className="p-1.5 rounded-[var(--scout-radius)] hover:bg-[#E8D5A3]/40 transition-colors" aria-label={`Edit ${title}`}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9.5 1.5L12.5 4.5L5 12H2V9L9.5 1.5Z" stroke="#52493F" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

export const PREF_EMPLOYMENT = [
  { value: "employed", label: "Employed — not actively looking" },
  { value: "open", label: "Employed — open to opportunities" },
  { value: "searching", label: "Actively searching" },
];

export const PREF_JOB_TIMELINES = [
  { value: "asap", label: "As soon as possible" },
  { value: "3-6mo", label: "In the next 3–6 months" },
  { value: "open", label: "Whenever the right role appears" },
];

export const PREF_MOTIVATIONS = [
  "Higher compensation",
  "More interesting work",
  "Better work-life balance",
  "Step up in level",
  "A career pivot",
];

export const PREF_PRIORITIES = [
  "Remote-first",
  "Hybrid-friendly",
  "Work-life balance",
  "High compensation",
  "Equity / ownership",
  "Mission-driven",
  "Fast growth",
  "Strong team culture",
  "Specific location",
  "Open to relocating within my country",
  "Open to relocating internationally",
];

export type CareerPreferencesProfile = {
  employmentStatus: string | null;
  jobTimeline: string | null;
  currentSalary: string | null;
  targetSalary: string | null;
  careerMotivation: string | null;
  priorities: string[];
  targetMarket: string | null;
  relocationOpenness: string | null;
  workAuthorization: string | null;
  securityClearance: string | null;
  searchDuration: string | null;
  positioningStatement: string | null;
  parsedData?: { location?: string | null } | null;
};

export type CareerPrefPatch = Partial<CareerPreferencesProfile>;

type Props = {
  profile: CareerPreferencesProfile;
  onSave: (patch: CareerPrefPatch) => Promise<void>;
  title?: string;
  subtitle?: string;
  locationEditHref?: string;
};

export function CareerPreferencesPanel({
  profile,
  onSave,
  title = "Career preferences",
  subtitle,
  locationEditHref,
}: Props) {
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState(false);
  const [empStatus, setEmpStatus] = useState(profile.employmentStatus || "");
  const [timeline, setTimeline] = useState(profile.jobTimeline || "");
  const [currentSalary, setCurrentSalary] = useState(profile.currentSalary || "");
  const [targetSalary, setTargetSalary] = useState(profile.targetSalary || "");
  const [motivation, setMotivation] = useState(profile.careerMotivation || "");
  const [priorities, setPriorities] = useState<string[]>(profile.priorities || []);
  const [targetMarket, setTargetMarket] = useState(profile.targetMarket || "");
  const [relocationOpenness, setRelocationOpenness] = useState(profile.relocationOpenness || "");
  const [workAuthorization, setWorkAuthorization] = useState(profile.workAuthorization || "");
  const [securityClearance, setSecurityClearance] = useState(profile.securityClearance || "");
  const [searchDuration, setSearchDuration] = useState(profile.searchDuration || "");
  const [positioningStatement, setPositioningStatement] = useState(profile.positioningStatement || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmpStatus(profile.employmentStatus || "");
    setTimeline(profile.jobTimeline || "");
    setCurrentSalary(profile.currentSalary || "");
    setTargetSalary(profile.targetSalary || "");
    setMotivation(profile.careerMotivation || "");
    setPriorities(profile.priorities || []);
    setTargetMarket(profile.targetMarket || "");
    setRelocationOpenness(profile.relocationOpenness || "");
    setWorkAuthorization(profile.workAuthorization || "");
    setSecurityClearance(profile.securityClearance || "");
    setSearchDuration(profile.searchDuration || "");
    setPositioningStatement(profile.positioningStatement || "");
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      employmentStatus: empStatus || null,
      jobTimeline: timeline || null,
      currentSalary: currentSalary || null,
      targetSalary: targetSalary || null,
      careerMotivation: motivation || null,
      priorities,
      targetMarket: targetMarket || null,
      relocationOpenness: relocationOpenness || null,
      workAuthorization: workAuthorization || null,
      securityClearance: securityClearance || null,
      searchDuration: searchDuration || null,
      positioningStatement: positioningStatement || null,
    });
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setEmpStatus(profile.employmentStatus || "");
    setTimeline(profile.jobTimeline || "");
    setCurrentSalary(profile.currentSalary || "");
    setTargetSalary(profile.targetSalary || "");
    setMotivation(profile.careerMotivation || "");
    setPriorities(profile.priorities || []);
    setTargetMarket(profile.targetMarket || "");
    setRelocationOpenness(profile.relocationOpenness || "");
    setWorkAuthorization(profile.workAuthorization || "");
    setSecurityClearance(profile.securityClearance || "");
    setSearchDuration(profile.searchDuration || "");
    setPositioningStatement(profile.positioningStatement || "");
    setEditing(false);
  };

  const statusLabel = PREF_EMPLOYMENT.find((e) => e.value === profile.employmentStatus)?.label;
  const timelineLabel = PREF_JOB_TIMELINES.find((t) => t.value === profile.jobTimeline)?.label;
  const hasAnyData =
    profile.employmentStatus ||
    profile.jobTimeline ||
    profile.currentSalary ||
    profile.targetSalary ||
    profile.careerMotivation ||
    (profile.priorities || []).length > 0 ||
    profile.targetMarket ||
    profile.relocationOpenness ||
    profile.workAuthorization ||
    profile.securityClearance ||
    profile.searchDuration ||
    profile.positioningStatement ||
    profile.parsedData?.location;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: isMobile ? "12px 10px" : "8px 10px",
    fontSize: isMobile ? 16 : 13,
    borderRadius: "var(--scout-radius)",
    border: border.line,
    background: surface.inset,
    color: color.forest,
    fontFamily: fontSans,
    outline: "none",
    boxSizing: "border-box",
  };

  const location = profile.parsedData?.location;

  return (
    <ScoutBox padding={isMobile ? "18px 16px" : "22px 24px"}>
      <SectionHeader title={title} onEdit={() => setEditing(!editing)} />
      {subtitle && (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 14px", lineHeight: 1.5 }}>{subtitle}</p>
      )}

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 6 }}>Status</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PREF_EMPLOYMENT.map(({ value, label }) => (
                <button key={value} type="button" onClick={() => setEmpStatus(empStatus === value ? "" : value)}
                  style={{ textAlign: "left", padding: isMobile ? "12px 12px" : "8px 12px", minHeight: isMobile ? 44 : undefined, borderRadius: "var(--scout-radius)", border: empStatus === value ? border.lineStrong : border.line, background: empStatus === value ? "rgba(26,58,47,0.06)" : surface.inset, fontSize: T.bodySm, color: color.forest, fontFamily: fontSans, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 6 }}>Timeline</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PREF_JOB_TIMELINES.map(({ value, label }) => (
                <button key={value} type="button" onClick={() => setTimeline(timeline === value ? "" : value)}
                  style={{ textAlign: "left", padding: isMobile ? "12px 12px" : "8px 12px", minHeight: isMobile ? 44 : undefined, borderRadius: "var(--scout-radius)", border: timeline === value ? border.lineStrong : border.line, background: timeline === value ? "rgba(26,58,47,0.06)" : surface.inset, fontSize: T.bodySm, color: color.forest, fontFamily: fontSans, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            {([["Current salary", currentSalary, setCurrentSalary], ["Target salary", targetSalary, setTargetSalary]] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
              <div key={label}>
                <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 6 }}>{label}</p>
                <input value={val} onChange={(e) => setter(e.target.value)} placeholder="e.g. $120K" style={inputStyle} />
              </div>
            ))}
          </div>

          <div>
            <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 6 }}>Primary motivation</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PREF_MOTIVATIONS.map((m) => (
                <button key={m} type="button" onClick={() => setMotivation(motivation === m ? "" : m)}
                  style={{ padding: "5px 12px", borderRadius: "var(--scout-radius)", border: motivation === m ? border.lineStrong : border.line, background: motivation === m ? "rgba(26,58,47,0.08)" : surface.inset, fontSize: T.bodySm, color: motivation === m ? color.forest : color.muted, fontFamily: fontSans, cursor: "pointer" }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 6 }}>What matters most</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PREF_PRIORITIES.map((p) => (
                <button key={p} type="button" onClick={() => setPriorities((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))}
                  style={{ padding: "5px 12px", borderRadius: "var(--scout-radius)", border: priorities.includes(p) ? border.lineStrong : border.line, background: priorities.includes(p) ? "rgba(26,58,47,0.08)" : surface.inset, fontSize: T.bodySm, color: priorities.includes(p) ? color.forest : color.muted, fontFamily: fontSans, cursor: "pointer" }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 6 }}>Search details</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                ["Target market (geo)", targetMarket, setTargetMarket, "e.g. Greater Philadelphia / Southern NJ"],
                ["Relocation", relocationOpenness, setRelocationOpenness, "e.g. Open depending on role"],
                ["Work authorization", workAuthorization, setWorkAuthorization, "e.g. U.S. Citizen"],
                ["Security clearance", securityClearance, setSecurityClearance, "e.g. Secret (verify status)"],
                ["Search duration", searchDuration, setSearchDuration, "e.g. 6+ months actively searching"],
              ] as [string, string, (v: string) => void, string][]).map(([label, val, setter, placeholder]) => (
                <div key={label}>
                  <p style={{ fontSize: 13, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 4 }}>{label}</p>
                  <input value={val} onChange={(e) => setter(e.target.value)} placeholder={placeholder} style={inputStyle} />
                </div>
              ))}
              <div>
                <p style={{ fontSize: 13, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 4 }}>Positioning statement</p>
                <textarea value={positioningStatement} onChange={(e) => setPositioningStatement(e.target.value)} placeholder="First-person positioning narrative…" style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, paddingTop: 2 }}>
            <ScoutPrimaryBtn onClick={handleSave} disabled={saving} style={{ opacity: saving ? 0.5 : 1 }}>
              {saving ? "Saving…" : "Save"}
            </ScoutPrimaryBtn>
            <ScoutSecondaryBtn onClick={handleCancel}>Cancel</ScoutSecondaryBtn>
          </div>
        </div>
      ) : !hasAnyData ? (
        <div style={{ paddingTop: 4 }}>
          <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 6 }}>
            Nothing set yet.{" "}
            <button type="button" onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: "#C4A86A", fontSize: 14, cursor: "pointer", fontFamily: "var(--font-ui)", padding: 0 }}>
              Add details →
            </button>
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {location && (
            <div>
              <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Current location</p>
              <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: "var(--scout-radius)", background: "var(--scout-inset)", border: "1px solid rgba(0,0,0,0.08)", fontSize: 14, color: "#1C3A2F", fontFamily: "var(--font-ui)" }}>{location}</span>
              {locationEditHref && (
                <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "8px 0 0" }}>
                  <a href={locationEditHref} style={{ color: color.forest }}>Edit location in About →</a>
                </p>
              )}
            </div>
          )}
          {profile.employmentStatus && (
            <div>
              <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Status</p>
              <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: "var(--scout-radius)", background: "var(--scout-inset)", border: "1px solid rgba(0,0,0,0.08)", fontSize: 14, color: "#1C3A2F", fontFamily: "var(--font-ui)" }}>{statusLabel || profile.employmentStatus}</span>
            </div>
          )}
          {profile.jobTimeline && (
            <div>
              <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Timeline</p>
              <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: "var(--scout-radius)", background: "var(--scout-inset)", border: "1px solid rgba(0,0,0,0.08)", fontSize: 14, color: "#1C3A2F", fontFamily: "var(--font-ui)" }}>{timelineLabel || profile.jobTimeline}</span>
            </div>
          )}
          {(profile.currentSalary || profile.targetSalary) && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {profile.currentSalary && <PrefChip label="Current salary" value={profile.currentSalary} />}
              {profile.targetSalary && <PrefChip label="Target salary" value={profile.targetSalary} />}
            </div>
          )}
          {profile.careerMotivation && <PrefChip label="Looking for" value={profile.careerMotivation} />}
          {(profile.priorities || []).length > 0 && (
            <div>
              <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Priorities</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {profile.priorities.map((p) => (
                  <span key={p} style={{ padding: "5px 11px", borderRadius: "var(--scout-radius)", background: "var(--scout-inset)", border: "1px solid rgba(0,0,0,0.08)", fontSize: 14, color: "#1C3A2F", fontFamily: "var(--font-ui)" }}>{p}</span>
                ))}
              </div>
            </div>
          )}
          {(profile.targetMarket || profile.relocationOpenness || profile.workAuthorization || profile.securityClearance || profile.searchDuration) && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {profile.targetMarket && <PrefChip label="Target market" value={profile.targetMarket} />}
              {profile.relocationOpenness && <PrefChip label="Relocation" value={profile.relocationOpenness} />}
              {profile.workAuthorization && <PrefChip label="Work auth" value={profile.workAuthorization} />}
              {profile.securityClearance && <PrefChip label="Clearance" value={profile.securityClearance} />}
              {profile.searchDuration && <PrefChip label="Search duration" value={profile.searchDuration} />}
            </div>
          )}
          {profile.positioningStatement && (
            <div>
              <p style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Positioning</p>
              <p style={{ fontSize: 14, color: "#1C3A2F", fontFamily: "var(--font-ui)", margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{profile.positioningStatement}</p>
            </div>
          )}
        </div>
      )}
    </ScoutBox>
  );
}
