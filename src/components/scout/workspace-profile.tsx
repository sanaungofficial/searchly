"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  SKILLS_LIST,
  PROFILE_SUGGESTIONS,
  ROLE_ARCHETYPES,
  AVAILABLE_ROLES,
  UPSKILL_CATEGORIES,
} from "./workspace-data";
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
            <button onClick={() => setEditing(false)} className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F2EDE3] rounded-lg">Cancel</button>
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
          <button onClick={() => { setList(entries); setEditing(false); }} className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F2EDE3] rounded-lg">Cancel</button>
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
          <button onClick={() => { setList(entries); setEditing(false); }} className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F2EDE3] rounded-lg">Cancel</button>
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

function SkillsTab({ skills, onSave }: { skills: string[]; onSave: (skills: string[]) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState<string[]>(skills);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const addSkill = () => { const v = input.trim(); if (v && !list.includes(v)) setList((p) => [...p, v]); setInput(""); };
  const handleSave = async () => { setSaving(true); await onSave(list); setSaving(false); setEditing(false); };

  return (
    <div>
      <SectionHeader title="Skills" onEdit={() => setEditing(!editing)} />
      {!editing && skills.length === 0 && (
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
            <button onClick={() => { setList(skills); setEditing(false); }} className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F2EDE3] rounded-lg">Cancel</button>
          </div>
        </div>
      ) : (
        skills.length > 0 && <div className="flex flex-wrap gap-2">{skills.map((s) => <SkillChip key={s} label={s} />)}</div>
      )}
    </div>
  );
}

// ─── Tab: Dream Role (original) ───────────────────────────────────────────────

