"use client";

import { CSS } from "@dnd-kit/utilities";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import {
  DEFAULT_SECTION_ORDER,
  type ParsedCertificationEntry,
  type ParsedEducationEntry,
  type ParsedResumeData,
  type ParsedSkillGroup,
  type ParsedWorkEntry,
  type ResumeSectionId,
} from "@/lib/resume-parse";
import { border, color, surface, fontSans } from "@/lib/typography";

/** Resume editor tokens — Citebound-aligned (replaces JobRight green) */
export const JR = {
  green: color.forest,
  greenDark: "#2D6B4A",
  greenLight: "rgba(26,58,47,0.08)",
  gold: color.gold,
  bg: surface.page,
  panel: surface.card,
  border: "rgba(17,17,17,0.14)",
  text: color.ink,
  muted: color.muted,
  urgent: "#C4574A",
  urgentBg: "rgba(196,87,74,0.08)",
  critical: "#C4A86A",
  criticalBg: "rgba(196,168,106,0.12)",
  optional: color.muted,
  optionalBg: surface.inset,
};

const SECTION_LABELS: Record<ResumeSectionId, string> = {
  summary: "Professional Summary",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  certifications: "Certifications",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: border.line,
  borderRadius: 0,
  fontSize: 13,
  fontFamily: fontSans,
  color: JR.text,
  background: JR.panel,
  boxSizing: "border-box",
  outline: "none",
};

function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.85 : 1,
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
      }}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        style={{
          background: "none",
          border: "none",
          cursor: "grab",
          padding: 4,
          color: JR.muted,
          flexShrink: 0,
          marginTop: 2,
        }}
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function SortableSectionTab({
  id,
  label,
  active,
  onClick,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.85 : 1,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "10px 12px",
        borderRadius: 0,
        background: active ? JR.greenLight : "transparent",
        border: active ? `1px solid ${JR.green}` : "1px solid transparent",
        cursor: "pointer",
      }}
      onClick={onClick}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "none", border: "none", cursor: "grab", padding: 0, color: JR.muted, display: "flex" }}
      >
        <GripVertical size={14} />
      </button>
      <span style={{ fontSize: 14, fontWeight: active ? 600 : 500, color: JR.text, flex: 1 }}>{label}</span>
    </div>
  );
}

export interface ReportIssue {
  priority: "Urgent" | "Critical" | "Optional";
  title: string;
  detail: string;
}

