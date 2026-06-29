"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collectUniqueTags,
  normalizeQaQuestion,
  parseTagsInput,
  type ApplicationQaEntry,
} from "@/lib/application-qa";
import {
  APPLICATION_QA_SUGGESTIONS,
  type ApplicationQaSuggestion,
} from "@/lib/application-qa-suggestions";
import {
  ScoutBox,
  ScoutPrimaryBtn,
  ScoutSecondaryBtn,
  scoutFieldStyle,
  scoutInsetChipStyle,
} from "./scout-box";
import { ScoutModal } from "./scout-modal";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

const line = border.line;

type FetchOpts = { q?: string; tag?: string };

async function fetchEntries(scopePath: (path: string) => string, opts: FetchOpts = {}) {
  const params = new URLSearchParams();
  if (opts.q?.trim()) params.set("q", opts.q.trim());
  if (opts.tag?.trim()) params.set("tag", opts.tag.trim());
  const qs = params.toString();
  const res = await fetch(scopePath(`/api/user/application-qa${qs ? `?${qs}` : ""}`), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load Q&A bank");
  const data = (await res.json()) as { entries: ApplicationQaEntry[] };
  return data.entries ?? [];
}

function TagChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...scoutInsetChipStyle,
        cursor: onClick ? "pointer" : "default",
        background: active ? "rgba(174,122,255,0.18)" : surface.inset,
        color: active ? color.ink : color.muted,
        fontWeight: active ? 600 : 500,
      }}
    >
      {label}
    </button>
  );
}