function DreamRoleTab({ dreamList, setDreamList, dreamSelectedId, setDreamSelectedId, adding, setAdding }: {
  dreamList: string[];
  setDreamList: (l: string[]) => void;
  dreamSelectedId: number | null;
  setDreamSelectedId: (n: number | null) => void;
  adding: boolean;
  setAdding: (b: boolean) => void;
}) {
  const skillsSet = new Set(SKILLS_LIST);
  const topMap: Record<number, string[]> = { 1: ["50%"], 2: ["28%", "72%"], 3: ["13%", "50%", "87%"] };
  const tps = topMap[dreamList.length] || topMap[3];

  const addRole = (title: string) => {
    if (dreamList.includes(title) || dreamList.length >= 3) { setAdding(false); return; }
    setDreamList([...dreamList, title]);
    setAdding(false);
    setDreamSelectedId(null);
  };
  const removeRole = (idx: number) => { setDreamList(dreamList.filter((_, i) => i !== idx)); setDreamSelectedId(null); };

  return (
    <div style={{ paddingBottom: 40 }}>
      {dreamSelectedId !== null && dreamList[dreamSelectedId] && (
        <DreamRoleDetail title={dreamList[dreamSelectedId]} skillsSet={skillsSet} onClose={() => setDreamSelectedId(null)} />
      )}
      {dreamSelectedId === null && (
        <>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#52493F", marginBottom: 20, maxWidth: 580, lineHeight: 1.6 }}>
            Pick up to three roles you&apos;re aiming for. Searchly will measure the gap, surface roles that match, and build a learning path to bridge what&apos;s missing.
          </p>
          <div style={{ position: "relative", height: 220, marginBottom: 24 }}>
            {dreamList.map((title, i) => {
              const arch = ROLE_ARCHETYPES[title];
              if (!arch) return null;
              const matched = arch.requires.filter((r) => skillsSet.has(r));
              const readiness = Math.round((matched.length / arch.requires.length) * 100);
              const rc = readiness >= 75 ? "#4A8B6A" : readiness >= 50 ? "#C4A86A" : "#A09890";
              return (
                <button key={title} onClick={() => setDreamSelectedId(i)} style={{ position: "absolute", top: 0, left: `${tps[i]}`, transform: "translateX(-50%)", width: 200, background: "#FFFFFF", borderRadius: 10, padding: "16px 16px 14px", border: `1.5px solid ${arch.color}30`, boxShadow: "0 4px 16px rgba(0,0,0,0.07)", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: arch.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <span style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 600 }}>{readiness}%</span>
                  </div>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginBottom: 4 }}>{title}</p>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: rc, marginBottom: 8 }}>
                    {readiness >= 75 ? "Strong foundation" : readiness >= 50 ? "Good progress" : "Building toward"}
                  </p>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#7A7268" }}>{arch.openRolesLabel}</p>
                  <button onClick={(e) => { e.stopPropagation(); removeRole(i); }} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#A09890", padding: 0, lineHeight: 1 }}>x</button>
                </button>
              );
            })}
          </div>
          <div>
            {!adding ? (
              dreamList.length < 3 && (
                <button onClick={() => setAdding(true)} style={{ padding: "10px 18px", background: "transparent", color: "#1A3A2F", border: "1px solid rgba(26,58,47,0.2)", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, cursor: "pointer" }}>+ Add a role</button>
              )
            ) : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {AVAILABLE_ROLES.filter((r) => !dreamList.includes(r)).map((r) => (
                  <button key={r} onClick={() => addRole(r)} style={{ padding: "6px 14px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#1A1A1A", cursor: "pointer" }}>{r}</button>
                ))}
                <button onClick={() => setAdding(false)} style={{ padding: "6px 12px", background: "transparent", border: "none", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#A09890", cursor: "pointer" }}>Cancel</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DreamRoleDetail({ title, skillsSet, onClose }: { title: string; skillsSet: Set<string>; onClose: () => void }) {
  const arch = ROLE_ARCHETYPES[title];
  if (!arch) return null;
  const matched = arch.requires.filter((r) => skillsSet.has(r));
  const needed = arch.requires.filter((r) => !skillsSet.has(r));
  const readiness = Math.round((matched.length / arch.requires.length) * 100);
  return (
    <div style={{ paddingBottom: 40, animation: "fadeIn 0.3s ease both" }}>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#1A3A2F", padding: 0, marginBottom: 16 }}>&larr; Back to roles</button>
      <div style={{ background: "#FFFFFF", borderRadius: 10, padding: 28, border: `2px solid ${arch.color}`, boxShadow: "0 4px 16px rgba(0,0,0,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: arch.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#FFFFFF", fontSize: 18, fontWeight: 600 }}>{readiness}%</span>
          </div>
          <div>
            <h2 style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 28, fontWeight: 500, color: "#1A1A1A", fontStyle: "italic" }}>{title}</h2>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#7A7268", marginTop: 2 }}>{arch.openRolesLabel}</p>
          </div>
        </div>
        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 300, color: "#52493F", lineHeight: 1.65, marginBottom: 22 }}>{arch.description}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#4A8B6A", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>You have ({matched.length})</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {matched.map((s) => <span key={s} style={{ padding: "5px 11px", background: "rgba(74,139,106,0.08)", borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#2D6B4A" }}>{s}</span>)}
            </div>
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#C4A86A", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>You&apos;ll need ({needed.length})</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {needed.map((s) => <span key={s} style={{ padding: "5px 11px", background: "rgba(196,168,106,0.1)", borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#7A6020" }}>{s}</span>)}
            </div>
          </div>
        </div>
        <button style={{ padding: "12px 22px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: 6, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <SparkleIcon /> Run Searchly gap analysis &rarr;
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Learning Path (original) ────────────────────────────────────────────

function LearningTab({ progress, setProgress }: {
  progress: Record<number, "none" | "inprogress" | "completed">;
  setProgress: (p: Record<number, "none" | "inprogress" | "completed">) => void;
}) {
  const doneCount = Object.values(progress).filter((v) => v === "completed").length;
  const total = UPSKILL_CATEGORIES.reduce((a, c) => a + c.items.length, 0);
  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ background: "#1A3A2F", borderRadius: 10, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "rgba(232,213,163,0.5)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Your learning progress</p>
          <p style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 18, fontWeight: 500, color: "#E8D5A3" }}>{doneCount} of {total} complete</p>
        </div>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: `conic-gradient(#E8D5A3 ${(doneCount / total) * 360}deg, rgba(232,213,163,0.15) 0)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#1A3A2F", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 14, fontWeight: 500, color: "#E8D5A3" }}>{Math.round((doneCount / total) * 100)}%</span>
          </div>
        </div>
      </div>
      {UPSKILL_CATEGORIES.map((cat) => (
        <div key={cat.title} style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 600, color: "#1A1A1A", marginBottom: 4 }}>{cat.title}</p>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#7A7268", marginBottom: 10 }}>{cat.subtitle}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cat.items.map((item) => {
              const prog = progress[item.id] || "none";
              const statusLabel = prog === "completed" ? "Completed ✓" : prog === "inprogress" ? "In progress" : "Not started";
              const statusColor = prog === "completed" ? "#4A8B6A" : prog === "inprogress" ? "#C4A86A" : "#A09890";
              return (
                <div key={item.id} style={{ background: "#FFFFFF", borderRadius: 8, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 7, background: item.platformColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 700, color: "#FFFFFF" }}>{item.platformInitial}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>{item.name}</p>
                      {item.scoutPick && <span style={{ padding: "1px 7px", background: "rgba(196,168,106,0.15)", borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, color: "#7A6020", fontWeight: 600 }}>Searchly pick</span>}
                    </div>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#7A7268", marginBottom: 3 }}>{item.platform} &middot; {item.duration} &middot; {item.credential}</p>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: statusColor }}>{statusLabel}</p>
                  </div>
                  <button onClick={() => setProgress({ ...progress, [item.id]: prog === "none" ? "inprogress" : prog === "inprogress" ? "completed" : "inprogress" })}
                    style={{ padding: "7px 14px", background: prog === "completed" ? "rgba(74,139,106,0.1)" : "#1A3A2F", color: prog === "completed" ? "#4A8B6A" : "#E8D5A3", border: "none", borderRadius: 5, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>
                    {prog === "completed" ? "Review →" : prog === "inprogress" ? "Complete →" : "Start →"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
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

const RESUME_REPORT = {
  grade: "B",
  gradeLabel: "GOOD",
  score: 74,
  urgent: 2,
  critical: 3,
  optional: 5,
  categories: [
    {
      name: "Relevance",
      status: "critical" as const,
      issues: [
        { severity: "urgent" as const, title: "Summary doesn't match target roles", fix: "Rewrite your summary to explicitly name Product Management, Strategy, or Operations — recruiters skim the top 3 lines first." },
        { severity: "critical" as const, title: "Missing keywords from JD", fix: "Add terms like 'cross-functional alignment', 'north-star metrics', and 'GTM partnership' — these appear in 80%+ of PM/Strategy JDs." },
      ],
    },
    {
      name: "Impact & Achievements",
      status: "urgent" as const,
      issues: [
        { severity: "urgent" as const, title: "Bullets lack quantified outcomes", fix: "Convert 'Led team to improve onboarding' → 'Led onboarding redesign that reduced time-to-value by 34% for 2,400 SMB accounts.'" },
        { severity: "critical" as const, title: "Action verbs are weak", fix: "Replace 'Helped', 'Assisted', 'Supported' with 'Owned', 'Drove', 'Launched', 'Negotiated'. You're underselling ownership." },
        { severity: "critical" as const, title: "No scope signals", fix: "Add team size, budget, or ARR context to at least 3 bullets. Hiring committees need scale to assess level." },
      ],
    },
    {
      name: "Brevity & Effectiveness",
      status: "optional" as const,
      issues: [
        { severity: "optional" as const, title: "Most recent role is over-indexed", fix: "You have 7 bullets for your current role and 2 for the one before. Even out to 4–5 per role — recency bias is already built in." },
        { severity: "optional" as const, title: "Education section placement", fix: "For 8+ years experience, move Education below Experience. ATS and recruiter eye-tracking both favor this." },
        { severity: "optional" as const, title: "Skills section is generic", fix: "Remove 'Microsoft Office', 'PowerPoint'. Add specific tools: 'Figma (design reviews)', 'Looker (self-serve analytics)', 'Notion (roadmap ops)'." },
        { severity: "optional" as const, title: "Contact info formatting", fix: "Add LinkedIn URL and city/state. Remove full street address — it's outdated and a privacy risk." },
        { severity: "optional" as const, title: "File name is not recruiter-friendly", fix: "Rename to 'FirstName-LastName-Resume-2026.pdf' before uploading to portals." },
      ],
    },
  ],
};

function AssetsTab({ resumeUrl, uploading, onUpload, inputRef }: {
  resumeUrl: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState<string | null>(null);
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
      return decoded.replace(/^resume-\d+\./, "resume.") || "Resume";
    } catch {
      return "Resume";
    }
  }

  const gradeColor = RESUME_REPORT.grade === "A" ? "#2D6B4A" : RESUME_REPORT.grade === "B" ? "#C4A86A" : "#C4574A";
  const gradeBg = RESUME_REPORT.grade === "A" ? "rgba(45,107,74,0.08)" : RESUME_REPORT.grade === "B" ? "rgba(196,168,106,0.1)" : "rgba(196,87,74,0.08)";

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 16, fontWeight: 700, color: "#1A1A1A", margin: 0, letterSpacing: "-0.2px" }}>RESUME</h2>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#6B6258", marginTop: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#4A8B6A", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>
              </span>
              You have {resumes.length} resume{resumes.length !== 1 ? "s" : ""} saved out of {MAX_SLOTS} available slots.
            </span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ padding: "8px 16px", background: "#F0FFF8", color: "#1A7A4A", border: "1px solid #A8DFC0", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            ⚡ Upgrade to Turbo: Get Hired Faster ›
          </button>
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            style={{ padding: "8px 16px", background: "#FFFFFF", color: "#1A1A1A", border: "1px solid #D8D0C5", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: uploading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 5, opacity: uploading ? 0.6 : 1 }}>
            {uploading ? "Uploading…" : "+ Add Resume"}
          </button>
        </div>
      </div>

      {/* Resume rows */}
      {resumes.length === 0 ? (
        <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E5DDD0", padding: "48px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, color: "#A09890" }}>No resume uploaded yet.</p>
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            style={{ marginTop: 12, padding: "10px 20px", background: "#1C3A2F", color: "#E8D5A3", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Add Resume
          </button>
        </div>
      ) : (
        resumes.map((r) => (
          <div key={r.id} style={{ marginBottom: 16 }}>
            {/* Card */}
            <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E5DDD0", overflow: "hidden" }}>
              <div style={{ padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                {/* Grade circle */}
                {r.analysisComplete && (
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: gradeBg, border: `2px solid ${gradeColor}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 22, fontWeight: 700, color: gradeColor, lineHeight: 1 }}>{RESUME_REPORT.grade}</span>
                    </div>
                    <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 700, color: gradeColor, letterSpacing: "0.5px" }}>{RESUME_REPORT.gradeLabel}</span>
                  </div>
                )}

                {/* Name + fix counts */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>{r.name}</span>
                    {r.isPrimary && (
                      <span style={{ padding: "2px 8px", background: "#FFF8E8", border: "1px solid #E8D5A3", borderRadius: 100, fontSize: 10, fontWeight: 600, color: "#A08030" }}>★ PRIMARY</span>
                    )}
                  </div>
                  {r.analysisComplete && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "rgba(196,87,74,0.1)", color: "#C4574A", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C4574A", flexShrink: 0 }} />
                        {RESUME_REPORT.urgent} URGENT
                      </span>
                      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "rgba(196,168,106,0.12)", color: "#8B6B0A", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C4A86A", flexShrink: 0 }} />
                        {RESUME_REPORT.critical} CRITICAL
                      </span>
                      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "rgba(160,152,144,0.1)", color: "#7A7268", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#A09890", flexShrink: 0 }} />
                        {RESUME_REPORT.optional} OPTIONAL
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#A09890" }}>Modified {timeAgo(r.updatedAt)}</span>
                    <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#A09890" }}>Added {timeAgo(r.createdAt)}</span>
                    {r.targetJobTitle && <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#52493F" }}>Target: {r.targetJobTitle}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  {r.analysisComplete && (
                    <button
                      onClick={() => setReportOpen(reportOpen === r.id ? null : r.id)}
                      style={{ padding: "7px 14px", background: reportOpen === r.id ? "#1C3A2F" : "transparent", color: reportOpen === r.id ? "#E8D5A3" : "#1C3A2F", border: "1px solid rgba(28,58,47,0.25)", borderRadius: 6, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      {reportOpen === r.id ? "Hide Report ▲" : "View Full Report ▼"}
                    </button>
                  )}
                  <div style={{ position: "relative" }}>
                    <button onClick={() => setMenuOpen(menuOpen === r.id ? null : r.id)}
                      style={{ background: "none", border: "1px solid #E5DDD0", cursor: "pointer", fontSize: 16, color: "#A09890", padding: "6px 10px", borderRadius: 6 }}>···</button>
                    {menuOpen === r.id && (
                      <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#FFFFFF", border: "1px solid #E5DDD0", borderRadius: 7, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 160, zIndex: 100, overflow: "hidden" }}>
                        {[
                          { label: "View resume", action: () => { window.open(r.url, "_blank"); setMenuOpen(null); } },
                          { label: "Replace resume", action: () => { inputRef.current?.click(); setMenuOpen(null); } },
                          { label: "Download", action: () => { window.open(r.url, "_blank"); setMenuOpen(null); } },
                        ].map((item) => (
                          <button key={item.label} onClick={item.action}
                            style={{ width: "100%", padding: "10px 14px", textAlign: "left", background: "none", border: "none", fontSize: 13, color: "#1A1A1A", cursor: "pointer", display: "block", borderBottom: "1px solid #F5F3EF" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F3EF")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline report panel */}
              {reportOpen === r.id && (
                <div style={{ borderTop: "1px solid #E5DDD0", padding: "20px 20px 24px", background: "#FAFAF8", animation: "fadeIn 0.2s ease both" }}>
                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 16 }}>Analysis Report</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {RESUME_REPORT.categories.map((cat) => {
                      const catColor = cat.status === "urgent" ? "#C4574A" : cat.status === "critical" ? "#8B6B0A" : "#7A7268";
                      const catBg = cat.status === "urgent" ? "rgba(196,87,74,0.06)" : cat.status === "critical" ? "rgba(196,168,106,0.08)" : "rgba(160,152,144,0.06)";
                      return (
                        <div key={cat.name}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 700, color: "#1A1A1A" }}>{cat.name}</span>
                            <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: catBg, color: catColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>{cat.status}</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {cat.issues.map((issue, i) => {
                              const iColor = issue.severity === "urgent" ? "#C4574A" : issue.severity === "critical" ? "#8B6B0A" : "#7A7268";
                              return (
                                <div key={i} style={{ padding: "12px 14px", background: "#FFFFFF", borderRadius: 7, borderLeft: `2px solid ${iColor}` }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                                    <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 700, color: iColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>{issue.severity}</span>
                                    <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>{issue.title}</span>
                                  </div>
                                  <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#52493F", lineHeight: 1.55 }}>{issue.fix}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))
      )}

      {/* Searchly suggestions */}
      <div style={{ background: "#FFFFFF", borderRadius: 10, padding: "20px 24px", border: "1px solid rgba(0,0,0,0.06)", marginTop: 4 }}>
        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#C4A86A", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
          <SparkleIcon /> Searchly&apos;s suggestions
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PROFILE_SUGGESTIONS.map((s) => {
            const pColor = s.priority === "high" ? "#C4574A" : s.priority === "medium" ? "#C4A86A" : "#A09890";
            const pBg = s.priority === "high" ? "rgba(196,87,74,0.08)" : s.priority === "medium" ? "rgba(196,168,106,0.1)" : "rgba(0,0,0,0.05)";
            return (
              <div key={s.id} style={{ padding: "12px 14px", background: pBg, borderRadius: 6, borderLeft: `2px solid ${pColor}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: pColor, textTransform: "uppercase", letterSpacing: "1px" }}>{s.priority} &middot; {s.category}</span>
                </div>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginBottom: 4 }}>{s.title}</p>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#52493F", lineHeight: 1.55, marginBottom: 4 }}>{s.detail}</p>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#4A8B6A", fontStyle: "italic" }}>&rarr; {s.impact}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type PageTab = "dreamrole" | "about" | "learning" | "assets";
type AboutSection = "personal" | "education" | "experience" | "skills";

const ABOUT_SECTIONS: AboutSection[] = ["personal", "education", "experience", "skills"];
const ABOUT_LABEL: Record<AboutSection, string> = { personal: "Personal", education: "Education", experience: "Experience", skills: "Skills" };

export function WorkspaceProfile() {
  const [page, setPage] = useState<PageTab>("about");
  const [activeSection, setActiveSection] = useState<AboutSection>("personal");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dreamList, setDreamList] = useState<string[]>(["VP of Product", "Head of Product Operations"]);
  const [dreamSelectedId, setDreamSelectedId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [upskillProgress, setUpskillProgress] = useState<Record<number, "none" | "inprogress" | "completed">>({});
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<AboutSection, HTMLDivElement | null>>({ personal: null, education: null, experience: null, skills: null });

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => { if (!data.error) setProfile(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    setPage("about");
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

  const PAGE_TABS: { id: PageTab | AboutSection; label: string; isSection?: boolean }[] = [
    ...ABOUT_SECTIONS.map((s) => ({ id: s as PageTab | AboutSection, label: ABOUT_LABEL[s], isSection: true })),
    { id: "dreamrole", label: "Dream Role" },
    { id: "learning", label: "Learning Path" },
    { id: "assets", label: "Resume Assets" },
  ];

  const isAboutActive = page === "about";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#F2EDE3", animation: "fadeIn 0.3s ease both" }}>
      <div ref={scrollRef} style={{ padding: "20px 32px 0", overflowY: "auto", flex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 500, color: "#A09890", letterSpacing: "1.1px", textTransform: "uppercase", marginBottom: 8 }}>
            {loading ? "Loading…" : profile ? (profile.name || profile.email || "Your profile") : "Your profile"}
            {profile?.headline ? ` · ${profile.headline}` : ""}
          </p>
          <h1 style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 32, fontWeight: 500, fontStyle: "italic", color: "#1A1A1A", letterSpacing: "-0.3px" }}>
            Your profile, through Searchly&apos;s eyes.
          </h1>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid rgba(0,0,0,0.08)", overflowX: "auto" }}>
          {PAGE_TABS.map(({ id, label, isSection }) => {
            const active = isSection
              ? isAboutActive && activeSection === id
              : page === id;
            return (
              <button
                key={id}
                onClick={() => {
                  if (isSection) {
                    goToSection(id as AboutSection);
                  } else {
                    setPage(id as PageTab);
                  }
                }}
                style={{ padding: "8px 16px", border: "none", borderRadius: "6px 6px 0 0", background: active ? "#1A3A2F" : "transparent", color: active ? "#E8D5A3" : "#52493F", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {page === "dreamrole" && (
          <DreamRoleTab dreamList={dreamList} setDreamList={setDreamList} dreamSelectedId={dreamSelectedId} setDreamSelectedId={setDreamSelectedId} adding={adding} setAdding={setAdding} />
        )}

        {page === "about" && loading && (
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#A09890" }}>Loading…</p>
        )}
        {page === "about" && !loading && !profile && (
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#A09890" }}>Could not load profile. Please refresh.</p>
        )}
        {page === "about" && profile && (() => {
          const completionItems: { label: string; done: boolean; section: AboutSection | null; weight: number }[] = [
            { label: "Full name", done: !!profile.name, section: "personal", weight: 10 },
            { label: "Email", done: !!profile.email, section: "personal", weight: 10 },
            { label: "LinkedIn URL", done: !!profile.linkedinUrl, section: "personal", weight: 10 },
            { label: "Phone & location", done: !!(pd?.phone && pd?.location), section: "personal", weight: 5 },
            { label: "Education history", done: education.length > 0, section: "education", weight: 10 },
            { label: "Work experience", done: workExperience.length > 0, section: "experience", weight: 20 },
            { label: "Experience bullets", done: workExperience.some((e) => e.bullets.length > 0), section: "experience", weight: 15 },
            { label: "Skills added", done: skills.length >= 5, section: "skills", weight: 10 },
            { label: "Resume uploaded", done: !!profile.resumeUrl, section: null, weight: 10 },
          ];
          const score = completionItems.reduce((sum, i) => sum + (i.done ? i.weight : 0), 0);
          const circumference = 2 * Math.PI * 26;
          return (
            <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
              {/* Profile sections */}
              <div style={{ flex: 1, minWidth: 0, maxWidth: 560 }}>
                <div ref={(el) => { sectionRefs.current.personal = el; }} style={{ paddingBottom: 48 }}>
                  <PersonalTab profile={profile} onSave={handlePersonalSave} />
                </div>
                <div style={{ borderTop: "1px solid #E5DDD0", paddingTop: 40, paddingBottom: 48 }}
                  ref={(el) => { sectionRefs.current.education = el; }}>
                  <EducationTab entries={education} onSave={handleEducationSave} />
                </div>
                <div style={{ borderTop: "1px solid #E5DDD0", paddingTop: 40, paddingBottom: 48 }}
                  ref={(el) => { sectionRefs.current.experience = el; }}>
                  <ExperienceTab entries={workExperience} onSave={handleExperienceSave} />
                </div>
                <div style={{ borderTop: "1px solid #E5DDD0", paddingTop: 40, paddingBottom: 60 }}
                  ref={(el) => { sectionRefs.current.skills = el; }}>
                  <SkillsTab skills={skills} onSave={handleSkillsSave} />
                </div>
              </div>

              {/* Completion sidebar */}
              <div style={{ width: 230, flexShrink: 0, position: "sticky", top: 0 }}>
                <div style={{ background: "#FFFFFF", borderRadius: 12, border: "1px solid #E5DDD0", padding: "20px 18px", marginBottom: 12 }}>
                  {/* Score ring */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                    <div style={{ position: "relative", width: 60, height: 60, flexShrink: 0 }}>
                      <svg width="60" height="60" viewBox="0 0 60 60" style={{ transform: "rotate(-90deg)" }}>
                        <circle cx="30" cy="30" r="26" stroke="rgba(0,0,0,0.07)" strokeWidth="5" fill="none" />
                        <circle cx="30" cy="30" r="26" stroke={score >= 80 ? "#4A8B6A" : score >= 50 ? "#C4A86A" : "#C4574A"} strokeWidth="5" fill="none" strokeLinecap="round"
                          strokeDasharray={`${circumference * score / 100} ${circumference}`} />
                      </svg>
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 14, fontWeight: 700, color: score >= 80 ? "#4A8B6A" : score >= 50 ? "#C4A86A" : "#C4574A" }}>{score}%</span>
                      </div>
                    </div>
                    <div>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 700, color: "#1A1A1A", marginBottom: 2 }}>Profile strength</p>
                      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#7A7268" }}>
                        {score >= 80 ? "Looking strong" : score >= 50 ? "Almost there" : "Needs attention"}
                      </p>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {completionItems.map((item) => (
                      <div key={item.label}
                        onClick={() => item.section ? goToSection(item.section) : setPage("assets")}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: item.done ? "default" : "pointer", background: item.done ? "transparent" : "rgba(196,87,74,0.04)", transition: "background 0.1s" }}
                        onMouseEnter={(e) => { if (!item.done) e.currentTarget.style.background = "rgba(28,58,47,0.06)"; }}
                        onMouseLeave={(e) => { if (!item.done) e.currentTarget.style.background = "rgba(196,87,74,0.04)"; }}>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: item.done ? "#4A8B6A" : "rgba(0,0,0,0.06)", border: item.done ? "none" : "1.5px dashed #C0B8B0" }}>
                          {item.done && <span style={{ color: "#fff", fontSize: 9, fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: item.done ? "#7A7268" : "#1A1A1A", fontWeight: item.done ? 400 : 500, flex: 1, textDecoration: item.done ? "none" : "none" }}>{item.label}</span>
                        {!item.done && <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#1C3A2F", fontWeight: 600 }}>+{item.weight}%</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tip */}
                {score < 100 && (
                  <div style={{ background: "rgba(26,58,47,0.04)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(26,58,47,0.08)" }}>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#1C3A2F", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>Why it matters</p>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#52493F", lineHeight: 1.55 }}>
                      Complete profiles get {score < 60 ? "3–5×" : "1.5–2×"} more relevant job matches and higher resume tailoring accuracy.
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {page === "learning" && (
          <LearningTab progress={upskillProgress} setProgress={setUpskillProgress} />
        )}

        {page === "assets" && !profile && !loading && (
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#A09890" }}>Could not load profile. Please refresh.</p>
        )}
        {page === "assets" && profile && (
          <AssetsTab resumeUrl={profile.resumeUrl} uploading={resumeUploading} onUpload={handleResumeUpload} inputRef={resumeInputRef} />
        )}
      </div>
    </div>
  );
}
