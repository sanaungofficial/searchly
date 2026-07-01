"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PIPELINE_TAG,
  normalizePipelineTagLabel,
  normalizePipelineTags,
  parseTagsInput,
  type PipelineTagColor,
  type PipelineTagSummary,
  type PipelineTagVariant,
} from "@/lib/pipeline-tags";
import {
  ScoutPrimaryBtn,
  ScoutSecondaryBtn,
  scoutFieldStyle,
  scoutInsetChipStyle,
} from "./scout-box";
import {
  PIPELINE_TAG_COLORS,
  PipelineTag,
  PipelineTagColorSwatch,
} from "./pipeline-tag";
import { color, fontSans, surface, type as T } from "@/lib/typography";

type ScopePath = (path: string) => string;

async function fetchTagLibrary(scopePath: ScopePath): Promise<PipelineTagSummary[]> {
  const res = await fetch(scopePath("/api/user/pipeline-tags"), { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load tags");
  const data = (await res.json()) as { tags?: PipelineTagSummary[] };
  return data.tags ?? [];
}

export function PipelineTagChip({
  label,
  onRemove,
  onClick,
  compact,
  color: tagColor,
  variant,
}: {
  label: string;
  onRemove?: () => void;
  onClick?: () => void;
  compact?: boolean;
  color?: PipelineTagColor;
  variant?: PipelineTagVariant;
}) {
  return (
    <PipelineTag
      label={label}
      color={tagColor}
      variant={variant}
      compact={compact}
      removable={Boolean(onRemove)}
      onRemove={onRemove}
      onClick={onClick}
    />
  );
}

export function PipelineJobTagsRow({
  tags,
  library = [],
  maxVisible = 3,
}: {
  tags: string[];
  library?: PipelineTagSummary[];
  maxVisible?: number;
}) {
  const normalized = normalizePipelineTags(tags);
  if (!normalized.length) return null;

  const visible = normalized.slice(0, maxVisible);
  const overflow = normalized.length - visible.length;
  const lookup = new Map(library.map((row) => [row.label.toLowerCase(), row]));

  return (
    <div
      style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}
      onClick={(e) => e.stopPropagation()}
    >
      {visible.map((tag) => {
        const def = lookup.get(tag.toLowerCase());
        return (
          <PipelineTagChip
            key={tag}
            label={tag}
            compact
            color={def?.color}
            variant={def?.variant}
          />
        );
      })}
      {overflow > 0 && (
        <span style={{ ...scoutInsetChipStyle, fontSize: 11, color: color.muted }}>
          +{overflow}
        </span>
      )}
    </div>
  );
}

type PipelineJobTagsEditorProps = {
  jobId: string | null;
  tags: string[];
  scopePath: ScopePath;
  onTagsChange: (tags: string[]) => void;
  manageLibrary?: boolean;
};

export function PipelineJobTagsEditor({
  jobId,
  tags,
  scopePath,
  onTagsChange,
  manageLibrary = false,
}: PipelineJobTagsEditorProps) {
  const [library, setLibrary] = useState<PipelineTagSummary[]>([]);
  const [input, setInput] = useState("");
  const [newTagColor, setNewTagColor] = useState<PipelineTagColor>(DEFAULT_PIPELINE_TAG.color);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshLibrary = useCallback(async () => {
    try {
      const rows = await fetchTagLibrary(scopePath);
      setLibrary(rows);
    } catch {
      /* ignore — editor still works with local tags */
    }
  }, [scopePath]);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  const selectedKeys = useMemo(
    () => new Set(normalizePipelineTags(tags).map((tag) => tag.toLowerCase())),
    [tags],
  );

  const suggestions = useMemo(
    () => library.filter((row) => !selectedKeys.has(row.label.toLowerCase())),
    [library, selectedKeys],
  );

  async function persistTags(nextTags: string[]) {
    if (!jobId) {
      onTagsChange(nextTags);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(scopePath(`/api/jobs/${jobId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineTags: nextTags }),
      });
      if (!res.ok) throw new Error("Could not save tags");
      onTagsChange(nextTags);
      await refreshLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save tags");
    } finally {
      setLoading(false);
    }
  }

  async function createLibraryTag(label: string, attachToJob: boolean) {
    const normalized = normalizePipelineTagLabel(label);
    if (!normalized) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(scopePath("/api/user/pipeline-tags"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: normalized,
          color: newTagColor,
          variant: "light",
          ...(attachToJob && jobId ? { jobId } : {}),
        }),
      });
      if (!res.ok) throw new Error("Could not create tag");

      if (attachToJob) {
        const nextTags = normalizePipelineTags([...tags, normalized]);
        onTagsChange(nextTags);
      }

      setInput("");
      await refreshLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create tag");
    } finally {
      setLoading(false);
    }
  }

  async function updateLibraryTagColor(label: string, colorValue: PipelineTagColor) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(scopePath("/api/user/pipeline-tags"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, color: colorValue, variant: "light" }),
      });
      if (!res.ok) throw new Error("Could not update tag color");
      await refreshLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update tag color");
    } finally {
      setLoading(false);
    }
  }

  function addTagsFromInput(raw: string) {
    const parsed = parseTagsInput(raw);
    if (!parsed.length) return;
    const nextTags = normalizePipelineTags([...tags, ...parsed]);
    void persistTags(nextTags);
    setInput("");
  }

  function toggleTag(label: string) {
    const key = label.toLowerCase();
    const nextTags = selectedKeys.has(key)
      ? normalizePipelineTags(tags).filter((tag) => tag.toLowerCase() !== key)
      : normalizePipelineTags([...tags, label]);
    void persistTags(nextTags);
  }

  async function deleteLibraryTag(label: string) {
    if (!window.confirm(`Remove "${label}" from your tag library and all jobs?`)) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ label });
      const res = await fetch(scopePath(`/api/user/pipeline-tags?${params}`), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not delete tag");
      const nextTags = normalizePipelineTags(tags).filter(
        (tag) => tag.toLowerCase() !== label.toLowerCase(),
      );
      onTagsChange(nextTags);
      await refreshLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete tag");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {normalizePipelineTags(tags).map((tag) => {
          const def = library.find((row) => row.label.toLowerCase() === tag.toLowerCase());
          return (
            <PipelineTagChip
              key={tag}
              label={tag}
              color={def?.color}
              variant={def?.variant}
              onRemove={() => toggleTag(tag)}
            />
          );
        })}
        {!normalizePipelineTags(tags).length && (
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
            No tags yet — add labels like &quot;Referral&quot; or &quot;Dream company&quot;.
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTagsFromInput(input);
            }
          }}
          placeholder="Add tag…"
          disabled={loading}
          style={{ ...scoutFieldStyle, flex: "1 1 160px", minWidth: 0 }}
        />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {PIPELINE_TAG_COLORS.map((c) => (
            <PipelineTagColorSwatch
              key={c}
              color={c}
              selected={newTagColor === c}
              disabled={loading}
              onClick={() => setNewTagColor(c)}
            />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <ScoutPrimaryBtn
          disabled={loading || !normalizePipelineTagLabel(input)}
          onClick={() => addTagsFromInput(input)}
          style={{ fontSize: 12, padding: "8px 12px" }}
        >
          Add to job
        </ScoutPrimaryBtn>
        <ScoutSecondaryBtn
          disabled={loading || !normalizePipelineTagLabel(input)}
          onClick={() => void createLibraryTag(input, Boolean(jobId))}
          style={{ fontSize: 12, padding: "8px 12px" }}
        >
          Save to library
        </ScoutSecondaryBtn>
      </div>

      {suggestions.length > 0 && (
        <div style={{ marginBottom: manageLibrary ? 14 : 0 }}>
          <p
            style={{
              fontFamily: fontSans,
              fontSize: 11,
              fontWeight: 700,
              color: color.muted,
              textTransform: "uppercase",
              letterSpacing: "0.6px",
              margin: "0 0 8px",
            }}
          >
            Your tags
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {suggestions.slice(0, 12).map((row) => (
              <button
                key={row.label}
                type="button"
                disabled={loading}
                onClick={() => toggleTag(row.label)}
                style={{
                  ...scoutInsetChipStyle,
                  cursor: loading ? "default" : "pointer",
                  background: surface.inset,
                  color: color.ink,
                }}
              >
                + {row.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {manageLibrary && library.length > 0 && (
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            background: surface.inset,
            border: "var(--scout-border)",
            borderRadius: "var(--scout-radius)",
          }}
        >
          <p
            style={{
              fontFamily: fontSans,
              fontSize: 11,
              fontWeight: 700,
              color: color.muted,
              textTransform: "uppercase",
              letterSpacing: "0.6px",
              margin: "0 0 10px",
            }}
          >
            Manage tag library
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {library.map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <PipelineTagChip label={row.label} color={row.color} variant={row.variant} />
                  <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                    {row.jobCount} job{row.jobCount === 1 ? "" : "s"}
                    {row.inLibrary ? " · in library" : ""}
                  </span>
                  {row.inLibrary && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {PIPELINE_TAG_COLORS.map((c) => (
                        <PipelineTagColorSwatch
                          key={`${row.label}-${c}`}
                          color={c}
                          selected={row.color === c}
                          disabled={loading}
                          onClick={() => void updateLibraryTagColor(row.label, c)}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <ScoutSecondaryBtn
                  disabled={loading}
                  onClick={() => void deleteLibraryTag(row.label)}
                  style={{ fontSize: 11, padding: "5px 10px", color: "#C4574A" }}
                >
                  Delete
                </ScoutSecondaryBtn>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "8px 0 0" }}>
          {error}
        </p>
      )}
    </div>
  );
}
