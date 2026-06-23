"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  AVAILABLE_ROLES,
  UPSKILL_CATEGORIES,
} from "./workspace-data";

interface AISuggestion {
  priority: "high" | "medium" | "low";
  category: string;
  title: string;
  detail: string;
  impact: string;
}
import { SparkleIcon } from "./workspace-icons";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EducationEntry {
  id: string;
  school: string;
  degree: string;
  field?: string | null;
  from?: string | null;
  to?: string | null;
}

interface WorkEntry {
  id: string;
  company: string;
  title: string;
  description?: string | null;
  from?: string | null;
  to?: string | null;
  bullets: string[];
}

interface ParsedData {
  name?: string | null;
  phone?: string | null;
  location?: string | null;
  website?: string | null;
  education: EducationEntry[];
  workExperience: WorkEntry[];
  skills: string[];
}

interface UserProfile {
  name: string;
  email: string | null;
  resumeUrl: string | null;
  linkedinUrl: string | null;
  headline: string | null;
  targetRoles: string[];
  parsedData: ParsedData | null;
  employmentStatus: string | null;
  currentSalary: string | null;
  targetSalary: string | null;
  careerMotivation: string | null;
  jobTimeline: string | null;
  priorities: string[];
}

interface ReadbackData {
  picture: string;
  strengths: string[];
  targetRoles: { role: string; fit: string }[];
  honestNote: string;
}

interface RoleAnalysis {
  fitScore: number;
  summary: string;
  requiredSkills: string[];
  gaps: { skill: string; why: string }[];
  nextSteps: string[];
  _cachedAt?: string;
}

interface SkillGoal {
  skill: string;
  role: string;
  addedAt: string;
}

