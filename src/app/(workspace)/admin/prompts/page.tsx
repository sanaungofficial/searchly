"use client";

import { useState, useEffect } from "react";

type PromptItem = {
  key: string;
  label: string;
  description: string;
  category: string;
  content: string;
  defaultContent: string;
  variables: string[];
  updatedAt: string | null;
};

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    fetch("/api/admin/prompts")
      .then((r) => r.json())
      .then((data: PromptItem[]) => {
        setPrompts(data);
        if (data.length > 0) {
          setSelected(data[0].key);
          setDraft(data[0].content);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const current = prompts.find((p) => p.key === selected) ?? null;

  function selectPrompt(key: string) {
    const p = prompts.find((x) => x.key === key);
    if (!p) return;
    setSelected(key);
    setDraft(p.content);
    setSaveStatus("idle");
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch(`/api/admin/prompts/${selected}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setPrompts((prev) =>
        prev.map((p) =>
          p.key === selected ? { ...p, content: updated.content, updatedAt: updated.updatedAt } : p
        )
      );
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!selected || !confirm("Reset this prompt to its default?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/prompts/${selected}/reset`, { method: "POST" });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setDraft(updated.content);
      setPrompts((prev) =>
        prev.map((p) =>
          p.key === selected ? { ...p, content: updated.content, updatedAt: updated.updatedAt } : p
        )
      );
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  const categories = Array.from(new Set(prompts.map((p) => p.category)));

  if (loading) {
    return <p style={{ fontSize: 13, color: "var(--scout-muted)" }}>Loading prompts…</p>;
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
          AI Prompts
        </h1>
        <p style={{ fontSize: 13, color: "var(--scout-muted)" }}>
          Edit the prompts used by every AI feature. Changes take effect immediately (60-second cache).
        </p>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* Left: prompt list */}
        <div style={{ width: 220, flexShrink: 0, background: "#fff", borderRadius: 10, border: "1px solid rgba(26,58,47,0.08)", overflow: "hidden" }}>
          {categories.map((cat) => (
            <div key={cat}>
              <div style={{ padding: "8px 14px", fontSize: 12, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", background: "#faf8f5", borderBottom: "1px solid #f0ece6" }}>
                {cat}
              </div>
              {prompts
                .filter((p) => p.category === cat)
                .map((p) => (
                  <button
                    key={p.key}
                    onClick={() => selectPrompt(p.key)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", border: "none", borderBottom: "1px solid #f7f4f0", background: selected === p.key ? "#f0ece6" : "transparent", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13, color: selected === p.key ? "#1a1a1a" : "#3d3530" }}
                  >
                    {p.label}
                  </button>
                ))}
            </div>
          ))}
        </div>

        {/* Right: editor */}
        <div style={{ flex: 1, background: "#fff", borderRadius: 10, border: "1px solid rgba(26,58,47,0.08)", padding: 20 }}>
          {current ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>
                  {current.label}
                </div>
                <div style={{ fontSize: 13, color: "var(--scout-muted)" }}>{current.description}</div>
                {current.variables.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {current.variables.map((v) => (
                      <span key={v} style={{ fontSize: 12, fontFamily: "var(--font-dm-mono)", background: "#f0ece6", color: "#5a4a3a", padding: "2px 7px", borderRadius: 4 }}>
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <textarea
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setSaveStatus("idle"); }}
                style={{ width: "100%", minHeight: 400, fontFamily: "var(--font-dm-mono)", fontSize: 13, lineHeight: 1.6, padding: "12px 14px", border: "1px solid #e8e2da", borderRadius: 7, background: "#faf8f5", color: "#1a1a1a", resize: "vertical", outline: "none", boxSizing: "border-box" }}
              />
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ padding: "8px 18px", border: "none", borderRadius: 6, background: "#1a3a2f", color: "#fff", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={handleReset}
                  disabled={saving}
                  style={{ padding: "8px 14px", border: "1px solid #e8e2da", borderRadius: 6, background: "transparent", color: "var(--scout-muted)", fontFamily: "var(--font-ui)", fontSize: 13, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
                >
                  Reset to default
                </button>
                {saveStatus === "saved" && <span style={{ fontSize: 13, color: "#2d7a50" }}>Saved</span>}
                {saveStatus === "error" && <span style={{ fontSize: 13, color: "#b45309" }}>Error saving</span>}
                {current.updatedAt && (
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--scout-muted)", fontFamily: "var(--font-dm-mono)" }}>
                    Last saved {new Date(current.updatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--scout-muted)" }}>Select a prompt to edit.</p>
          )}
        </div>
      </div>
    </div>
  );
}
