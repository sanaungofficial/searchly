"use client";

import { Plus, X, GripVertical } from "lucide-react";
import {
  DEFAULT_SECTION_ORDER,
  type ParsedResumeData,
  type ResumeSectionId,
} from "@/lib/resume-parse";
import { JR } from "./profile-resume-editor-panels";

const SECTION_LABELS: Record<ResumeSectionId, string> = {
  summary: "Professional Summary",
  skills: "Areas of Emphasis",
  experience: "Professional Experience",
  education: "Education & Training",
  certifications: "Certifications",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  outline: "none",
  fontFamily: "inherit",
  color: JR.text,
  padding: 0,
};

function SectionActions({ onFix }: { onFix: () => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
      <button
        type="button"
        style={{
          padding: "4px 10px",
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 6,
          border: `1px solid ${JR.border}`,
          background: JR.panel,
          color: JR.muted,
          cursor: "pointer",
        }}
      >
        Impact
      </button>
      <button
        type="button"
        onClick={onFix}
        style={{
          padding: "4px 12px",
          fontSize: 11,
          fontWeight: 700,
          borderRadius: 6,
          border: "none",
          background: JR.green,
          color: "#FFF",
          cursor: "pointer",
        }}
      >
        Fix
      </button>
    </div>
  );
}

function SectionHeader({ title, onFix }: { title: string; onFix: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
      <p
        style={{
          margin: 0,
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: JR.text,
          borderBottom: `1px solid ${JR.text}`,
          paddingBottom: 3,
          flex: 1,
        }}
      >
        {title}
      </p>
      <SectionActions onFix={onFix} />
    </div>
  );
}

function SkillPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        background: "#F3F4F6",
        borderRadius: 6,
        fontSize: 10,
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      <GripVertical size={10} color={JR.muted} />
      {label}
      <button type="button" onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: JR.muted }}>
        <X size={10} />
      </button>
    </span>
  );
}

