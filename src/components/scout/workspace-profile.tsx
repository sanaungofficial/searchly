"use client";

import { useState, useEffect, useRef } from "react";

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

type ProfileTab = "personal" | "education" | "experience" | "skills";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, onEdit }: { title: string; onEdit?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-[#1C3A2F]">{title}</h3>
      {onEdit && (
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg hover:bg-[#E8D5A3]/40 transition-colors"
          aria-label={`Edit ${title}`}
        >
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
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 text-[#A09890] hover:text-[#52493F]">×</button>
      )}
    </span>
  );
}

// ─── Tab: Personal ────────────────────────────────────────────────────────────

function PersonalTab({ profile, onSave }: { profile: UserProfile; onSave: (patch: Partial<UserProfile> & { parsedData?: Partial<ParsedData> }) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.parsedData?.phone || "");
  const [location, setLocation] = useState(profile.parsedData?.location || "");
  const [website, setWebsite] = useState(profile.parsedData?.website || "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      name,
      linkedinUrl: linkedinUrl || null,
      parsedData: { phone: phone || null, location: location || null, website: website || null },
    });
    setSaving(false);
    setEditing(false);
  };

  const fields: { label: string; value: string; set?: (v: string) => void; href?: string }[] = [
    { label: "Email", value: profile.email || "—" },
    { label: "Phone", value: phone || "—", set: setPhone },
    { label: "Location", value: location || "—", set: setLocation },
    { label: "LinkedIn", value: linkedinUrl || "—", set: setLinkedinUrl, href: linkedinUrl || undefined },
    { label: "Website", value: website || "—", set: setWebsite, href: website || undefined },
  ];

  return (
    <div>
      <SectionHeader title="Personal Information" onEdit={() => setEditing(!editing)} />

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#A09890] mb-1">Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
          </div>
          <div>
            <label className="block text-xs text-[#A09890] mb-1">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
          </div>
          <div>
            <label className="block text-xs text-[#A09890] mb-1">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
          </div>
          <div>
            <label className="block text-xs text-[#A09890] mb-1">LinkedIn URL</label>
            <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
          </div>
          <div>
            <label className="block text-xs text-[#A09890] mb-1">Website</label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-lg hover:bg-[#1C3A2F]/90 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)}
              className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F2EDE3] rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Avatar + name row */}
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
                  className="text-sm text-[#1C3A2F] underline underline-offset-2 break-all">
                  {value}
                </a>
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

  const addEntry = () => setList((prev) => [...prev, { id: `edu_${Date.now()}`, school: "", degree: "", field: "", from: "", to: "" }]);
  const removeEntry = (id: string) => setList((prev) => prev.filter((e) => e.id !== id));
  const updateEntry = (id: string, key: keyof EducationEntry, value: string) =>
    setList((prev) => prev.map((e) => e.id === id ? { ...e, [key]: value } : e));

  const handleSave = async () => {
    setSaving(true);
    await onSave(list);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <SectionHeader title="Education" />
        <div className="space-y-4">
          {list.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-[#E5DDD0] p-3 space-y-2 relative">
              <button onClick={() => removeEntry(entry.id)} className="absolute top-2 right-2 text-[#C0B8B0] hover:text-[#52493F] text-base leading-none">×</button>
              <div>
                <label className="block text-xs text-[#A09890] mb-1">School</label>
                <input value={entry.school} onChange={(e) => updateEntry(entry.id, "school", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-[#A09890] mb-1">Degree</label>
                  <input value={entry.degree} onChange={(e) => updateEntry(entry.id, "degree", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
                </div>
                <div>
                  <label className="block text-xs text-[#A09890] mb-1">Field of Study</label>
                  <input value={entry.field || ""} onChange={(e) => updateEntry(entry.id, "field", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-[#A09890] mb-1">From (YYYY-MM)</label>
                  <input value={entry.from || ""} onChange={(e) => updateEntry(entry.id, "from", e.target.value)} placeholder="2018-09"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
                </div>
                <div>
                  <label className="block text-xs text-[#A09890] mb-1">To (YYYY-MM or Present)</label>
                  <input value={entry.to || ""} onChange={(e) => updateEntry(entry.id, "to", e.target.value)} placeholder="2022-05"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
                </div>
              </div>
            </div>
          ))}
          <button onClick={addEntry} className="w-full py-2 text-xs text-[#1C3A2F] border border-dashed border-[#C0B8B0] rounded-lg hover:border-[#1C3A2F]/40 transition-colors">
            + Add education
          </button>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-lg hover:bg-[#1C3A2F]/90 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setList(entries); setEditing(false); }}
              className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F2EDE3] rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Education" onEdit={() => setEditing(true)} />
      {entries.length === 0 ? (
        <EmptyState message="No education added yet" sub="Upload your resume and we'll fill this in automatically." />
      ) : (
        <div className="space-y-4">
          {entries.map((entry, i) => (
            <div key={entry.id} className="flex gap-3">
              {/* timeline dot */}
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-[#E8D5A3] mt-1 shrink-0" />
                {i < entries.length - 1 && <div className="w-px flex-1 bg-[#E5DDD0] mt-1" />}
              </div>
              <div className="pb-4">
                <p className="text-sm font-semibold text-[#1C3A2F]">{entry.school}</p>
                <p className="text-xs text-[#52493F] mt-0.5">
                  {entry.degree}{entry.field ? `, ${entry.field}` : ""}
                </p>
                {formatDateRange(entry.from, entry.to) && (
                  <p className="text-xs text-[#A09890] mt-0.5">{formatDateRange(entry.from, entry.to)}</p>
                )}
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

  const addEntry = () => setList((prev) => [...prev, { id: `exp_${Date.now()}`, company: "", title: "", description: "", from: "", to: "", bullets: [] }]);
  const removeEntry = (id: string) => setList((prev) => prev.filter((e) => e.id !== id));
  const updateEntry = (id: string, key: keyof WorkEntry, value: string) =>
    setList((prev) => prev.map((e) => e.id === id ? { ...e, [key]: value } : e));
  const updateBullets = (id: string, value: string) =>
    setList((prev) => prev.map((e) => e.id === id ? { ...e, bullets: value.split("\n").filter(Boolean) } : e));

  const handleSave = async () => {
    setSaving(true);
    await onSave(list);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <SectionHeader title="Work Experience" />
        <div className="space-y-4">
          {list.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-[#E5DDD0] p-3 space-y-2 relative">
              <button onClick={() => removeEntry(entry.id)} className="absolute top-2 right-2 text-[#C0B8B0] hover:text-[#52493F] text-base leading-none">×</button>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-[#A09890] mb-1">Company</label>
                  <input value={entry.company} onChange={(e) => updateEntry(entry.id, "company", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
                </div>
                <div>
                  <label className="block text-xs text-[#A09890] mb-1">Title</label>
                  <input value={entry.title} onChange={(e) => updateEntry(entry.id, "title", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-[#A09890] mb-1">From (YYYY-MM)</label>
                  <input value={entry.from || ""} onChange={(e) => updateEntry(entry.id, "from", e.target.value)} placeholder="2020-01"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
                </div>
                <div>
                  <label className="block text-xs text-[#A09890] mb-1">To (YYYY-MM or Present)</label>
                  <input value={entry.to || ""} onChange={(e) => updateEntry(entry.id, "to", e.target.value)} placeholder="Present"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#A09890] mb-1">Bullet points (one per line)</label>
                <textarea rows={4} value={entry.bullets.join("\n")} onChange={(e) => updateBullets(entry.id, e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F] resize-none" />
              </div>
            </div>
          ))}
          <button onClick={addEntry} className="w-full py-2 text-xs text-[#1C3A2F] border border-dashed border-[#C0B8B0] rounded-lg hover:border-[#1C3A2F]/40 transition-colors">
            + Add experience
          </button>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-lg hover:bg-[#1C3A2F]/90 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setList(entries); setEditing(false); }}
              className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F2EDE3] rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                        <span className="mt-1 w-1 h-1 rounded-full bg-[#A09890] shrink-0" />
                        {b}
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

// ─── Tab: Skills ──────────────────────────────────────────────────────────────

function SkillsTab({ skills, onSave }: { skills: string[]; onSave: (skills: string[]) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState<string[]>(skills);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const addSkill = () => {
    const v = input.trim();
    if (v && !list.includes(v)) setList((prev) => [...prev, v]);
    setInput("");
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(list);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div>
      <SectionHeader title="Skills" onEdit={() => setEditing(!editing)} />
      {!editing && skills.length === 0 && (
        <EmptyState message="No skills yet" sub="Upload your resume to extract your skills automatically." />
      )}
      {editing ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
              placeholder="Add a skill and press Enter"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-[#E5DDD0] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#1C3A2F]/30 text-[#1C3A2F]"
            />
            <button onClick={addSkill} className="px-3 py-2 text-xs bg-[#1C3A2F] text-[#F2EDE3] rounded-lg hover:bg-[#1C3A2F]/90">Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {list.map((s) => (
              <SkillChip key={s} label={s} onRemove={() => setList((prev) => prev.filter((x) => x !== s))} />
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 text-xs font-medium bg-[#1C3A2F] text-[#F2EDE3] rounded-lg hover:bg-[#1C3A2F]/90 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setList(skills); setEditing(false); }}
              className="px-4 py-1.5 text-xs font-medium text-[#52493F] hover:bg-[#F2EDE3] rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => <SkillChip key={s} label={s} />)}
          </div>
        )
      )}
    </div>
  );
}

// ─── Right Panel ──────────────────────────────────────────────────────────────

function RightPanel({ profile, onResumeUpload }: { profile: UserProfile; onResumeUpload: (f: File) => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onResumeUpload(file);
    setUploading(false);
    e.target.value = "";
  };

  const pd = profile.parsedData;
  const totalFields = 5;
  let filled = 0;
  if (profile.name && profile.name !== "You") filled++;
  if (profile.parsedData?.phone) filled++;
  if (profile.parsedData?.location) filled++;
  if ((pd?.education?.length ?? 0) > 0) filled++;
  if ((pd?.workExperience?.length ?? 0) > 0) filled++;
  const completeness = Math.round((filled / totalFields) * 100);

  return (
    <div className="space-y-4">
      {/* Completeness */}
      <div className="rounded-xl border border-[#E5DDD0] bg-[#FFFDF9] p-4">
        <p className="text-xs font-semibold text-[#1C3A2F] mb-2">Profile completeness</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-[#E5DDD0] overflow-hidden">
            <div className="h-full rounded-full bg-[#1C3A2F] transition-all" style={{ width: `${completeness}%` }} />
          </div>
          <span className="text-xs text-[#52493F] font-medium">{completeness}%</span>
        </div>
        {completeness < 100 && (
          <p className="text-xs text-[#A09890] mt-2">
            {profile.resumeUrl ? "Edit your profile to fill in missing fields." : "Upload your resume to auto-populate your profile."}
          </p>
        )}
      </div>

      {/* Resume */}
      <div className="rounded-xl border border-[#E5DDD0] bg-[#FFFDF9] p-4 space-y-2">
        <p className="text-xs font-semibold text-[#1C3A2F]">Resume</p>
        {profile.resumeUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F2EDE3]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="1" width="10" height="14" rx="1.5" fill="#E8D5A3" />
                <path d="M5 5h6M5 8h6M5 11h4" stroke="#1C3A2F" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span className="text-xs text-[#52493F] flex-1 truncate">resume.pdf</span>
              <a href={profile.resumeUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#1C3A2F] underline underline-offset-1 hover:no-underline shrink-0">View</a>
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-full py-1.5 text-xs text-[#52493F] border border-dashed border-[#C0B8B0] rounded-lg hover:border-[#1C3A2F]/40 transition-colors disabled:opacity-50">
              {uploading ? "Uploading…" : "Replace resume"}
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full py-2 text-xs text-[#1C3A2F] border border-dashed border-[#C0B8B0] rounded-lg hover:border-[#1C3A2F]/40 transition-colors disabled:opacity-50">
            {uploading ? "Uploading…" : "+ Upload resume"}
          </button>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleFile} />
      </div>

      {/* LinkedIn quick link */}
      {profile.linkedinUrl && (
        <div className="rounded-xl border border-[#E5DDD0] bg-[#FFFDF9] p-4">
          <p className="text-xs font-semibold text-[#1C3A2F] mb-2">LinkedIn</p>
          <a href={profile.linkedinUrl.startsWith("http") ? profile.linkedinUrl : `https://${profile.linkedinUrl}`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-[#1C3A2F] underline underline-offset-2 break-all hover:no-underline">
            {profile.linkedinUrl}
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "personal", label: "Personal" },
  { id: "education", label: "Education" },
  { id: "experience", label: "Experience" },
  { id: "skills", label: "Skills" },
];

export function WorkspaceProfile() {
  const [tab, setTab] = useState<ProfileTab>("personal");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setProfile(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const patchProfile = async (patch: Record<string, unknown>) => {
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      // best-effort
    }
  };

  const handlePersonalSave = async (patch: Partial<UserProfile> & { parsedData?: Partial<ParsedData> }) => {
    if (!profile) return;
    const { parsedData: pdPatch, ...rest } = patch;
    const newParsedData = pdPatch
      ? { ...(profile.parsedData || { education: [], workExperience: [], skills: [] }), ...pdPatch }
      : profile.parsedData;
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
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/resume", { method: "POST", body: form });
      const data = await res.json();
      if (data.url) {
        // Re-fetch profile to get updated parsedData
        const profileRes = await fetch("/api/profile");
        const profileData = await profileRes.json();
        if (!profileData.error) setProfile(profileData);
        else setProfile((p) => p ? { ...p, resumeUrl: data.url } : p);
      }
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#E5DDD0] border-t-[#1C3A2F] rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[#A09890]">Could not load profile.</p>
      </div>
    );
  }

  const pd = profile.parsedData;
  const education = pd?.education || [];
  const workExperience = pd?.workExperience || [];
  const skills = pd?.skills || [];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto w-full">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[#E5DDD0]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? "border-[#1C3A2F] text-[#1C3A2F]"
                  : "border-transparent text-[#A09890] hover:text-[#52493F]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content + sidebar */}
        <div className="flex gap-6">
          {/* Main panel */}
          <div className="flex-1 min-w-0 rounded-xl border border-[#E5DDD0] bg-[#FFFDF9] p-5">
            {tab === "personal" && (
              <PersonalTab profile={profile} onSave={handlePersonalSave} />
            )}
            {tab === "education" && (
              <EducationTab entries={education} onSave={handleEducationSave} />
            )}
            {tab === "experience" && (
              <ExperienceTab entries={workExperience} onSave={handleExperienceSave} />
            )}
            {tab === "skills" && (
              <SkillsTab skills={skills} onSave={handleSkillsSave} />
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-56 shrink-0">
            <RightPanel profile={profile} onResumeUpload={handleResumeUpload} />
          </div>
        </div>
      </div>
    </div>
  );
}