interface CustomLearningItem {
  id: string;
  name: string;
  url?: string;
  platform?: string;
  duration?: string;
  status: "none" | "inprogress" | "completed";
  addedAt: string;
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateRange(from?: string | null, to?: string | null) {
  if (!from && !to) return null;
  const fmt = (d: string) => {
    const [y, m] = d.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return m ? `${months[parseInt(m, 10) - 1]} ${y}` : y;
  };
  const start = from ? fmt(from) : "";
  const end = to === "Present" ? "Present" : to ? fmt(to) : "Present";
  return `${start}${start && end ? " – " : ""}${end}`;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function profileCompleteness(p: UserProfile): number {
  let score = 0;
  if (p.name) score++;
  if (p.email) score++;
  if (p.parsedData?.phone) score++;
  if (p.parsedData?.location) score++;
  if (p.linkedinUrl) score++;
  if (p.resumeUrl) score += 2;
  if ((p.parsedData?.education || []).length > 0) score++;
  if ((p.parsedData?.workExperience || []).length > 0) score++;
  if ((p.parsedData?.skills || []).length > 0) score++;
  if (p.jobTimeline) score++;
  if (p.targetSalary) score++;
  if ((p.priorities || []).length > 0) score++;
  return Math.round((score / 13) * 100);
}

// ─── Shared small components ──────────────────────────────────────────────────

function SectionHeader({ title, onEdit }: { title: string; onEdit?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-[#1C3A2F]">{title}</h3>
      {onEdit && (
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-[#E8D5A3]/40 transition-colors" aria-label={`Edit ${title}`}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9.5 1.5L12.5 4.5L5 12H2V9L9.5 1.5Z" stroke="#52493F" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-[#A09890]">{message}</p>
      {sub && <p className="text-xs text-[#C0B8B0] mt-1">{sub}</p>}
    </div>
  );
}

function SkillChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E8D5A3]/50 text-xs font-medium text-[#52493F]">
      {label}
      {onRemove && <button onClick={onRemove} className="ml-0.5 text-[#A09890] hover:text-[#52493F]">x</button>}
    </span>
  );
}

// ─── Tab: Personal ────────────────────────────────────────────────────────────

function PersonalTab({ profile, onSave }: {
  profile: UserProfile;
  onSave: (patch: Omit<Partial<UserProfile>, "parsedData"> & { parsedData?: Partial<ParsedData> }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.parsedData?.phone || "");
  const [location, setLocation] = useState(profile.parsedData?.location || "");
  const [website, setWebsite] = useState(profile.parsedData?.website || "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ name, linkedinUrl: linkedinUrl || null, parsedData: { phone: phone || null, location: location || null, website: website || null } as Partial<ParsedData> });
    setSaving(false);
    setEditing(false);
  };

  const fields = [
    { label: "Email", value: profile.email || "—" },
    { label: "Phone", value: phone || "—" },
    { label: "Location", value: location || "—" },
    { label: "LinkedIn", value: linkedinUrl || "—", href: linkedinUrl || undefined },
    { label: "Website", value: website || "—", href: website || undefined },
  ];

  return (
    <div>
      <SectionHeader title="Personal Information" onEdit={() => setEditing(!editing)} />
      {editing ? (
        <div className="space-y-3">
          {([["Full Name", name, setName], ["Phone", phone, setPhone], ["Location", location, setLocation], ["LinkedIn URL", linkedinUrl, setLinkedinUrl], ["Website", website, setWebsite]] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
            <div key={label}>
              <label className="block text-xs text-[#A09890] mb-1">{label}</label>
              <input value={val} onChange={(e) => setter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-lg hover:bg-[#1C3A2F]/90 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F7F5F2] rounded-lg">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E5DDD0]">
            <div className="w-12 h-12 rounded-full bg-[#1C3A2F] flex items-center justify-center text-[#E8D5A3] text-base font-semibold shrink-0">
              {initials(profile.name)}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1C3A2F]">{profile.name}</p>
              {profile.headline && <p className="text-xs text-[#A09890]">{profile.headline}</p>}
            </div>
          </div>
          {fields.map(({ label, value, href }) => (
            <div key={label} className="flex items-start gap-3">
              <span className="text-xs text-[#A09890] w-20 shrink-0 pt-0.5">{label}</span>
              {href && value !== "—" ? (
                <a href={href.startsWith("http") ? href : `https://${href}`} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-[#1C3A2F] underline underline-offset-2 break-all">{value}</a>
              ) : (
                <span className={`text-sm break-all ${value === "—" ? "text-[#C0B8B0]" : "text-[#1C3A2F]"}`}>{value}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Education ───────────────────────────────────────────────────────────

function EducationTab({ entries, onSave }: { entries: EducationEntry[]; onSave: (entries: EducationEntry[]) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState<EducationEntry[]>(entries);
  const [saving, setSaving] = useState(false);

  const addEntry = () => setList((p) => [...p, { id: `edu_${Date.now()}`, school: "", degree: "", field: "", from: "", to: "" }]);
  const removeEntry = (id: string) => setList((p) => p.filter((e) => e.id !== id));
  const updateEntry = (id: string, key: keyof EducationEntry, value: string) =>
    setList((p) => p.map((e) => e.id === id ? { ...e, [key]: value } : e));
  const handleSave = async () => { setSaving(true); await onSave(list); setSaving(false); setEditing(false); };

  if (editing) return (
    <div>
      <SectionHeader title="Education" />
      <div className="space-y-4">
        {list.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-[#E5DDD0] p-3 space-y-2 relative">
            <button onClick={() => removeEntry(entry.id)} className="absolute top-2 right-2 text-[#C0B8B0] hover:text-[#52493F] text-base leading-none">x</button>
            <div><label className="block text-xs text-[#A09890] mb-1">School</label>
              <input value={entry.school} onChange={(e) => updateEntry(entry.id, "school", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs text-[#A09890] mb-1">Degree</label>
                <input value={entry.degree} onChange={(e) => updateEntry(entry.id, "degree", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
              <div><label className="block text-xs text-[#A09890] mb-1">Field</label>
                <input value={entry.field || ""} onChange={(e) => updateEntry(entry.id, "field", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs text-[#A09890] mb-1">From (YYYY-MM)</label>
                <input value={entry.from || ""} onChange={(e) => updateEntry(entry.id, "from", e.target.value)} placeholder="2018-09" className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
              <div><label className="block text-xs text-[#A09890] mb-1">To</label>
                <input value={entry.to || ""} onChange={(e) => updateEntry(entry.id, "to", e.target.value)} placeholder="2022-05" className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
            </div>
          </div>
        ))}
        <button onClick={addEntry} className="w-full py-2 text-xs text-[#1C3A2F] border border-dashed border-[#C0B8B0] rounded-lg hover:border-[#1C3A2F]/40 transition-colors">+ Add education</button>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-lg hover:bg-[#1C3A2F]/90 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          <button onClick={() => { setList(entries); setEditing(false); }} className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F7F5F2] rounded-lg">Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeader title="Education" onEdit={() => setEditing(true)} />
      {entries.length === 0 ? (
        <EmptyState message="No education added yet" sub="Upload your resume and we'll fill this in automatically." />
      ) : (
        <div className="space-y-4">
          {entries.map((entry, i) => (
            <div key={entry.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-[#E8D5A3] mt-1 shrink-0" />
                {i < entries.length - 1 && <div className="w-px flex-1 bg-[#E5DDD0] mt-1" />}
              </div>
              <div className="pb-4">
                <p className="text-sm font-semibold text-[#1C3A2F]">{entry.school}</p>
                <p className="text-xs text-[#52493F] mt-0.5">{entry.degree}{entry.field ? `, ${entry.field}` : ""}</p>
                {formatDateRange(entry.from, entry.to) && <p className="text-xs text-[#A09890] mt-0.5">{formatDateRange(entry.from, entry.to)}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Work Experience ─────────────────────────────────────────────────────

function ExperienceTab({ entries, onSave }: { entries: WorkEntry[]; onSave: (entries: WorkEntry[]) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState<WorkEntry[]>(entries);
  const [saving, setSaving] = useState(false);

  const addEntry = () => setList((p) => [...p, { id: `exp_${Date.now()}`, company: "", title: "", description: "", from: "", to: "", bullets: [] }]);
  const removeEntry = (id: string) => setList((p) => p.filter((e) => e.id !== id));
  const updateEntry = (id: string, key: keyof WorkEntry, value: string) =>
    setList((p) => p.map((e) => e.id === id ? { ...e, [key]: value } : e));
  const updateBullets = (id: string, value: string) =>
    setList((p) => p.map((e) => e.id === id ? { ...e, bullets: value.split("\n").filter(Boolean) } : e));
  const handleSave = async () => { setSaving(true); await onSave(list); setSaving(false); setEditing(false); };

  if (editing) return (
    <div>
      <SectionHeader title="Work Experience" />
      <div className="space-y-4">
        {list.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-[#E5DDD0] p-3 space-y-2 relative">
            <button onClick={() => removeEntry(entry.id)} className="absolute top-2 right-2 text-[#C0B8B0] hover:text-[#52493F] text-base leading-none">x</button>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs text-[#A09890] mb-1">Company</label>
                <input value={entry.company} onChange={(e) => updateEntry(entry.id, "company", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
              <div><label className="block text-xs text-[#A09890] mb-1">Title</label>
                <input value={entry.title} onChange={(e) => updateEntry(entry.id, "title", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs text-[#A09890] mb-1">From (YYYY-MM)</label>
                <input value={entry.from || ""} onChange={(e) => updateEntry(entry.id, "from", e.target.value)} placeholder="2020-01" className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
              <div><label className="block text-xs text-[#A09890] mb-1">To (YYYY-MM or Present)</label>
                <input value={entry.to || ""} onChange={(e) => updateEntry(entry.id, "to", e.target.value)} placeholder="Present" className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" /></div>
            </div>
            <div><label className="block text-xs text-[#A09890] mb-1">Bullet points (one per line)</label>
              <textarea rows={4} value={entry.bullets.join("\n")} onChange={(e) => updateBullets(entry.id, e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F] resize-none" /></div>
          </div>
        ))}
        <button onClick={addEntry} className="w-full py-2 text-xs text-[#1C3A2F] border border-dashed border-[#C0B8B0] rounded-lg hover:border-[#1C3A2F]/40 transition-colors">+ Add experience</button>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-lg hover:bg-[#1C3A2F]/90 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          <button onClick={() => { setList(entries); setEditing(false); }} className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F7F5F2] rounded-lg">Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeader title="Work Experience" onEdit={() => setEditing(true)} />
      {entries.length === 0 ? (
        <EmptyState message="No experience added yet" sub="Upload your resume and we'll fill this in automatically." />
      ) : (
        <div className="space-y-5">
          {entries.map((entry, i) => (
            <div key={entry.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-[#1C3A2F] mt-1 shrink-0" />
                {i < entries.length - 1 && <div className="w-px flex-1 bg-[#E5DDD0] mt-1" />}
              </div>
              <div className="pb-5 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#1C3A2F]">{entry.title}</p>
                    <p className="text-xs text-[#52493F]">{entry.company}</p>
                  </div>
                  {formatDateRange(entry.from, entry.to) && (
                    <span className="text-xs text-[#A09890] whitespace-nowrap shrink-0">{formatDateRange(entry.from, entry.to)}</span>
                  )}
                </div>
                {entry.bullets.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {entry.bullets.map((b, bi) => (
                      <li key={bi} className="text-xs text-[#52493F] flex gap-1.5">
                        <span className="mt-1 w-1 h-1 rounded-full bg-[#A09890] shrink-0" />{b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Skills (real data) ──────────────────────────────────────────────────

function SkillsTab({ skills, onSave, skillGoals, onGraduate }: {
  skills: string[];
  onSave: (skills: string[]) => Promise<void>;
  skillGoals: SkillGoal[];
  onGraduate: (skill: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState<string[]>(skills);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [graduating, setGraduating] = useState<string | null>(null);

  const addSkill = () => { const v = input.trim(); if (v && !list.includes(v)) setList((p) => [...p, v]); setInput(""); };
  const handleSave = async () => { setSaving(true); await onSave(list); setSaving(false); setEditing(false); };

  const handleGraduate = async (skill: string) => {
    setGraduating(skill);
    await onGraduate(skill);
    setGraduating(null);
  };

  return (
    <div>
      <SectionHeader title="Skills" onEdit={() => setEditing(!editing)} />
      {!editing && skills.length === 0 && skillGoals.length === 0 && (
        <EmptyState message="No skills yet" sub="Upload your resume to extract your skills automatically." />
      )}
      {editing ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
              placeholder="Add a skill and press Enter"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
            <button onClick={addSkill} className="px-3 py-2 text-xs bg-[#1C3A2F] text-[#F2EDE3] rounded-lg hover:bg-[#1C3A2F]/90">Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {list.map((s) => <SkillChip key={s} label={s} onRemove={() => setList((p) => p.filter((x) => x !== s))} />)}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-lg hover:bg-[#1C3A2F]/90 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
            <button onClick={() => { setList(skills); setEditing(false); }} className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F7F5F2] rounded-lg">Cancel</button>
          </div>
        </div>
      ) : (
        skills.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#A09890] uppercase tracking-wide mb-2" style={{ fontSize: 12, letterSpacing: "1px" }}>My skills</p>
            <div className="flex flex-wrap gap-2">{skills.map((s) => <SkillChip key={s} label={s} />)}</div>
          </div>
        )
      )}

      {!editing && skillGoals.length > 0 && (
        <div style={{ marginTop: skills.length > 0 ? 24 : 0 }}>
          <p className="text-xs font-semibold text-[#A09890] uppercase tracking-wide mb-3" style={{ fontSize: 12, letterSpacing: "1px" }}>Working on</p>
          <div className="space-y-2">
            {skillGoals.map((g) => (
              <div key={`${g.skill}-${g.role}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(196,168,106,0.08)", border: "1px solid rgba(196,168,106,0.25)", borderRadius: 8 }}>
                <div>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginBottom: 2 }}>{g.skill}</p>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#7A6020" }}>for {g.role}</p>
                </div>
                <button
                  onClick={() => handleGraduate(g.skill)}
                  disabled={graduating === g.skill}
                  style={{ padding: "6px 12px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: graduating === g.skill ? 0.6 : 1 }}
                >
                  {graduating === g.skill ? "Saving…" : "Mark as acquired"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Dream Role ──────────────────────────────────────────────────────────

const ANALYSIS_CACHE_KEY = (role: string) => `kimchi_analysis_${role.replace(/\W+/g, "_")}`;

function DreamRoleTab({ dreamList, setDreamList, onSave, hasResume, userSkills, skillGoals, onAddToLearning }: {
  dreamList: string[];
  setDreamList: (l: string[]) => void;
  onSave: (list: string[]) => void;
  hasResume: boolean;
  userSkills: string[];
  skillGoals: SkillGoal[];
  onAddToLearning: (skill: string, role: string) => void;
}) {
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, RoleAnalysis | "loading" | "error">>({});
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState<Set<string>>(new Set());

  // Pre-populate analysis from localStorage on mount so scores show immediately
  useEffect(() => {
    dreamList.forEach((role) => {
      try {
        const cached = localStorage.getItem(ANALYSIS_CACHE_KEY(role));
        if (cached) {
          const { data, cachedAt } = JSON.parse(cached);
          setAnalysis((prev) => ({ ...prev, [role]: { ...data, _cachedAt: cachedAt } as RoleAnalysis }));
        }
      } catch {}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addRole = (title: string) => {
    if (dreamList.includes(title) || dreamList.length >= 3) return;
    const next = [...dreamList, title];
    setDreamList(next);
    onSave(next);
    setShowSearch(false);
    setSearchQuery("");
  };

  const removeRole = (title: string) => {
    const next = dreamList.filter((r) => r !== title);
    setDreamList(next);
    onSave(next);
    if (expandedRole === title) setExpandedRole(null);
  };

  const fetchAnalysis = async (role: string, force = false) => {
    if (!force) {
      try {
        const cached = localStorage.getItem(ANALYSIS_CACHE_KEY(role));
        if (cached) {
          const { data, cachedAt } = JSON.parse(cached);
          setAnalysis((prev) => ({ ...prev, [role]: { ...data, _cachedAt: cachedAt } as RoleAnalysis }));
          return;
        }
      } catch {}
    }
    setAnalysis((prev) => ({ ...prev, [role]: "loading" }));
    try {
      const res = await fetch(`/api/ai/role-gap?role=${encodeURIComponent(role)}`);
      const data = await res.json();
      if (data.error) {
        setAnalysis((prev) => ({ ...prev, [role]: "error" }));
      } else {
        const cachedAt = new Date().toISOString();
        localStorage.setItem(ANALYSIS_CACHE_KEY(role), JSON.stringify({ data, cachedAt }));
        setAnalysis((prev) => ({ ...prev, [role]: { ...data, _cachedAt: cachedAt } as RoleAnalysis }));
      }
    } catch {
      setAnalysis((prev) => ({ ...prev, [role]: "error" }));
    }
  };

  const toggleExpand = async (role: string) => {
    if (expandedRole === role) { setExpandedRole(null); return; }
    setExpandedRole(role);
    if (analysis[role] || !hasResume) return;
    await fetchAnalysis(role);
  };

  const handleAddToLearning = (skill: string, role: string) => {
    setNeedsRefresh((prev) => new Set([...prev, role]));
    onAddToLearning(skill, role);
  };

  const handleRefresh = async (role: string) => {
    setNeedsRefresh((prev) => { const n = new Set(prev); n.delete(role); return n; });
    await fetchAnalysis(role, true);
  };

  const filteredRoles = AVAILABLE_ROLES.filter(
    (r) => !dreamList.includes(r) && r.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const scoreColor = (score: number) =>
    score >= 70 ? "#4A8B6A" : score >= 50 ? "#C4A86A" : "#A09890";

  const scoreLabel = (score: number) =>
    score >= 70 ? "Strong fit" : score >= 50 ? "Good foundation" : "Gap to close";

  const hasSkill = (skill: string) =>
    userSkills.some((s) => s.toLowerCase() === skill.toLowerCase());

  const isInLearning = (skill: string) =>
    skillGoals.some((g) => g.skill.toLowerCase() === skill.toLowerCase());

  return (
    <div style={{ maxWidth: 560, paddingBottom: 40 }}>
      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#52493F", marginBottom: 24, lineHeight: 1.7 }}>
        Add up to 3 roles you&apos;re targeting. Expand any card to see your fit score, what skills you already have, what you&apos;re missing, and your next steps.
      </p>

      {/* Role cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {dreamList.map((role) => {
          const isOpen = expandedRole === role;
          const result = analysis[role];
          const loaded = result && result !== "loading" && result !== "error" ? result as RoleAnalysis : null;
          const roleNeedsRefresh = needsRefresh.has(role);

          return (
            <div key={role} style={{ background: "#FFFFFF", borderRadius: 10, border: isOpen ? "1.5px solid #1A3A2F" : "1.5px solid rgba(0,0,0,0.08)", boxShadow: isOpen ? "0 4px 20px rgba(26,58,47,0.08)" : "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden", transition: "border-color 0.15s, box-shadow 0.15s" }}>
              {/* Card header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }} onClick={() => toggleExpand(role)}>
                {loaded ? (
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: scoreColor(loaded.fitScore), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}>{loaded.fitScore}%</span>
                  </div>
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(0,0,0,0.04)", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, fontWeight: 600, color: "#1A1A1A", marginBottom: 2 }}>{role}</p>
                  {loaded ? (
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: scoreColor(loaded.fitScore) }}>
                      {scoreLabel(loaded.fitScore)}
                      {loaded._cachedAt ? ` · ${timeAgo(loaded._cachedAt)}` : ""}
                      {roleNeedsRefresh ? " · refresh score" : ""}
                    </p>
                  ) : !hasResume ? (
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890" }}>Upload a resume to see your fit score</p>
                  ) : result === "loading" ? (
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890" }}>Analyzing…</p>
                  ) : result === "error" ? (
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#C4A86A" }}>Analysis unavailable</p>
                  ) : (
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890" }}>Click to analyze fit</p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeRole(role); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#C0B8B0", fontSize: 16, lineHeight: 1, padding: "2px 4px" }}
                    aria-label={`Remove ${role}`}
                  >×</button>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s", color: "#A09890" }}>
                    <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {/* Expanded panel */}
              {isOpen && (
                <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "16px 16px 20px" }}>
                  {result === "loading" && (
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#A09890", textAlign: "center", padding: "16px 0" }}>Analyzing your resume against this role…</p>
                  )}
                  {result === "error" && (
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#C4A86A" }}>Could not run analysis. Make sure your resume is uploaded and try again.</p>
                  )}
                  {!hasResume && (
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#A09890" }}>Upload your resume in the About tab to unlock gap analysis for this role.</p>
                  )}
                  {loaded && (
                    <>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#52493F", lineHeight: 1.65, marginBottom: 20 }}>{loaded.summary}</p>

                      {/* Required skills — split into have / missing / working on */}
                      {loaded.requiredSkills?.length > 0 && (() => {
                        const haveSkills = loaded.requiredSkills.filter((s) => hasSkill(s));
                        const learningSkills = loaded.requiredSkills.filter((s) => !hasSkill(s) && isInLearning(s));
                        const missingSkills = loaded.requiredSkills.filter((s) => !hasSkill(s) && !isInLearning(s));
                        return (
                          <div style={{ marginBottom: 20 }}>
                            {haveSkills.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 700, color: "#4A8B6A", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 8 }}>What you have</p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {haveSkills.map((skill) => (
                                    <span key={skill} style={{ padding: "5px 11px", background: "rgba(74,139,106,0.1)", border: "1px solid rgba(74,139,106,0.2)", borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#2D6B4A", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                      <span style={{ fontSize: 12 }}>✓</span> {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {missingSkills.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 700, color: "#A09890", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 8 }}>What you&apos;re missing</p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {missingSkills.map((skill) => (
                                    <button key={skill} onClick={() => handleAddToLearning(skill, role)} style={{ padding: "5px 11px", background: "#FFFDF9", border: "1px dashed rgba(0,0,0,0.18)", borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#52493F", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                      <span style={{ color: "#1A3A2F", fontWeight: 700, fontSize: 14, lineHeight: 1 }}>+</span> {skill}
                                    </button>
                                  ))}
                                </div>
                                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#B0A898", marginTop: 8, fontStyle: "italic" }}>Tap + to add any skill to your Upskilling queue.</p>
                              </div>
                            )}
                            {learningSkills.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 700, color: "#C4A86A", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 8 }}>Working on</p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {learningSkills.map((skill) => (
                                    <span key={skill} style={{ padding: "5px 11px", background: "rgba(196,168,106,0.12)", border: "1px solid rgba(196,168,106,0.35)", borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#7A6020", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                      <span style={{ fontSize: 12 }}>→</span> {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div style={{ marginTop: 4, padding: "10px 14px", background: "rgba(0,0,0,0.025)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890", margin: 0, lineHeight: 1.5 }}>
                                Skill insights are based on analysis of thousands of active job postings for this role type.
                              </p>
                              <button onClick={() => handleRefresh(role)} style={{ padding: "5px 12px", background: "#FFFFFF", border: "1px solid #E5DDD0", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#52493F", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", flexShrink: 0 }}>
                                ↻ Refresh
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Next steps */}
                      <div>
                        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 700, color: "#4A8B6A", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 10 }}>Next steps</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {loaded.nextSteps.map((step, i) => (
                            <div key={i} style={{ display: "flex", gap: 8 }}>
                              <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 12, color: "#4A8B6A", fontWeight: 600, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
                              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#52493F", lineHeight: 1.5 }}>{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add role area */}
      {dreamList.length < 3 && (
        <div>
          {!showSearch ? (
            <button
              onClick={() => setShowSearch(true)}
              style={{ padding: "10px 18px", background: "transparent", color: "#1A3A2F", border: "1px solid rgba(26,58,47,0.2)", borderRadius: 6, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, cursor: "pointer" }}
            >+ Add a role</button>
          ) : (
            <div>
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roles…"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 7, border: "1.5px solid #1A3A2F", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#1A1A1A", background: "#FFFFFF", outline: "none", marginBottom: 10, boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {searchQuery.trim() && !AVAILABLE_ROLES.map(r => r.toLowerCase()).includes(searchQuery.trim().toLowerCase()) && (
                  <button
                    onClick={() => addRole(searchQuery.trim())}
                    style={{ padding: "6px 14px", background: "#1A3A2F", border: "none", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#E8D5A3", cursor: "pointer" }}
                  >+ Add &ldquo;{searchQuery.trim()}&rdquo;</button>
                )}
                {filteredRoles.slice(0, 20).map((r) => (
                  <button
                    key={r}
                    onClick={() => addRole(r)}
                    style={{ padding: "6px 14px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#1A1A1A", cursor: "pointer" }}
                  >{r}</button>
                ))}
                <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} style={{ padding: "6px 12px", background: "transparent", border: "none", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#A09890", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Upskilling ──────────────────────────────────────────────────────────

const CUSTOM_LEARNING_KEY = "kimchi_custom_learning";

function LearningTab({ progress, setProgress, skillGoals, onGraduate, targetRoles }: {
  progress: Record<number, "none" | "inprogress" | "completed">;
  setProgress: (p: Record<number, "none" | "inprogress" | "completed">) => void;
  skillGoals: SkillGoal[];
  onGraduate: (skill: string) => Promise<void>;
  targetRoles: string[];
}) {
  const [graduating, setGraduating] = useState<string | null>(null);
  const [customItems, setCustomItems] = useState<CustomLearningItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_LEARNING_KEY) || "[]"); } catch { return []; }
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newPlatform, setNewPlatform] = useState("");
  const [newDuration, setNewDuration] = useState("");

  const doneCount = Object.values(progress).filter((v) => v === "completed").length;
  const customDone = customItems.filter((i) => i.status === "completed").length;
  const total = UPSKILL_CATEGORIES.reduce((a, c) => a + c.items.length, 0);

  const handleGraduate = async (skill: string) => {
    setGraduating(skill);
    await onGraduate(skill);
    setGraduating(null);
  };

  const saveCustomItems = (items: CustomLearningItem[]) => {
    setCustomItems(items);
    try { localStorage.setItem(CUSTOM_LEARNING_KEY, JSON.stringify(items)); } catch {}
  };

  const addCustomItem = () => {
    if (!newName.trim()) return;
    const item: CustomLearningItem = {
      id: `cl_${Date.now()}`,
      name: newName.trim(),
      url: newUrl.trim() || undefined,
      platform: newPlatform.trim() || undefined,
      duration: newDuration.trim() || undefined,
      status: "none",
      addedAt: new Date().toISOString(),
    };
    saveCustomItems([...customItems, item]);
    setNewName(""); setNewUrl(""); setNewPlatform(""); setNewDuration("");
    setShowAddForm(false);
  };

  const updateCustomStatus = (id: string) => {
    saveCustomItems(customItems.map((i) =>
      i.id === id ? { ...i, status: i.status === "none" ? "inprogress" : i.status === "inprogress" ? "completed" : "inprogress" } : i
    ));
  };

  const removeCustomItem = (id: string) => saveCustomItems(customItems.filter((i) => i.id !== id));

  return (
    <div style={{ maxWidth: 620, paddingBottom: 40 }}>

      {/* Section A — From your target roles */}
      {skillGoals.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 700, color: "#52493F", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 10 }}>From your target roles</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {skillGoals.map((g) => {
              const matchedCourse = UPSKILL_CATEGORIES.flatMap((c) => c.items).find(
                (item) => item.closesGap?.some((s) => s.toLowerCase() === g.skill.toLowerCase())
              );
              return (
                <div key={`${g.skill}-${g.role}`} style={{ background: "#FFFFFF", borderRadius: 8, padding: "12px 14px", border: "1px solid rgba(196,168,106,0.3)", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{g.skill}</p>
                      <span style={{ padding: "1px 7px", background: "rgba(196,168,106,0.15)", borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#7A6020", fontWeight: 600 }}>for {g.role}</span>
                    </div>
                    {matchedCourse && (
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#4A8B6A" }}>
                        Suggested: {matchedCourse.name} on {matchedCourse.platform}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleGraduate(g.skill)}
                    disabled={graduating === g.skill}
                    style={{ padding: "6px 12px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 500, cursor: "pointer", flexShrink: 0, opacity: graduating === g.skill ? 0.6 : 1 }}
                  >
                    {graduating === g.skill ? "Saving…" : "Mark as acquired"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div style={{ background: "#1A3A2F", borderRadius: 10, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, color: "rgba(232,213,163,0.5)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Your learning progress</p>
          <p style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 20, fontWeight: 500, color: "#E8D5A3" }}>{doneCount + customDone} of {total + customItems.length} complete</p>
        </div>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: `conic-gradient(#E8D5A3 ${((doneCount + customDone) / (total + customItems.length || 1)) * 360}deg, rgba(232,213,163,0.15) 0)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#1A3A2F", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 14, fontWeight: 500, color: "#E8D5A3" }}>{Math.round(((doneCount + customDone) / (total + customItems.length || 1)) * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Section B — Recommended paths */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 700, color: "#52493F", textTransform: "uppercase", letterSpacing: "1.1px" }}>Recommended paths</p>
        </div>
        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890", marginBottom: 16 }}>
          Curated by Kimchi based on what hiring managers look for. Partner certifications will be added here as we grow.
        </p>
        {UPSKILL_CATEGORIES.map((cat) => {
          const gapSkills = new Set(skillGoals.map((g) => g.skill.toLowerCase()));
          const sorted = [...cat.items].sort((a, b) => {
            const aMatch = a.closesGap?.some((s) => gapSkills.has(s.toLowerCase())) ? 1 : 0;
            const bMatch = b.closesGap?.some((s) => gapSkills.has(s.toLowerCase())) ? 1 : 0;
            return bMatch - aMatch;
          });
          return (
          <div key={cat.title} style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginBottom: 4 }}>{cat.title}</p>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#7A7268", marginBottom: 10 }}>{cat.subtitle}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sorted.map((item) => {
                const prog = progress[item.id] || "none";
                const statusLabel = prog === "completed" ? "Completed ✓" : prog === "inprogress" ? "In progress" : "Not started";
                const statusColor = prog === "completed" ? "#4A8B6A" : prog === "inprogress" ? "#C4A86A" : "#A09890";
                const isGapMatch = item.closesGap?.some((s) => gapSkills.has(s.toLowerCase())) ?? false;
                return (
                  <div key={item.id} style={{ background: "#FFFFFF", borderRadius: 8, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 7, background: item.platformColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>{item.platformInitial}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{item.name}</p>
                        {item.scoutPick && <span style={{ padding: "1px 7px", background: "rgba(196,168,106,0.15)", borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#7A6020", fontWeight: 600 }}>Kimchi pick</span>}
                        {isGapMatch && <span style={{ padding: "1px 7px", background: "rgba(74,139,106,0.1)", borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#2D6B4A", fontWeight: 500 }}>closes gap</span>}
                      </div>
                      {item.closesGap && item.closesGap.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                          {item.closesGap.map((skill) => {
                            const isSkillGap = gapSkills.has(skill.toLowerCase());
                            return (
                              <span key={skill} className={isSkillGap
                                ? "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#4A8B6A]/10 text-[#2D6B4A]"
                                : "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#E8D5A3]/50 text-[#52493F]"
                              }>
                                {skill}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#7A7268", marginBottom: 3 }}>{item.platform} &middot; {item.duration} &middot; {item.credential}</p>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: statusColor }}>{statusLabel}</p>
                    </div>
                    <button onClick={() => setProgress({ ...progress, [item.id]: prog === "none" ? "inprogress" : prog === "inprogress" ? "completed" : "inprogress" })}
                      style={{ padding: "7px 14px", background: prog === "completed" ? "rgba(74,139,106,0.1)" : "#1A3A2F", color: prog === "completed" ? "#4A8B6A" : "#E8D5A3", border: "none", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>
                      {prog === "completed" ? "Review →" : prog === "inprogress" ? "Complete →" : "Start →"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Section C — My Learning */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 700, color: "#52493F", textTransform: "uppercase", letterSpacing: "1.1px" }}>My learning</p>
          {!showAddForm && (
            <button onClick={() => setShowAddForm(true)} style={{ padding: "5px 12px", background: "transparent", border: "1px solid rgba(26,58,47,0.2)", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#1A3A2F", cursor: "pointer" }}>+ Add your own</button>
          )}
        </div>

        {showAddForm && (
          <div style={{ background: "#FFFFFF", borderRadius: 8, padding: "16px", border: "1px solid #E5DDD0", marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890", marginBottom: 4 }}>Course / Certification name *</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Google Project Management Certificate"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #E5DDD0", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#1A1A1A", background: "#FFFDF9", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890", marginBottom: 4 }}>Platform</label>
                <input value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)} placeholder="e.g. Coursera, Udemy, LinkedIn"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #E5DDD0", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#1A1A1A", background: "#FFFDF9", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890", marginBottom: 4 }}>Duration</label>
                <input value={newDuration} onChange={(e) => setNewDuration(e.target.value)} placeholder="e.g. 6 weeks"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #E5DDD0", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#1A1A1A", background: "#FFFDF9", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890", marginBottom: 4 }}>URL (optional)</label>
                <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://…"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #E5DDD0", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#1A1A1A", background: "#FFFDF9", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addCustomItem} disabled={!newName.trim()} style={{ padding: "7px 16px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 500, cursor: newName.trim() ? "pointer" : "not-allowed", opacity: newName.trim() ? 1 : 0.5 }}>Add</button>
              <button onClick={() => { setShowAddForm(false); setNewName(""); setNewUrl(""); setNewPlatform(""); setNewDuration(""); }} style={{ padding: "7px 14px", background: "transparent", border: "none", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#A09890", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}

        {customItems.length === 0 && !showAddForm ? (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#C0B8B0" }}>No custom items yet. Add courses, certifications, or tools you&apos;re learning on your own.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {customItems.map((item) => {
              const statusLabel = item.status === "completed" ? "Completed ✓" : item.status === "inprogress" ? "In progress" : "Not started";
              const statusColor = item.status === "completed" ? "#4A8B6A" : item.status === "inprogress" ? "#C4A86A" : "#A09890";
              return (
                <div key={item.id} style={{ background: "#FFFFFF", borderRadius: 8, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 7, background: "#E8E2D8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 700, color: "#7A7268" }}>{(item.platform || item.name).charAt(0).toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#1A1A1A", textDecoration: "none" }}>{item.name}</a>
                      ) : (
                        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{item.name}</p>
                      )}
                    </div>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#7A7268", marginBottom: 3 }}>
                      {[item.platform, item.duration].filter(Boolean).join(" · ")}
                    </p>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: statusColor }}>{statusLabel}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => updateCustomStatus(item.id)}
                      style={{ padding: "7px 14px", background: item.status === "completed" ? "rgba(74,139,106,0.1)" : "#1A3A2F", color: item.status === "completed" ? "#4A8B6A" : "#E8D5A3", border: "none", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                      {item.status === "completed" ? "Review →" : item.status === "inprogress" ? "Complete →" : "Start →"}
                    </button>
                    <button onClick={() => removeCustomItem(item.id)} style={{ background: "none", border: "none", color: "#C0B8B0", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 4px" }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Resume Assets ───────────────────────────────────────────────────────

interface ResumeRow {
  id: string;
  name: string;
  url: string;
  isPrimary: boolean;
  analysisComplete: boolean;
  updatedAt: string;
  createdAt: string;
  targetJobTitle?: string;
}

function UploadResumeModal({ onClose, onUpload, uploading, inputRef }: {
  onClose: () => void;
  onUpload: () => void;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF", borderRadius: 16, padding: "48px 40px 40px",
          width: 540, maxWidth: "90vw", position: "relative",
          display: "flex", flexDirection: "column", alignItems: "center",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 14, right: 14,
            width: 32, height: 32, borderRadius: "50%",
            background: "#1A1A1A", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#FFFFFF", fontSize: 16, fontWeight: 700,
          }}
        >
          ✕
        </button>

        {/* Title */}
        <h2 style={{
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 22, fontWeight: 700, color: "#1A1A1A",
          margin: "0 0 32px", textAlign: "center",
        }}>
          Upload Resume to Get Started
        </h2>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            width: 140, height: 140, display: "flex",
            alignItems: "center", justifyContent: "center",
            cursor: "pointer", marginBottom: 32,
          }}
        >
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="10" width="65" height="82" rx="6" fill="#F5F5F5" stroke="#D0D0D0" strokeWidth="2"/>
            <rect x="28" y="24" width="42" height="4" rx="2" fill="#D0D0D0"/>
            <rect x="28" y="34" width="36" height="4" rx="2" fill="#D0D0D0"/>
            <rect x="28" y="44" width="40" height="4" rx="2" fill="#D0D0D0"/>
            <rect x="28" y="54" width="32" height="4" rx="2" fill="#D0D0D0"/>
            <circle cx="85" cy="85" r="20" fill="#1A1A1A"/>
            <path d="M85 77v16M77 85l8-8 8 8" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Note */}
        <p style={{
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 13, color: "#A09890", textAlign: "center",
          margin: "0 0 24px",
        }}>
          Files should be in PDF or Word format and must not exceed 10MB in size.
        </p>

        {/* Upload button */}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            width: "100%", padding: "14px 0",
            background: "#1A1A1A", color: "#FFFFFF",
            border: "none", borderRadius: 8,
            fontSize: 15, fontWeight: 600,
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.6 : 1,
            fontFamily: "var(--font-dm-sans), system-ui",
          }}
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>
    </div>
  );
}

function AssetsTab({ resumeUrl, uploading, onUpload, inputRef, suggestions, suggestionsLoading }: {
  resumeUrl: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  suggestions: AISuggestion[];
  suggestionsLoading: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const MAX_SLOTS = 5;

  const resumes: ResumeRow[] = resumeUrl
    ? [
        {
          id: "primary",
          name: extractResumeName(resumeUrl),
          url: resumeUrl,
          isPrimary: true,
          analysisComplete: true,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ]
    : [];

  function extractResumeName(url: string) {
    try {
      const decoded = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "");
      // strip the timestamp prefix e.g. "resume-1234567890.pdf" → just show the original feel
      return decoded.replace(/^resume-\d+\./, "resume.") || "Resume";
    } catch {
      return "Resume";
    }
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 16, fontWeight: 700, color: "#1A1A1A", margin: 0, letterSpacing: "-0.2px" }}>RESUME</h2>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#6B6258", marginTop: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#4A8B6A", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>
              </span>
              You have {resumes.length} resume{resumes.length !== 1 ? "s" : ""} saved out of {MAX_SLOTS} available slots.
            </span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={{
              padding: "8px 16px",
              background: "#F0FFF8",
              color: "#1A7A4A",
              border: "1px solid #A8DFC0",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            ⚡ Upgrade to Turbo: Get Hired Faster ›
          </button>
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUpload(f); setShowUploadModal(false); } }} />
          <button
            onClick={() => setShowUploadModal(true)}
            disabled={uploading}
            style={{
              padding: "8px 16px",
              background: "#FFFFFF",
              color: "#1A1A1A",
              border: "1px solid #D8D0C5",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: uploading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? "Uploading…" : "+ Add Resume"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E5DDD0", overflow: "visible", position: "relative" }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.2fr 1fr 1fr 40px",
          padding: "10px 20px",
          borderBottom: "1px solid #E5DDD0",
          background: "#FAFAF8",
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
        }}>
          {["Resume", "Target Job Title", "Last Modified", "Created", ""].map((col) => (
            <span key={col} style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#A09890" }}>{col}</span>
          ))}
        </div>

        {/* Rows */}
        {resumes.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, color: "#A09890" }}>No resume uploaded yet.</p>
            <button
              onClick={() => setShowUploadModal(true)}
              disabled={uploading}
              style={{ marginTop: 12, padding: "10px 20px", background: "#1C3A2F", color: "#E8D5A3", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              + Add Resume
            </button>
          </div>
        ) : (
          resumes.map((r) => (
            <div
              key={r.id}
              onClick={() => window.open(r.url, "_blank")}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.2fr 1fr 1fr 40px",
                padding: "14px 20px",
                alignItems: "center",
                borderBottom: "1px solid #F5F3EF",
                position: "relative",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAF8")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* Name + badges */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 6, background: "#1C3A2F",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <span style={{ color: "#E8D5A3", fontSize: 14, fontWeight: 700 }}>
                    {r.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>{r.name}</span>
                  <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    {r.isPrimary && (
                      <span style={{ padding: "2px 8px", background: "#FFF8E8", border: "1px solid #E8D5A3", borderRadius: 100, fontSize: 12, fontWeight: 600, color: "#A08030", display: "flex", alignItems: "center", gap: 3 }}>
                        ★ PRIMARY
                      </span>
                    )}
                    {r.analysisComplete && (
                      <span style={{ padding: "2px 8px", background: "#F0FFF8", border: "1px solid #A8DFC0", borderRadius: 100, fontSize: 12, fontWeight: 500, color: "#1A7A4A" }}>
                        Analysis Complete
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Target job title */}
              <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: r.targetJobTitle ? "#1A1A1A" : "#C0B8B0" }}>
                {r.targetJobTitle ?? "—"}
              </span>

              {/* Last modified */}
              <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#6B6258" }}>
                {timeAgo(r.updatedAt)}
              </span>

              {/* Created */}
              <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#6B6258" }}>
                {timeAgo(r.createdAt)}
              </span>

              {/* Options menu */}
              <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setMenuOpen(menuOpen === r.id ? null : r.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#A09890", padding: "4px 6px", borderRadius: 4 }}
                >
                  ···
                </button>
                {menuOpen === r.id && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 4px)",
                      background: "#FFFFFF",
                      border: "1px solid #E5DDD0",
                      borderRadius: 7,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                      minWidth: 160,
                      zIndex: 100,
                      overflow: "hidden",
                    }}
                  >
                    {[
                      { label: "View resume", action: () => { window.open(r.url, "_blank"); setMenuOpen(null); } },
                      { label: "Replace resume", action: () => { inputRef.current?.click(); setMenuOpen(null); } },
                      { label: "Download", action: () => { window.open(r.url, "_blank"); setMenuOpen(null); } },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={item.action}
                        style={{ width: "100%", padding: "10px 14px", textAlign: "left", background: "none", border: "none", fontSize: 14, color: "#1A1A1A", cursor: "pointer", display: "block", borderBottom: "1px solid #F5F3EF" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F3EF")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showUploadModal && (
        <UploadResumeModal
          onClose={() => setShowUploadModal(false)}
          onUpload={() => inputRef.current?.click()}
          uploading={uploading}
          inputRef={inputRef}
        />
      )}
    </div>
  );
}

// ─── AI Readback Card ─────────────────────────────────────────────────────────

function ReadbackCard({ data, loading, onRefresh }: { data: ReadbackData | null; loading: boolean; onRefresh: () => void }) {
  if (!loading && !data) return null;
  return (
    <div style={{ borderRadius: 10, border: "1px solid #E5DDD0", background: "#FFFDF9", padding: "16px 20px", marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, color: "#C4A86A", textTransform: "uppercase" as const, letterSpacing: "1px", margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
          <SparkleIcon /> Kimchi&apos;s read on you
        </p>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "transparent", border: "1px solid #E5DDD0", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}
        >
          <span style={{ fontSize: 13 }}>↻</span> {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {loading ? (
        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#A09890" }}>Analyzing your profile…</p>
      ) : data ? (
        <>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, color: "#1C3A2F", lineHeight: 1.65, marginBottom: 12 }}>{data.picture}</p>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 12 }}>
            {data.strengths.map((s) => (
              <span key={s} style={{ padding: "4px 10px", background: "rgba(28,58,47,0.08)", borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#1C3A2F" }}>{s}</span>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 12 }}>
            {data.targetRoles.map((r) => {
              const c = r.fit === "Strong match" ? "#4A8B6A" : r.fit === "Good fit" ? "#C4A86A" : "#A09890";
              const bg = r.fit === "Strong match" ? "rgba(74,139,106,0.08)" : r.fit === "Good fit" ? "rgba(196,168,106,0.1)" : "rgba(0,0,0,0.04)";
              return (
                <span key={r.role} style={{ padding: "4px 10px", background: bg, borderRadius: 6, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: c }}>{r.role} · {r.fit}</span>
              );
            })}
          </div>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#A09890", fontStyle: "italic" }}>{data.honestNote}</p>
        </>
      ) : null}
    </div>
  );
}

// ─── Career Preferences Panel ─────────────────────────────────────────────────

const PREF_EMPLOYMENT = [
  { value: "employed", label: "Employed — not actively looking" },
  { value: "open", label: "Employed — open to opportunities" },
  { value: "searching", label: "Actively searching" },
];

const PREF_JOB_TIMELINES = [
  { value: "asap", label: "As soon as possible" },
  { value: "3-6mo", label: "In the next 3–6 months" },
  { value: "open", label: "Whenever the right role appears" },
];

const PREF_MOTIVATIONS = [
  "Higher compensation",
  "More interesting work",
  "Better work-life balance",
  "Step up in level",
  "A career pivot",
];

const PREF_PRIORITIES = [
  "Remote-first",
  "Hybrid-friendly",
  "Work-life balance",
  "High compensation",
  "Equity / ownership",
  "Mission-driven",
  "Fast growth",
  "Strong team culture",
  "Specific location",
];

type CareerPrefPatch = Partial<Pick<UserProfile, "careerMotivation" | "jobTimeline" | "currentSalary" | "targetSalary" | "priorities" | "employmentStatus">>;

function CareerPreferencesPanel({ profile, onSave }: {
  profile: UserProfile;
  onSave: (patch: CareerPrefPatch) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [empStatus, setEmpStatus] = useState(profile.employmentStatus || "");
  const [timeline, setTimeline] = useState(profile.jobTimeline || "");
  const [currentSalary, setCurrentSalary] = useState(profile.currentSalary || "");
  const [targetSalary, setTargetSalary] = useState(profile.targetSalary || "");
  const [motivation, setMotivation] = useState(profile.careerMotivation || "");
  const [priorities, setPriorities] = useState<string[]>(profile.priorities || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmpStatus(profile.employmentStatus || "");
    setTimeline(profile.jobTimeline || "");
    setCurrentSalary(profile.currentSalary || "");
    setTargetSalary(profile.targetSalary || "");
    setMotivation(profile.careerMotivation || "");
    setPriorities(profile.priorities || []);
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
    setEditing(false);
  };

  const statusLabel = PREF_EMPLOYMENT.find(e => e.value === profile.employmentStatus)?.label;
  const timelineLabel = PREF_JOB_TIMELINES.find(t => t.value === profile.jobTimeline)?.label;
  const hasAnyData = profile.employmentStatus || profile.jobTimeline || profile.currentSalary || profile.targetSalary || profile.careerMotivation || (profile.priorities || []).length > 0;

  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 8, border: "1px solid #E5DDD0", background: "#FFFDF9", color: "#1C3A2F", fontFamily: "var(--font-dm-sans), system-ui", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 12, padding: "20px 24px", border: "1px solid rgba(0,0,0,0.07)" }}>
      <SectionHeader title="Career Preferences" onEdit={() => setEditing(!editing)} />

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Status */}
          <div>
            <p style={{ fontSize: 11, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui", marginBottom: 6 }}>Status</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PREF_EMPLOYMENT.map(({ value, label }) => (
                <button key={value} onClick={() => setEmpStatus(empStatus === value ? "" : value)}
                  style={{ textAlign: "left", padding: "8px 12px", borderRadius: 8, border: `1px solid ${empStatus === value ? "#1C3A2F" : "#E5DDD0"}`, background: empStatus === value ? "rgba(28,58,47,0.06)" : "#FFFDF9", fontSize: 13, color: "#1C3A2F", fontFamily: "var(--font-dm-sans), system-ui", cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <p style={{ fontSize: 11, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui", marginBottom: 6 }}>Timeline</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PREF_JOB_TIMELINES.map(({ value, label }) => (
                <button key={value} onClick={() => setTimeline(timeline === value ? "" : value)}
                  style={{ textAlign: "left", padding: "8px 12px", borderRadius: 8, border: `1px solid ${timeline === value ? "#1C3A2F" : "#E5DDD0"}`, background: timeline === value ? "rgba(28,58,47,0.06)" : "#FFFDF9", fontSize: 13, color: "#1C3A2F", fontFamily: "var(--font-dm-sans), system-ui", cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Salary */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {([["Current salary", currentSalary, setCurrentSalary], ["Target salary", targetSalary, setTargetSalary]] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
              <div key={label}>
                <p style={{ fontSize: 11, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui", marginBottom: 6 }}>{label}</p>
                <input value={val} onChange={(e) => setter(e.target.value)} placeholder="e.g. $120K" style={inputStyle} />
              </div>
            ))}
          </div>

          {/* Motivation */}
          <div>
            <p style={{ fontSize: 11, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui", marginBottom: 6 }}>Primary motivation</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PREF_MOTIVATIONS.map((m) => (
                <button key={m} onClick={() => setMotivation(motivation === m ? "" : m)}
                  style={{ padding: "5px 12px", borderRadius: 100, border: `1px solid ${motivation === m ? "#1C3A2F" : "#E5DDD0"}`, background: motivation === m ? "rgba(28,58,47,0.08)" : "#FFFDF9", fontSize: 12, color: motivation === m ? "#1C3A2F" : "#7A7268", fontFamily: "var(--font-dm-sans), system-ui", cursor: "pointer" }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Priorities */}
          <div>
            <p style={{ fontSize: 11, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui", marginBottom: 6 }}>What matters most</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PREF_PRIORITIES.map((p) => (
                <button key={p} onClick={() => setPriorities(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                  style={{ padding: "5px 12px", borderRadius: 100, border: `1px solid ${priorities.includes(p) ? "#1C3A2F" : "#E5DDD0"}`, background: priorities.includes(p) ? "rgba(28,58,47,0.08)" : "#FFFDF9", fontSize: 12, color: priorities.includes(p) ? "#1C3A2F" : "#7A7268", fontFamily: "var(--font-dm-sans), system-ui", cursor: "pointer" }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, paddingTop: 2 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: "7px 16px", fontSize: 12, fontWeight: 600, background: "#1C3A2F", color: "#F2EDE3", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.5 : 1, fontFamily: "var(--font-dm-sans), system-ui" }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={handleCancel}
              style={{ padding: "7px 16px", fontSize: 12, color: "#52493F", background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-dm-sans), system-ui" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : !hasAnyData ? (
        <p style={{ fontSize: 13, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui", paddingTop: 4 }}>
          No preferences set yet. Click the pencil to add your search criteria.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {profile.employmentStatus && (
            <div>
              <p style={{ fontSize: 11, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Status</p>
              <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 8, background: "#F7F5F2", border: "1px solid rgba(0,0,0,0.08)", fontSize: 13, color: "#1C3A2F", fontFamily: "var(--font-dm-sans), system-ui" }}>{statusLabel || profile.employmentStatus}</span>
            </div>
          )}
          {profile.jobTimeline && (
            <div>
              <p style={{ fontSize: 11, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Timeline</p>
              <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 8, background: "#F7F5F2", border: "1px solid rgba(0,0,0,0.08)", fontSize: 13, color: "#1C3A2F", fontFamily: "var(--font-dm-sans), system-ui" }}>{timelineLabel || profile.jobTimeline}</span>
            </div>
          )}
          {(profile.currentSalary || profile.targetSalary) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {profile.currentSalary && (
                <div>
                  <p style={{ fontSize: 11, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Current</p>
                  <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 8, background: "#F7F5F2", border: "1px solid rgba(0,0,0,0.08)", fontSize: 13, color: "#1C3A2F", fontFamily: "var(--font-dm-sans), system-ui" }}>{profile.currentSalary}</span>
                </div>
              )}
              {profile.targetSalary && (
                <div>
                  <p style={{ fontSize: 11, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Target</p>
                  <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 8, background: "#F7F5F2", border: "1px solid rgba(0,0,0,0.08)", fontSize: 13, color: "#1C3A2F", fontFamily: "var(--font-dm-sans), system-ui" }}>{profile.targetSalary}</span>
                </div>
              )}
            </div>
          )}
          {profile.careerMotivation && (
            <div>
              <p style={{ fontSize: 11, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Looking for</p>
              <span style={{ display: "inline-block", padding: "6px 12px", borderRadius: 8, background: "#F7F5F2", border: "1px solid rgba(0,0,0,0.08)", fontSize: 13, color: "#1C3A2F", fontFamily: "var(--font-dm-sans), system-ui" }}>{profile.careerMotivation}</span>
            </div>
          )}
          {(profile.priorities || []).length > 0 && (
            <div>
              <p style={{ fontSize: 11, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Priorities</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {profile.priorities.map((p) => (
                  <span key={p} style={{ padding: "5px 11px", borderRadius: 8, background: "#F7F5F2", border: "1px solid rgba(0,0,0,0.08)", fontSize: 12, color: "#1C3A2F", fontFamily: "var(--font-dm-sans), system-ui" }}>{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type PageTab = "dreamrole" | "about" | "learning" | "assets";
type AboutSection = "personal" | "education" | "experience" | "skills";

const ABOUT_SECTIONS: AboutSection[] = ["personal", "education", "experience", "skills"];
const ABOUT_LABEL: Record<AboutSection, string> = { personal: "Personal information", education: "Education", experience: "Work experience", skills: "Skills" };

const SKILL_GOALS_KEY = "kimchi_skill_goals";

export function WorkspaceProfile() {
  const [activeSection, setActiveSection] = useState<AboutSection>("personal");
  const router = useRouter();
  const pathname = usePathname();
  const page: PageTab =
    pathname === "/profile/dream-role" ? "dreamrole" :
    pathname === "/profile/learning-path" ? "learning" :
    pathname === "/profile/assets" ? "assets" :
    "about";
  const setPage = (tab: PageTab) => {
    if (tab === "about") router.push("/profile");
    else if (tab === "dreamrole") router.push("/profile/dream-role");
    else if (tab === "learning") router.push("/profile/learning-path");
    else if (tab === "assets") router.push("/profile/assets");
  };
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dreamList, setDreamList] = useState<string[]>([]);
  const [upskillProgress, setUpskillProgress] = useState<Record<number, "none" | "inprogress" | "completed">>({});
  const [skillGoals, setSkillGoals] = useState<SkillGoal[]>([]);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [readback, setReadback] = useState<ReadbackData | null>(null);
  const [readbackLoading, setReadbackLoading] = useState(false);
  const [profileSuggestions, setProfileSuggestions] = useState<AISuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<AboutSection, HTMLDivElement | null>>({ personal: null, education: null, experience: null, skills: null });

  // Load skill goals from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SKILL_GOALS_KEY);
      if (stored) setSkillGoals(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setProfile(data);
          setDreamList(data.targetRoles || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!profile?.resumeUrl) return;
    setReadbackLoading(true);
    fetch("/api/ai/readback")
      .then((r) => r.json())
      .then((data) => { if (!data.error) setReadback(data); })
      .catch(() => {})
      .finally(() => setReadbackLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.resumeUrl]);

  const refreshReadback = () => {
    if (!profile?.resumeUrl) return;
    setReadbackLoading(true);
    fetch("/api/ai/readback")
      .then((r) => r.json())
      .then((data) => { if (!data.error) setReadback(data); })
      .catch(() => {})
      .finally(() => setReadbackLoading(false));
  };

  useEffect(() => {
    if (!profile?.resumeUrl) return;
    setSuggestionsLoading(true);
    fetch("/api/ai/profile-suggestions")
      .then((r) => r.json())
      .then((data) => { if (data.suggestions) setProfileSuggestions(data.suggestions); })
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.resumeUrl]);

  const patchProfile = async (patch: Record<string, unknown>) => {
    await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => {});
  };

  const handlePersonalSave = async (patch: Omit<Partial<UserProfile>, "parsedData"> & { parsedData?: Partial<ParsedData> }) => {
    if (!profile) return;
    const { parsedData: pdPatch, ...rest } = patch;
    const newParsedData = pdPatch ? { ...(profile.parsedData || { education: [], workExperience: [], skills: [] }), ...pdPatch } : profile.parsedData;
    await patchProfile({ ...rest, parsedData: newParsedData });
    setProfile((p) => p ? { ...p, ...rest, parsedData: newParsedData } : p);
  };

  const handleEducationSave = async (entries: EducationEntry[]) => {
    if (!profile) return;
    const newParsedData = { ...(profile.parsedData || { workExperience: [], skills: [] }), education: entries };
    await patchProfile({ parsedData: newParsedData });
    setProfile((p) => p ? { ...p, parsedData: newParsedData } : p);
  };

  const handleExperienceSave = async (entries: WorkEntry[]) => {
    if (!profile) return;
    const newParsedData = { ...(profile.parsedData || { education: [], skills: [] }), workExperience: entries };
    await patchProfile({ parsedData: newParsedData });
    setProfile((p) => p ? { ...p, parsedData: newParsedData } : p);
  };

  const handleSkillsSave = async (skills: string[]) => {
    if (!profile) return;
    const newParsedData = { ...(profile.parsedData || { education: [], workExperience: [] }), skills };
    await patchProfile({ parsedData: newParsedData });
    setProfile((p) => p ? { ...p, parsedData: newParsedData } : p);
  };

  const handleCareerPrefSave = async (patch: CareerPrefPatch) => {
    await patchProfile(patch as Record<string, unknown>);
    setProfile((p) => p ? { ...p, ...patch } : p);
  };

  const addSkillGoal = (skill: string, role: string) => {
    setSkillGoals((prev) => {
      if (prev.some((g) => g.skill.toLowerCase() === skill.toLowerCase())) return prev;
      const next = [...prev, { skill, role, addedAt: new Date().toISOString() }];
      try { localStorage.setItem(SKILL_GOALS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const graduateSkill = async (skill: string) => {
    const currentSkills = profile?.parsedData?.skills || [];
    if (!currentSkills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      await handleSkillsSave([...currentSkills, skill]);
    }
    setSkillGoals((prev) => {
      const next = prev.filter((g) => g.skill.toLowerCase() !== skill.toLowerCase());
      try { localStorage.setItem(SKILL_GOALS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleResumeUpload = async (file: File) => {
    setResumeUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/resume", { method: "POST", body: form });
      const data = await res.json();
      if (data.url) {
        const profileRes = await fetch("/api/profile");
        const profileData = await profileRes.json();
        if (!profileData.error) setProfile(profileData);
        else setProfile((p) => p ? { ...p, resumeUrl: data.url } : p);
      }
    } catch { /* silent */ }
    finally { setResumeUploading(false); }
  };

  const goToSection = (section: AboutSection) => {
    if (page !== "about") router.push("/profile");
    setActiveSection(section);
    // Wait for render if switching from another page, then scroll
    setTimeout(() => {
      const el = sectionRefs.current[section];
      const container = scrollRef.current;
      if (el && container) {
        const top = el.offsetTop - 16;
        container.scrollTo({ top, behavior: "smooth" });
      }
    }, 50);
  };

  const pd = profile?.parsedData;
  const education = pd?.education || [];
  const workExperience = pd?.workExperience || [];
  const skills = pd?.skills || [];

  const PAGE_TABS: { id: PageTab; label: string }[] = [
    { id: "about", label: "About" },
    { id: "dreamrole", label: "Target Roles" },
    { id: "learning", label: "Upskilling" },
    { id: "assets", label: "Assets" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#F7F5F2", animation: "fadeIn 0.3s ease both" }}>
      <div ref={scrollRef} style={{ padding: "20px 32px 0", overflowY: "auto", flex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 500, color: "#A09890", letterSpacing: "1.1px", textTransform: "uppercase", marginBottom: 8 }}>
            {loading ? "Loading…" : profile ? (profile.name || profile.email || "Your profile") : "Your profile"}
            {profile?.headline ? ` · ${profile.headline}` : ""}
          </p>
          <h1 style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 32, fontWeight: 500, fontStyle: "italic", color: "#1A1A1A", letterSpacing: "-0.3px" }}>
            Your profile, through Kimchi&apos;s eyes.
          </h1>
          {profile && (() => {
            const pct = profileCompleteness(profile);
            return (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890" }}>Profile completeness</span>
                  <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 600, color: pct >= 80 ? "#4A8B6A" : "#C4A86A" }}>{pct}%</span>
                </div>
                <div style={{ height: 3, background: "#E5DDD0", borderRadius: 2, maxWidth: 280 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: pct >= 80 ? "#4A8B6A" : "#C4A86A", borderRadius: 2, transition: "width 0.4s ease" }} />
                </div>
              </div>
            );
          })()}
        </div>

        {/* Main tab bar */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid rgba(0,0,0,0.08)", overflowX: "auto", marginBottom: page === "about" ? 0 : 24 }}>
          {PAGE_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              style={{ padding: "8px 16px", border: "none", borderRadius: "6px 6px 0 0", background: page === id ? "#1A3A2F" : "transparent", color: page === id ? "#E8D5A3" : "#52493F", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sub-tabs — only when About is active */}
        {page === "about" && (
          <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "1px solid rgba(0,0,0,0.05)", overflowX: "auto", background: "#EDE8DF", paddingLeft: 8 }}>
            {ABOUT_SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => goToSection(s)}
                style={{ padding: "6px 14px", border: "none", background: activeSection === s ? "rgba(28,58,47,0.1)" : "transparent", color: activeSection === s ? "#1C3A2F" : "#7A7268", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: activeSection === s ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, borderBottom: activeSection === s ? "2px solid #1C3A2F" : "2px solid transparent", transition: "all 0.15s" }}
              >
                {ABOUT_LABEL[s]}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        {page === "dreamrole" && (
          <DreamRoleTab
            dreamList={dreamList}
            setDreamList={setDreamList}
            onSave={(list) => patchProfile({ targetRoles: list })}
            hasResume={!!profile?.resumeUrl}
            userSkills={skills}
            skillGoals={skillGoals}
            onAddToLearning={addSkillGoal}
          />
        )}

        {page === "about" && loading && (
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, color: "#A09890" }}>Loading…</p>
        )}
        {page === "about" && !loading && !profile && (
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, color: "#A09890" }}>Could not load profile. Please refresh.</p>
        )}
        {page === "about" && profile && (
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", paddingBottom: 40 }}>
            {/* Left column — resume-based sections */}
            <div style={{ flex: "0 0 auto", width: "min(600px, 100%)" }}>
              <ReadbackCard data={readback} loading={readbackLoading} onRefresh={refreshReadback} />
              <div ref={(el) => { sectionRefs.current.personal = el; }} style={{ background: "#FFFFFF", borderRadius: 12, padding: "24px 28px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 12 }}>
                <PersonalTab profile={profile} onSave={handlePersonalSave} />
              </div>
              <div style={{ background: "#FFFFFF", borderRadius: 12, padding: "24px 28px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 12 }}
                ref={(el) => { sectionRefs.current.education = el; }}>
                <EducationTab entries={education} onSave={handleEducationSave} />
              </div>
              <div style={{ background: "#FFFFFF", borderRadius: 12, padding: "24px 28px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 12 }}
                ref={(el) => { sectionRefs.current.experience = el; }}>
                <ExperienceTab entries={workExperience} onSave={handleExperienceSave} />
              </div>
              <div style={{ background: "#FFFFFF", borderRadius: 12, padding: "24px 28px", border: "1px solid rgba(0,0,0,0.07)", marginBottom: 12 }}
                ref={(el) => { sectionRefs.current.skills = el; }}>
                <SkillsTab skills={skills} onSave={handleSkillsSave} skillGoals={skillGoals} onGraduate={graduateSkill} />
              </div>
            </div>
            {/* Right column — career preferences */}
            <div style={{ flex: 1, minWidth: 260, maxWidth: 340 }}>
              <CareerPreferencesPanel profile={profile} onSave={handleCareerPrefSave} />
            </div>
          </div>
        )}

        {page === "learning" && (
          <LearningTab progress={upskillProgress} setProgress={setUpskillProgress} skillGoals={skillGoals} onGraduate={graduateSkill} targetRoles={dreamList} />
        )}

        {page === "assets" && !profile && !loading && (
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, color: "#A09890" }}>Could not load profile. Please refresh.</p>
        )}
        {page === "assets" && profile && (
          <AssetsTab resumeUrl={profile.resumeUrl} uploading={resumeUploading} onUpload={handleResumeUpload} inputRef={resumeInputRef} suggestions={profileSuggestions} suggestionsLoading={suggestionsLoading} />
        )}
      </div>
    </div>
  );
}