function CopyBtn({ label, onCopy }: { label: string; onCopy: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <ScoutSecondaryBtn
      onClick={() => {
        onCopy();
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      style={{ fontSize: 12, padding: "6px 10px" }}
    >
      {copied ? "Copied" : label}
    </ScoutSecondaryBtn>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

type EntryListProps = {
  entries: ApplicationQaEntry[];
  mode: "manage" | "browse";
  onEdit?: (entry: ApplicationQaEntry) => void;
  onDelete?: (id: string) => void;
};

function EntryList({ entries, mode, onEdit, onDelete }: EntryListProps) {
  if (entries.length === 0) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.55 }}>
        No entries yet — add common application questions and your best answers.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {entries.map((entry) => (
        <ScoutBox key={entry.id} padding={16} flat>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 8px", lineHeight: 1.45 }}>
            {entry.question}
          </p>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 10px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {entry.answer}
          </p>
          {entry.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {entry.tags.map((tag) => (
                <span key={tag} style={scoutInsetChipStyle}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <CopyBtn label="Copy answer" onCopy={() => void copyText(entry.answer)} />
            <CopyBtn
              label="Copy Q&A"
              onCopy={() => void copyText(`Q: ${entry.question}\n\nA: ${entry.answer}`)}
            />
            {mode === "manage" && onEdit && (
              <ScoutSecondaryBtn onClick={() => onEdit(entry)} style={{ fontSize: 12, padding: "6px 10px" }}>
                Edit
              </ScoutSecondaryBtn>
            )}
            {mode === "manage" && onDelete && (
              <ScoutSecondaryBtn onClick={() => onDelete(entry.id)} style={{ fontSize: 12, padding: "6px 10px" }}>
                Delete
              </ScoutSecondaryBtn>
            )}
          </div>
        </ScoutBox>
      ))}
    </div>
  );
}

type SearchFilterProps = {
  search: string;
  onSearchChange: (value: string) => void;
  tags: string[];
  activeTag: string | null;
  onTagChange: (tag: string | null) => void;
};

function SearchFilterBar({ search, onSearchChange, tags, activeTag, onTagChange }: SearchFilterProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search questions and answers…"
        style={{ ...scoutFieldStyle, background: surface.inset }}
      />
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <TagChip label="All tags" active={!activeTag} onClick={() => onTagChange(null)} />
          {tags.map((tag) => (
            <TagChip key={tag} label={tag} active={activeTag === tag} onClick={() => onTagChange(activeTag === tag ? null : tag)} />
          ))}
        </div>
      )}
    </div>
  );
}

type QaDraft = { question: string; answer: string; tags: string[] };

type EntryFormProps = {
  initial?: ApplicationQaEntry | null;
  prefill?: QaDraft | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (payload: { question: string; answer: string; tags: string[] }) => void | Promise<void>;
};

function EntryForm({ initial, prefill, saving, onCancel, onSave }: EntryFormProps) {
  const [question, setQuestion] = useState(initial?.question ?? prefill?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? prefill?.answer ?? "");
  const [tagsInput, setTagsInput] = useState(
    initial?.tags.join(", ") ?? prefill?.tags.join(", ") ?? "",
  );

  useEffect(() => {
    if (initial) {
      setQuestion(initial.question);
      setAnswer(initial.answer);
      setTagsInput(initial.tags.join(", "));
      return;
    }
    if (prefill) {
      setQuestion(prefill.question);
      setAnswer(prefill.answer);
      setTagsInput(prefill.tags.join(", "));
      return;
    }
    setQuestion("");
    setAnswer("");
    setTagsInput("");
  }, [initial, prefill]);

  return (
    <ScoutBox padding={16} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ display: "block", fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.muted, marginBottom: 6 }}>
          Question
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder="Why are you interested in this role?"
          style={{ ...scoutFieldStyle, background: surface.inset, resize: "vertical", lineHeight: 1.5 }}
        />
      </div>
      <div>
        <label style={{ display: "block", fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.muted, marginBottom: 6 }}>
          Answer
        </label>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={5}
          placeholder="Your go-to answer for applications…"
          style={{ ...scoutFieldStyle, background: surface.inset, resize: "vertical", lineHeight: 1.55 }}
        />
      </div>
      <div>
        <label style={{ display: "block", fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.muted, marginBottom: 6 }}>
          Tags (comma-separated)
        </label>
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="motivation, leadership, visa"
          style={{ ...scoutFieldStyle, background: surface.inset }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ScoutPrimaryBtn
          disabled={saving || !question.trim() || !answer.trim()}
          onClick={() => void onSave({ question, answer, tags: parseTagsInput(tagsInput) })}
        >
          {saving ? "Saving…" : initial ? "Save changes" : "Add entry"}
        </ScoutPrimaryBtn>
        <ScoutSecondaryBtn onClick={onCancel} disabled={saving}>
          Cancel
        </ScoutSecondaryBtn>
      </div>
    </ScoutBox>
  );
}

type SuggestedQuestionsProps = {
  existingQuestions: Set<string>;
  disabled?: boolean;
  onPick: (suggestion: ApplicationQaSuggestion) => void;
};

function SuggestedQuestions({ existingQuestions, disabled, onPick }: SuggestedQuestionsProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p
        style={{
          fontFamily: fontSans,
          fontSize: 12,
          fontWeight: 600,
          color: color.muted,
          letterSpacing: "0.4px",
          textTransform: "uppercase",
          margin: "0 0 6px",
        }}
      >
        Suggested questions
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 12px", lineHeight: 1.5 }}>
        Pick common application prompts — we&apos;ll pre-fill a starter answer you can customize.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {APPLICATION_QA_SUGGESTIONS.map((suggestion) => {
          const added = existingQuestions.has(normalizeQaQuestion(suggestion.question));
          return (
            <button
              key={suggestion.question}
              type="button"
              disabled={disabled || added}
              onClick={() => onPick(suggestion)}
              style={{
                ...scoutInsetChipStyle,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 6,
                padding: "10px 12px",
                maxWidth: "100%",
                textAlign: "left",
                cursor: disabled || added ? "default" : "pointer",
                opacity: added ? 0.65 : 1,
                background: added ? surface.inset : surface.card,
                border: line,
              }}
            >
              <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, lineHeight: 1.4 }}>
                {suggestion.question}
              </span>
              <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {suggestion.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      ...scoutInsetChipStyle,
                      fontSize: 11,
                      padding: "2px 8px",
                      background: surface.inset,
                    }}
                  >
                    {tag}
                  </span>
                ))}
                {added && (
                  <span
                    style={{
                      ...scoutInsetChipStyle,
                      fontSize: 11,
                      padding: "2px 8px",
                      background: "rgba(174,122,255,0.18)",
                      color: color.ink,
                      fontWeight: 600,
                    }}
                  >
                    Added
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type ApplicationQaPanelProps = {
  scopePath?: (path: string) => string;
};

export function ApplicationQaPanel({ scopePath = (p) => p }: ApplicationQaPanelProps) {
  const [allEntries, setAllEntries] = useState<ApplicationQaEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<ApplicationQaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ApplicationQaEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [addPrefill, setAddPrefill] = useState<QaDraft | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await fetchEntries(scopePath);
      setAllEntries(entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Q&A bank");
    } finally {
      setLoading(false);
    }
  }, [scopePath]);

  const loadFiltered = useCallback(async () => {
    try {
      const entries = await fetchEntries(scopePath, {
        q: search || undefined,
        tag: activeTag || undefined,
      });
      setFilteredEntries(entries);
    } catch {
      setFilteredEntries([]);
    }
  }, [scopePath, search, activeTag]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadFiltered(), search ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [loadFiltered, search, activeTag]);

  const tagOptions = useMemo(() => collectUniqueTags(allEntries), [allEntries]);
  const existingQuestionKeys = useMemo(
    () => new Set(allEntries.map((entry) => normalizeQaQuestion(entry.question))),
    [allEntries],
  );

  async function createEntry(payload: { question: string; answer: string; tags: string[] }) {
    setSaving(true);
    try {
      const res = await fetch(scopePath("/api/user/application-qa"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Could not add entry");
      setAdding(false);
      setAddPrefill(null);
      await loadAll();
      await loadFiltered();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add entry");
    } finally {
      setSaving(false);
    }
  }

  async function updateEntry(payload: { question: string; answer: string; tags: string[] }) {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(scopePath(`/api/user/application-qa/${encodeURIComponent(editing.id)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Could not save entry");
      setEditing(null);
      await loadAll();
      await loadFiltered();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save entry");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!window.confirm("Delete this Q&A entry?")) return;
    setSaving(true);
    try {
      const res = await fetch(scopePath(`/api/user/application-qa/${encodeURIComponent(id)}`), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not delete entry");
      if (editing?.id === id) setEditing(null);
      await loadAll();
      await loadFiltered();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontFamily: fontSans, fontSize: T.heading, fontWeight: 600, color: color.forest, margin: 0 }}>
            Application Q&A
          </h3>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "6px 0 0", lineHeight: 1.5 }}>
            Save reusable answers for common application questions — open from any job when you apply.
          </p>
        </div>
        {!adding && !editing && (
          <ScoutPrimaryBtn
            onClick={() => {
              setAddPrefill(null);
              setAdding(true);
            }}
          >
            Add question
          </ScoutPrimaryBtn>
        )}
      </div>

      {!editing && (
        <SuggestedQuestions
          existingQuestions={existingQuestionKeys}
          disabled={adding || saving}
          onPick={(suggestion) => {
            setEditing(null);
            setAddPrefill({
              question: suggestion.question,
              answer: suggestion.answer,
              tags: suggestion.tags,
            });
            setAdding(true);
          }}
        />
      )}

      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#B42318", margin: "0 0 12px" }}>{error}</p>
      )}

      {(adding || editing) && (
        <div style={{ marginBottom: 16 }}>
          <EntryForm
            initial={editing}
            prefill={adding && !editing ? addPrefill : null}
            saving={saving}
            onCancel={() => {
              setAdding(false);
              setAddPrefill(null);
              setEditing(null);
            }}
            onSave={editing ? updateEntry : createEntry}
          />
        </div>
      )}

      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        tags={tagOptions}
        activeTag={activeTag}
        onTagChange={setActiveTag}
      />

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Loading…</p>
        ) : (
          <EntryList
            entries={filteredEntries}
            mode="manage"
            onEdit={(entry) => {
              setAdding(false);
              setAddPrefill(null);
              setEditing(entry);
            }}
            onDelete={(id) => void deleteEntry(id)}
          />
        )}
      </div>
    </section>
  );
}

type ApplicationQaModalProps = {
  open: boolean;
  onClose: () => void;
  scopePath?: (path: string) => string;
  preferencesHref?: string;
};

export function ApplicationQaModal({
  open,
  onClose,
  scopePath = (p) => p,
  preferencesHref = "/profile/preferences",
}: ApplicationQaModalProps) {
  const [allEntries, setAllEntries] = useState<ApplicationQaEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<ApplicationQaEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await fetchEntries(scopePath);
      setAllEntries(entries);
    } catch {
      setAllEntries([]);
    } finally {
      setLoading(false);
    }
  }, [scopePath]);

  const loadFiltered = useCallback(async () => {
    try {
      const entries = await fetchEntries(scopePath, {
        q: search || undefined,
        tag: activeTag || undefined,
      });
      setFilteredEntries(entries);
    } catch {
      setFilteredEntries([]);
    }
  }, [scopePath, search, activeTag]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setActiveTag(null);
    void loadAll();
  }, [open, loadAll]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => void loadFiltered(), search ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [open, loadFiltered, search, activeTag]);

  const tagOptions = useMemo(() => collectUniqueTags(allEntries), [allEntries]);

  return (
    <ScoutModal open={open} onClose={onClose} maxWidth={640} bruddle ariaLabelledBy="application-qa-title">
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: "min(72vh, 640px)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 id="application-qa-title" style={{ fontFamily: fontSans, fontSize: 20, fontWeight: 700, color: color.ink, margin: 0 }}>
              Q&A bank
            </h2>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "4px 0 0", lineHeight: 1.45 }}>
              Copy answers while you apply — edit entries in preferences.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", fontSize: 24, lineHeight: 1, cursor: "pointer", color: color.mutedLight, padding: 0 }}
          >
            ×
          </button>
        </div>

        <SearchFilterBar
          search={search}
          onSearchChange={setSearch}
          tags={tagOptions}
          activeTag={activeTag}
          onTagChange={setActiveTag}
        />

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 2 }}>
          {loading ? (
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Loading…</p>
          ) : (
            <EntryList entries={filteredEntries} mode="browse" />
          )}
        </div>

        <div style={{ borderTop: line, paddingTop: 12 }}>
          <Link
            href={preferencesHref}
            onClick={onClose}
            style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest, textDecoration: "underline" }}
          >
            Manage Q&A in preferences →
          </Link>
        </div>
      </div>
    </ScoutModal>
  );
}
