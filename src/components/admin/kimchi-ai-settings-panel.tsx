"use client";

import { useCallback, useEffect, useState } from "react";

type KimchiAiSettings = {
  talkModel: string;
  analyzeModel: string;
  createModel: string;
  parseModel: string;
  autoInboxTriageOnOpen: boolean;
};

type PanelData = {
  settings: KimchiAiSettings;
  defaults: KimchiAiSettings;
  gatewayConfigured: boolean;
  recommendations: Record<string, string>;
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  color: "#3d3530",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "8px 10px",
  border: "1px solid #e8e2da",
  borderRadius: "var(--scout-radius)",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  boxSizing: "border-box",
};

const hintStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontFamily: "var(--font-ui)",
  fontSize: 11,
  color: "#7a7268",
  lineHeight: 1.4,
};

export function KimchiAiSettingsPanel({ onSaved }: { onSaved?: () => void }) {
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/kimchi-ai-settings");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings() {
    if (!data) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/admin/kimchi-ai-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.settings),
      });
      if (!res.ok) throw new Error();
      const { settings } = await res.json();
      setData((prev) => (prev ? { ...prev, settings } : prev));
      setSaveStatus("saved");
      onSaved?.();
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof KimchiAiSettings>(key: K, value: KimchiAiSettings[K]) {
    setData((prev) =>
      prev ? { ...prev, settings: { ...prev.settings, [key]: value } } : prev,
    );
    setSaveStatus("idle");
  }

  if (loading) {
    return <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#7a7268" }}>Loading…</p>;
  }

  if (!data) {
    return <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#9B3A2A" }}>Could not load settings.</p>;
  }

  const { settings, recommendations, gatewayConfigured } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {!gatewayConfigured && (
        <p style={{ ...hintStyle, color: "#9B3A2A", margin: 0 }}>
          Vercel AI Gateway is not configured on this environment — models below apply when gateway auth is present.
        </p>
      )}

      <section>
        <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600 }}>
          Model routing (AI Gateway)
        </h3>
        <p style={{ ...hintStyle, margin: "0 0 12px" }}>
          Use <code>provider/model</code> slugs. Chat uses <strong>talk</strong>; documents use <strong>create</strong>.
        </p>

        {(
          [
            ["talkModel", "Talk — chat & conversation", "talk"],
            ["analyzeModel", "Analyze — fit, match, scoring", "analyze"],
            ["createModel", "Create — strategy, resumes, letters", "create"],
            ["parseModel", "Parse — resume & intake extraction", "parse"],
          ] as const
        ).map(([key, label, recKey]) => (
          <label key={key} style={{ display: "block", marginBottom: 14 }}>
            <span style={labelStyle}>{label}</span>
            <input
              style={inputStyle}
              value={settings[key]}
              onChange={(e) => updateField(key, e.target.value)}
              spellCheck={false}
            />
            <p style={hintStyle}>Recommended: {recommendations[recKey]}</p>
          </label>
        ))}
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600 }}>
          Cost controls
        </h3>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={settings.autoInboxTriageOnOpen}
            onChange={(e) => updateField("autoInboxTriageOnOpen", e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <span style={{ ...labelStyle, marginBottom: 2 }}>Auto-scan inbox with AI when Kimchi chat opens</span>
            <p style={{ ...hintStyle, margin: 0 }}>
              Off by default. When off, users click <em>Scan inbox for updates</em> in chat (uses credits). Show
              suggestions and suggest next steps stay rule-based — no AI unless the user sends a message or clicks
              smarter suggestions.
            </p>
          </span>
        </label>
      </section>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          style={{
            padding: "8px 16px",
            background: "#1A3A2F",
            color: "#E8D5A3",
            border: "none",
            borderRadius: "var(--scout-radius)",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saveStatus === "saved" && (
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "#2d9a6a" }}>Saved</span>
        )}
        {saveStatus === "error" && (
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "#9B3A2A" }}>Save failed</span>
        )}
      </div>
    </div>
  );
}