export function ReportPanel({
  completenessPct,
  missing,
  score,
  headline,
  strengths,
  issues,
  loading,
  error,
  onRefresh,
  onViewFullReport,
}: {
  completenessPct: number;
  missing: string[];
  score?: number;
  headline?: string;
  strengths?: string[];
  issues: ReportIssue[];
  loading: boolean;
  error?: string;
  onRefresh: () => void;
  onViewFullReport: () => void;
}) {
  const scoreColor = (score ?? completenessPct) >= 70 ? JR.green : (score ?? completenessPct) >= 40 ? JR.critical : JR.urgent;

  return (
    <div style={{ padding: "24px 20px", height: "100%", overflowY: "auto", background: JR.panel }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto 12px" }}>
          <svg width={96} height={96} viewBox="0 0 96 96">
            <circle cx={48} cy={48} r={40} fill="none" stroke="#EEF2F6" strokeWidth={8} />
            <circle
              cx={48}
              cy={48}
              r={40}
              fill="none"
              stroke={scoreColor}
              strokeWidth={8}
              strokeDasharray={2 * Math.PI * 40}
              strokeDashoffset={2 * Math.PI * 40 * (1 - (score ?? completenessPct) / 100)}
              strokeLinecap="round"
              transform="rotate(-90 48 48)"
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: JR.text }}>{score ?? completenessPct}%</span>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: JR.muted }}>
          Resume Quality Score
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: JR.muted }}>Profile completeness {completenessPct}%</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Quality rating", value: score != null ? `${score}/100` : "—" },
          { label: "Sections", value: `${5 - missing.length}/5` },
        ].map((stat) => (
          <div key={stat.label} style={{ background: JR.bg, borderRadius: 0, padding: "10px 12px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: JR.text }}>{stat.value}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: JR.muted }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {headline && (
        <p style={{ fontSize: 14, color: JR.text, lineHeight: 1.5, margin: "0 0 14px", padding: "12px 14px", background: JR.bg, borderRadius: 0 }}>
          {headline}
        </p>
      )}

      {(strengths || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: JR.muted, textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 8px" }}>Strengths</p>
          {(strengths || []).slice(0, 4).map((s) => (
            <p key={s} style={{ margin: "0 0 4px", fontSize: 13, color: JR.greenDark }}>✓ {s}</p>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, fontWeight: 700, color: JR.muted, textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 8px" }}>Report</p>

      {loading ? (
        <p style={{ fontSize: 13, color: JR.muted }}>Analyzing resume…</p>
      ) : error ? (
        <p style={{ fontSize: 13, color: JR.muted }}>{error}</p>
      ) : issues.length === 0 ? (
        <p style={{ fontSize: 13, color: JR.muted }}>No issues found — looking good!</p>
      ) : (
        issues.slice(0, 6).map((issue, i) => {
          const palette =
            issue.priority === "Urgent"
              ? { bg: JR.urgentBg, color: JR.urgent }
              : issue.priority === "Critical"
                ? { bg: JR.criticalBg, color: JR.critical }
                : { bg: JR.optionalBg, color: JR.optional };
          return (
            <div key={i} style={{ marginBottom: 8, padding: "10px 12px", background: palette.bg, borderRadius: 0, border: `1px solid ${JR.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: palette.color, textTransform: "uppercase" }}>{issue.priority}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: JR.text }}>{issue.title}</p>
              {issue.detail && <p style={{ margin: "4px 0 0", fontSize: 12, color: JR.muted, lineHeight: 1.45 }}>{issue.detail}</p>}
            </div>
          );
        })
      )}

      <button
        type="button"
        onClick={onViewFullReport}
        disabled={loading}
        style={{
          width: "100%",
          marginTop: 8,
          padding: "10px 14px",
          background: JR.panel,
          color: JR.greenDark,
          border: `1px solid ${JR.green}`,
          borderRadius: 0,
          fontSize: 13,
          fontWeight: 600,
          cursor: loading ? "wait" : "pointer",
        }}
      >
        View Full Report
      </button>

      <button
        type="button"
        onClick={onRefresh}
        style={{
          width: "100%",
          marginTop: 12,
          padding: "10px 14px",
          background: JR.green,
          color: "#FFFFFF",
          border: "none",
          borderRadius: 0,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Re-analyze
      </button>
    </div>
  );
}

export function SectionsPanel({
  data,
  activeSection,
  onActiveSection,
  onChange,
}: {
  data: ParsedResumeData;
  activeSection: ResumeSectionId;
  onActiveSection: (s: ResumeSectionId) => void;
  onChange: (next: ParsedResumeData) => void;
}) {
  const sectionOrder = data.sectionOrder?.length ? data.sectionOrder : DEFAULT_SECTION_ORDER;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function patch(partial: Partial<ParsedResumeData>) {
    onChange({ ...data, ...partial });
  }

  function onSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionOrder.indexOf(active.id as ResumeSectionId);
    const newIndex = sectionOrder.indexOf(over.id as ResumeSectionId);
    if (oldIndex < 0 || newIndex < 0) return;
    patch({ sectionOrder: arrayMove(sectionOrder, oldIndex, newIndex) });
  }

  function onWorkDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = data.workExperience.map((w) => w.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    patch({ workExperience: arrayMove(data.workExperience, oldIndex, newIndex) });
  }

  function onEducationDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = data.education.map((e) => e.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    patch({ education: arrayMove(data.education, oldIndex, newIndex) });
  }

  const skillGroups = data.skillGroups.length
    ? data.skillGroups
    : data.skills.length
      ? [{ id: "skills_0", label: "Skills", skills: data.skills }]
      : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: JR.panel, borderLeft: `1px solid ${JR.border}` }}>
      <div style={{ padding: "16px 16px 8px", borderBottom: `1px solid ${JR.border}` }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: JR.muted }}>Sections</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: JR.muted }}>Drag to reorder · click to edit</p>
      </div>

      <div style={{ padding: 8, borderBottom: `1px solid ${JR.border}` }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
          <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
            {sectionOrder.map((sectionId) => (
              <SortableSectionTab
                key={sectionId}
                id={sectionId}
                label={SECTION_LABELS[sectionId]}
                active={activeSection === sectionId}
                onClick={() => onActiveSection(sectionId)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {activeSection === "summary" && (
          <textarea
            rows={6}
            style={{ ...inputStyle, resize: "vertical" }}
            value={data.summary || ""}
            placeholder="Write a concise professional summary…"
            onChange={(e) => patch({ summary: e.target.value })}
          />
        )}

        {activeSection === "skills" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {skillGroups.map((g) => (
              <div key={g.id} style={{ border: `1px solid ${JR.border}`, borderRadius: 0, padding: 10 }}>
                <input
                  style={inputStyle}
                  value={g.label}
                  placeholder="Group label"
                  onChange={(e) =>
                    patch({
                      skillGroups: skillGroups.map((row) => (row.id === g.id ? { ...row, label: e.target.value } : row)),
                      skills: [],
                    })
                  }
                />
                <input
                  style={{ ...inputStyle, marginTop: 8 }}
                  value={g.skills.join(", ")}
                  placeholder="Skills (comma-separated)"
                  onChange={(e) =>
                    patch({
                      skillGroups: skillGroups.map((row) =>
                        row.id === g.id
                          ? { ...row, skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }
                          : row,
                      ),
                      skills: [],
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() => patch({ skillGroups: skillGroups.filter((row) => row.id !== g.id) })}
                  style={{ background: "none", border: "none", color: JR.urgent, fontSize: 12, cursor: "pointer", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}
                >
                  <Trash2 size={12} /> Remove group
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patch({
                  skillGroups: [...skillGroups, { id: `sg_${Date.now()}`, label: "Skills", skills: [] }],
                  skills: [],
                })
              }
              style={{ ...inputStyle, borderStyle: "dashed", background: JR.bg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <Plus size={14} /> Add skill group
            </button>
          </div>
        )}

        {activeSection === "experience" && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onWorkDragEnd}>
            <SortableContext items={data.workExperience.map((w) => w.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.workExperience.map((w) => (
                  <WorkEditor key={w.id} entry={w} onChange={(next) => patch({ workExperience: data.workExperience.map((row) => (row.id === w.id ? next : row)) })} onRemove={() => patch({ workExperience: data.workExperience.filter((row) => row.id !== w.id) })} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {activeSection === "education" && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEducationDragEnd}>
            <SortableContext items={data.education.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.education.map((e) => (
                  <EducationEditor key={e.id} entry={e} onChange={(next) => patch({ education: data.education.map((row) => (row.id === e.id ? next : row)) })} onRemove={() => patch({ education: data.education.filter((row) => row.id !== e.id) })} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {activeSection === "certifications" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.certifications.map((c) => (
              <CertEditor key={c.id} entry={c} onChange={(next) => patch({ certifications: data.certifications.map((row) => (row.id === c.id ? next : row)) })} onRemove={() => patch({ certifications: data.certifications.filter((row) => row.id !== c.id) })} />
            ))}
          </div>
        )}

        {activeSection === "experience" && (
          <button
            type="button"
            onClick={() => patch({ workExperience: [...data.workExperience, { id: `exp_${Date.now()}`, company: "", title: "", bullets: [] }] })}
            style={{ ...inputStyle, marginTop: 12, borderStyle: "dashed", background: JR.bg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Plus size={14} /> Add experience
          </button>
        )}

        {activeSection === "education" && (
          <button
            type="button"
            onClick={() => patch({ education: [...data.education, { id: `edu_${Date.now()}`, school: "", degree: "" }] })}
            style={{ ...inputStyle, marginTop: 12, borderStyle: "dashed", background: JR.bg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Plus size={14} /> Add education
          </button>
        )}

        {activeSection === "certifications" && (
          <button
            type="button"
            onClick={() => patch({ certifications: [...data.certifications, { id: `cert_${Date.now()}`, name: "" }] })}
            style={{ ...inputStyle, marginTop: 12, borderStyle: "dashed", background: JR.bg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Plus size={14} /> Add certification
          </button>
        )}
      </div>
    </div>
  );
}

function WorkEditor({ entry, onChange, onRemove }: { entry: ParsedWorkEntry; onChange: (e: ParsedWorkEntry) => void; onRemove: () => void }) {
  return (
    <SortableRow id={entry.id}>
      <div style={{ border: `1px solid ${JR.border}`, borderRadius: 0, padding: 10, background: JR.bg }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input style={inputStyle} value={entry.title} placeholder="Title" onChange={(e) => onChange({ ...entry, title: e.target.value })} />
          <input style={inputStyle} value={entry.company} placeholder="Company" onChange={(e) => onChange({ ...entry, company: e.target.value })} />
          <input style={inputStyle} value={entry.from || ""} placeholder="From (YYYY-MM)" onChange={(e) => onChange({ ...entry, from: e.target.value })} />
          <input style={inputStyle} value={entry.to || ""} placeholder="To (Present)" onChange={(e) => onChange({ ...entry, to: e.target.value })} />
        </div>
        <textarea
          rows={4}
          style={{ ...inputStyle, marginTop: 8, resize: "vertical" }}
          value={entry.bullets.join("\n")}
          placeholder="One bullet per line"
          onChange={(e) => onChange({ ...entry, bullets: e.target.value.split("\n").filter(Boolean) })}
        />
        <button type="button" onClick={onRemove} style={{ background: "none", border: "none", color: JR.urgent, fontSize: 12, cursor: "pointer", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
          <Trash2 size={12} /> Remove
        </button>
      </div>
    </SortableRow>
  );
}

function EducationEditor({ entry, onChange, onRemove }: { entry: ParsedEducationEntry; onChange: (e: ParsedEducationEntry) => void; onRemove: () => void }) {
  return (
    <SortableRow id={entry.id}>
      <div style={{ border: `1px solid ${JR.border}`, borderRadius: 0, padding: 10, background: JR.bg }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input style={inputStyle} value={entry.school} placeholder="School" onChange={(e) => onChange({ ...entry, school: e.target.value })} />
          <input style={inputStyle} value={entry.degree} placeholder="Degree" onChange={(e) => onChange({ ...entry, degree: e.target.value })} />
          <input style={inputStyle} value={entry.field || ""} placeholder="Field" onChange={(e) => onChange({ ...entry, field: e.target.value })} />
          <input style={inputStyle} value={entry.from || ""} placeholder="From" onChange={(e) => onChange({ ...entry, from: e.target.value })} />
          <input style={inputStyle} value={entry.to || ""} placeholder="To" onChange={(e) => onChange({ ...entry, to: e.target.value })} />
        </div>
        <button type="button" onClick={onRemove} style={{ background: "none", border: "none", color: JR.urgent, fontSize: 12, cursor: "pointer", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
          <Trash2 size={12} /> Remove
        </button>
      </div>
    </SortableRow>
  );
}

function CertEditor({ entry, onChange, onRemove }: { entry: ParsedCertificationEntry; onChange: (e: ParsedCertificationEntry) => void; onRemove: () => void }) {
  return (
    <div style={{ border: `1px solid ${JR.border}`, borderRadius: 0, padding: 10, background: JR.bg }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input style={inputStyle} value={entry.name} placeholder="Certification" onChange={(e) => onChange({ ...entry, name: e.target.value })} />
        <input style={inputStyle} value={entry.issuer || ""} placeholder="Issuer" onChange={(e) => onChange({ ...entry, issuer: e.target.value })} />
        <input style={inputStyle} value={entry.date || ""} placeholder="Date" onChange={(e) => onChange({ ...entry, date: e.target.value })} />
      </div>
      <button type="button" onClick={onRemove} style={{ background: "none", border: "none", color: JR.urgent, fontSize: 12, cursor: "pointer", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
        <Trash2 size={12} /> Remove
      </button>
    </div>
  );
}

export function ResumePreview({ data }: { data: ParsedResumeData }) {
  const sectionOrder = data.sectionOrder?.length ? data.sectionOrder : DEFAULT_SECTION_ORDER;
  const skillGroups = data.skillGroups.length
    ? data.skillGroups
    : data.skills.length
      ? [{ id: "skills_0", label: "Skills", skills: data.skills }]
      : [];

  function formatDateRange(from?: string | null, to?: string | null) {
    if (!from && !to) return null;
    const fmt = (d: string) => {
      const [y, m] = d.split("-");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return m ? `${months[parseInt(m, 10) - 1]} ${y}` : y;
    };
    const start = from ? fmt(from) : "";
    const end = to === "Present" ? "Present" : to ? fmt(to) : "Present";
    return `${start}${start && end ? " – " : ""}${end}`;
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: JR.text,
    marginBottom: 6,
    borderBottom: `1px solid ${JR.text}`,
    paddingBottom: 3,
  };

  return (
    <div
      style={{
        background: JR.panel,
        width: "100%",
        maxWidth: 720,
        padding: "52px 60px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.08)",
        borderRadius: 0,
        fontSize: 11,
        lineHeight: 1.55,
        color: JR.text,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 24, paddingBottom: 20, borderBottom: `1.5px solid ${JR.text}` }}>
        {data.name && <p style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>{data.name}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", marginTop: 10, fontSize: 10 }}>
          {data.email && <span>{data.email}</span>}
          {data.phone && <span>{data.phone}</span>}
          {data.location && <span>{data.location}</span>}
          {data.linkedinUrl && <span>{data.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}</span>}
          {data.website && <span>{data.website.replace(/^https?:\/\/(www\.)?/, "")}</span>}
        </div>
      </div>

      {sectionOrder.map((sectionId) => {
        if (sectionId === "summary" && data.summary) {
          return (
            <div key={sectionId} style={{ marginBottom: 18 }}>
              <p style={sectionTitle}>Professional Summary</p>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{data.summary}</p>
            </div>
          );
        }
        if (sectionId === "skills" && skillGroups.length > 0) {
          return (
            <div key={sectionId} style={{ marginBottom: 18 }}>
              <p style={sectionTitle}>Areas of Emphasis</p>
              {skillGroups.map((g) => (
                <div key={g.id} style={{ marginBottom: 8 }}>
                  <p style={{ margin: "0 0 3px", fontWeight: 600 }}>{g.label}</p>
                  <p style={{ margin: 0 }}>{g.skills.join(" · ")}</p>
                </div>
              ))}
            </div>
          );
        }
        if (sectionId === "experience" && data.workExperience.length > 0) {
          return (
            <div key={sectionId} style={{ marginBottom: 18 }}>
              <p style={sectionTitle}>Experience</p>
              {data.workExperience.map((w) => (
                <div key={w.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{w.title}</p>
                    {formatDateRange(w.from, w.to) && <span style={{ fontSize: 10, color: JR.muted }}>{formatDateRange(w.from, w.to)}</span>}
                  </div>
                  <p style={{ margin: "2px 0 4px", fontStyle: "italic" }}>{w.company}</p>
                  {w.bullets.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {w.bullets.map((b, i) => (
                        <li key={i} style={{ marginBottom: 3 }}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          );
        }
        if (sectionId === "education" && data.education.length > 0) {
          return (
            <div key={sectionId} style={{ marginBottom: 18 }}>
              <p style={sectionTitle}>Education</p>
              {data.education.map((e) => (
                <div key={e.id} style={{ marginBottom: 8 }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{[e.degree, e.field].filter(Boolean).join(", ")}</p>
                  <p style={{ margin: "2px 0 0" }}>{e.school}{formatDateRange(e.from, e.to) ? ` · ${formatDateRange(e.from, e.to)}` : ""}</p>
                </div>
              ))}
            </div>
          );
        }
        if (sectionId === "certifications" && data.certifications.length > 0) {
          return (
            <div key={sectionId} style={{ marginBottom: 18 }}>
              <p style={sectionTitle}>Certifications</p>
              {data.certifications.map((c) => (
                <p key={c.id} style={{ margin: "0 0 4px" }}>
                  {c.name}{c.issuer ? ` — ${c.issuer}` : ""}{c.date ? ` (${c.date})` : ""}
                </p>
              ))}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