export function JobrightResumeDocument({
  data,
  onChange,
  onFixSection,
  score,
  grade,
  gradeLabel,
  onViewReport,
}: {
  data: ParsedResumeData;
  onChange: (next: ParsedResumeData) => void;
  onFixSection: (sectionId: ResumeSectionId, entryLabel?: string) => void;
  score: number;
  grade: string;
  gradeLabel: string;
  onViewReport: () => void;
}) {
  const sectionOrder = data.sectionOrder?.length ? data.sectionOrder : DEFAULT_SECTION_ORDER;
  const skillGroups = data.skillGroups.length
    ? data.skillGroups
    : data.skills.length
      ? [{ id: "skills_0", label: "Skills", skills: data.skills }]
      : [];

  function patch(partial: Partial<ParsedResumeData>) {
    onChange({ ...data, ...partial });
  }

  function formatDateRange(from?: string | null, to?: string | null) {
    if (!from && !to) return "";
    const fmt = (d: string) => {
      const [y, m] = d.split("-");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return m ? `${months[parseInt(m, 10) - 1]} ${y}` : y;
    };
    const start = from ? fmt(from) : "";
    const end = to === "Present" ? "Present" : to ? fmt(to) : "Present";
    return `${start}${start && end ? " – " : ""}${end}`;
  }

  return (
    <div
      style={{
        background: JR.panel,
        width: "100%",
        maxWidth: 820,
        padding: "32px 48px 48px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.08)",
        borderRadius: 4,
        fontSize: 11,
        lineHeight: 1.55,
        color: JR.text,
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {["AI Analysis", "Formatting", "Add Section"].map((label) => (
          <button
            key={label}
            type="button"
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              border: `1px solid ${JR.border}`,
              background: JR.panel,
              cursor: "pointer",
              color: JR.text,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FEF3C7", border: "2px solid #D4AF37", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#92400E" }}>
          {grade}
        </div>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#92400E", background: "#FEF3C7", padding: "2px 8px", borderRadius: 4 }}>{gradeLabel}</span>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: JR.muted }}>Score: {score}/100</p>
        </div>
        <button
          type="button"
          onClick={onViewReport}
          style={{ marginLeft: "auto", background: "none", border: "none", color: JR.greenDark, fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
        >
          View full report
        </button>
      </div>

      <div style={{ textAlign: "center", marginBottom: 24, paddingBottom: 16, borderBottom: `1.5px solid ${JR.text}` }}>
        <input
          style={{ ...fieldStyle, fontSize: 22, fontWeight: 700, letterSpacing: 2, textAlign: "center", textTransform: "uppercase" }}
          value={data.name || ""}
          placeholder="YOUR NAME"
          onChange={(e) => patch({ name: e.target.value })}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 16px", marginTop: 12, fontSize: 10 }}>
          {(
            [
              { key: "email", placeholder: "Email" },
              { key: "phone", placeholder: "Phone" },
              { key: "location", placeholder: "Location" },
              { key: "linkedinUrl", placeholder: "LinkedIn URL" },
              { key: "website", placeholder: "Website" },
            ] as const
          ).map((f) => (
            <input
              key={f.key}
              style={{ ...fieldStyle, fontSize: 10, textAlign: "center" }}
              placeholder={f.placeholder}
              value={data[f.key] || ""}
              onChange={(e) => patch({ [f.key]: e.target.value })}
            />
          ))}
        </div>
      </div>

      {sectionOrder.map((sectionId) => {
        if (sectionId === "summary") {
          return (
            <div key={sectionId} style={{ marginBottom: 20 }}>
              <SectionHeader title={SECTION_LABELS.summary} onFix={() => onFixSection("summary")} />
              <textarea
                rows={4}
                style={{ ...fieldStyle, width: "100%", resize: "vertical", fontSize: 11, lineHeight: 1.55 }}
                value={data.summary || ""}
                placeholder="Write your professional summary…"
                onChange={(e) => patch({ summary: e.target.value })}
              />
            </div>
          );
        }

        if (sectionId === "skills") {
          return (
            <div key={sectionId} style={{ marginBottom: 20 }}>
              <SectionHeader title={SECTION_LABELS.skills} onFix={() => onFixSection("skills")} />
              {skillGroups.map((g) => (
                <div key={g.id} style={{ marginBottom: 10 }}>
                  <input
                    style={{ ...fieldStyle, fontWeight: 600, marginBottom: 6, fontSize: 11 }}
                    value={g.label}
                    onChange={(e) =>
                      patch({
                        skillGroups: skillGroups.map((row) => (row.id === g.id ? { ...row, label: e.target.value } : row)),
                        skills: [],
                      })
                    }
                  />
                  <div style={{ display: "flex", flexWrap: "wrap" }}>
                    {g.skills.map((skill, si) => (
                      <SkillPill
                        key={`${g.id}-${si}`}
                        label={skill}
                        onRemove={() =>
                          patch({
                            skillGroups: skillGroups.map((row) =>
                              row.id === g.id ? { ...row, skills: row.skills.filter((_, i) => i !== si) } : row,
                            ),
                            skills: [],
                          })
                        }
                      />
                    ))}
                    <input
                      style={{ ...fieldStyle, width: 90, fontSize: 10, color: JR.muted }}
                      placeholder="Add skill…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (!val) return;
                          patch({
                            skillGroups: skillGroups.map((row) =>
                              row.id === g.id ? { ...row, skills: [...row.skills, val] } : row,
                            ),
                            skills: [],
                          });
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          );
        }

        if (sectionId === "experience") {
          return (
            <div key={sectionId} style={{ marginBottom: 20 }}>
              <SectionHeader title={SECTION_LABELS.experience} onFix={() => onFixSection("experience")} />
              {data.workExperience.map((w) => (
                <div key={w.id} style={{ marginBottom: 16, padding: "12px 0", borderBottom: `1px solid ${JR.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <input style={{ ...fieldStyle, fontWeight: 700, fontSize: 11 }} value={w.title} placeholder="Job title" onChange={(e) => patch({ workExperience: data.workExperience.map((row) => (row.id === w.id ? { ...row, title: e.target.value } : row)) })} />
                      <input style={{ ...fieldStyle, fontStyle: "italic", marginTop: 4 }} value={w.company} placeholder="Company" onChange={(e) => patch({ workExperience: data.workExperience.map((row) => (row.id === w.id ? { ...row, company: e.target.value } : row)) })} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <SectionActions onFix={() => onFixSection("experience", w.company || w.title)} />
                      <span style={{ fontSize: 10, color: JR.muted }}>{formatDateRange(w.from, w.to)}</span>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    style={{ ...fieldStyle, width: "100%", resize: "vertical", fontSize: 11 }}
                    value={w.bullets.join("\n")}
                    placeholder="One bullet per line"
                    onChange={(e) => patch({ workExperience: data.workExperience.map((row) => (row.id === w.id ? { ...row, bullets: e.target.value.split("\n").filter(Boolean) } : row)) })}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => patch({ workExperience: [...data.workExperience, { id: `exp_${Date.now()}`, company: "", title: "", bullets: [] }] })}
                style={{ background: "none", border: `1px dashed ${JR.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", color: JR.muted, width: "100%" }}
              >
                <Plus size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Add experience
              </button>
            </div>
          );
        }

        if (sectionId === "education") {
          return (
            <div key={sectionId} style={{ marginBottom: 20 }}>
              <SectionHeader title={SECTION_LABELS.education} onFix={() => onFixSection("education")} />
              {data.education.map((e) => (
                <div key={e.id} style={{ marginBottom: 10 }}>
                  <input style={{ ...fieldStyle, fontWeight: 700 }} value={e.degree} placeholder="Degree" onChange={(ev) => patch({ education: data.education.map((row) => (row.id === e.id ? { ...row, degree: ev.target.value } : row)) })} />
                  <input style={{ ...fieldStyle, marginTop: 4 }} value={e.school} placeholder="School" onChange={(ev) => patch({ education: data.education.map((row) => (row.id === e.id ? { ...row, school: ev.target.value } : row)) })} />
                </div>
              ))}
            </div>
          );
        }

        if (sectionId === "certifications") {
          return (
            <div key={sectionId} style={{ marginBottom: 20 }}>
              <SectionHeader title={SECTION_LABELS.certifications} onFix={() => onFixSection("certifications")} />
              {data.certifications.map((c) => (
                <input
                  key={c.id}
                  style={{ ...fieldStyle, display: "block", marginBottom: 6 }}
                  value={c.name}
                  placeholder="Certification"
                  onChange={(ev) => patch({ certifications: data.certifications.map((row) => (row.id === c.id ? { ...row, name: ev.target.value } : row)) })}
                />
              ))}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

export function JobrightScorePill({
  score,
  grade,
  gradeLabel,
  onViewReport,
}: {
  score: number;
  grade: string;
  gradeLabel: string;
  onViewReport: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", background: JR.greenLight, borderRadius: 999, border: `1px solid ${JR.green}` }}>
      <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#FEF3C7", border: "1.5px solid #D4AF37", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#92400E" }}>
        {grade}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: JR.text }}>{score}/100</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#92400E" }}>{gradeLabel}</span>
      <button
        type="button"
        onClick={onViewReport}
        style={{ background: "none", border: "none", color: JR.greenDark, fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline", marginLeft: 4 }}
      >
        View full report
      </button>
    </div>
  );
}
