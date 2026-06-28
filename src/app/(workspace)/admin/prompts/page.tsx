"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { CompanyScanSettingsPanel } from "@/components/admin/company-scan-settings-panel";
import { KimchiAiSettingsPanel } from "@/components/admin/kimchi-ai-settings-panel";
import { COMPANY_SCAN_SETTINGS_KEY, COMPANY_SCAN_SETTINGS_SIDEBAR } from "@/lib/company-scan-config";
import { KIMCHI_AI_SETTINGS_KEY, KIMCHI_AI_SETTINGS_SIDEBAR } from "@/lib/kimchi-ai-settings";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, fontMono, fontSans, surface, type as T } from "@/lib/typography";

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

type SidebarItem =
  | { kind: "prompt"; key: string; label: string; category: string }
  | { kind: "settings"; key: typeof COMPANY_SCAN_SETTINGS_KEY | typeof KIMCHI_AI_SETTINGS_KEY; label: string; category: string };

function buildSidebarItems(prompts: PromptItem[]): SidebarItem[] {
  const items: SidebarItem[] = [];
  const categories = Array.from(new Set(prompts.map((p) => p.category)));

  for (const cat of categories) {
    const inCat = prompts.filter((p) => p.category === cat);
    for (const p of inCat) {
      items.push({ kind: "prompt", key: p.key, label: p.label, category: cat });
      if (p.key === "COMPANY_JOBS_SCAN") {
        items.push({
          kind: "settings",
          key: COMPANY_SCAN_SETTINGS_KEY,
          label: COMPANY_SCAN_SETTINGS_SIDEBAR.label,
          category: cat,
        });
      }
      if (p.key === "CHAT_SYSTEM") {
        items.push({
          kind: "settings",
          key: KIMCHI_AI_SETTINGS_KEY,
          label: KIMCHI_AI_SETTINGS_SIDEBAR.label,
          category: cat,
        });
      }
    }
  }

  return items;
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  const sidebarItems = useMemo(() => buildSidebarItems(prompts), [prompts]);
  const isSettingsView =
    selected === COMPANY_SCAN_SETTINGS_KEY || selected === KIMCHI_AI_SETTINGS_KEY;
  const isKimchiAiSettingsView = selected === KIMCHI_AI_SETTINGS_KEY;
  const current = prompts.find((p) => p.key === selected) ?? null;

  useEffect(() => {
    fetch("/api/admin/prompts")
      .then((r) => r.json())
      .then((data: PromptItem[]) => {
        setPrompts(data);
        const companiesPrompt = data.find((p) => p.key === "COMPANY_JOBS_SCAN");
        const first = companiesPrompt ?? data[0];
        if (first) {
          setSelected(first.key);
          setDraft(first.content);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function selectItem(key: string) {
    if (key === COMPANY_SCAN_SETTINGS_KEY || key === KIMCHI_AI_SETTINGS_KEY) {
      setSelected(key);
      setSaveStatus("idle");
      return;
    }
    const p = prompts.find((x) => x.key === key);
    if (!p) return;
    setSelected(key);
    setDraft(p.content);
    setSaveStatus("idle");
  }

  async function handleSave() {
    if (!selected || isSettingsView) return;
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
    if (!selected || isSettingsView || !confirm("Reset this prompt to its default?")) return;
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

  const categories = Array.from(new Set(sidebarItems.map((i) => i.category)));

  if (loading) {
    return <p style={{ fontSize: T.bodySm, color: color.muted }}>Loading prompts…</p>;
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block" }} />
          <ScoutLabel>AI configuration</ScoutLabel>
        </div>
        <ScoutDisplayTitle size={36} style={{ marginBottom: 8 }}>AI Prompts</ScoutDisplayTitle>
        <p style={{ fontSize: T.bodySm, color: color.muted, margin: 0 }}>
          Edit AI prompts, model routing, and automation settings. Changes take effect within ~60 seconds.
        </p>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <ScoutBox padding={0} style={{ width: 220, flexShrink: 0, overflow: "hidden" }}>
          {categories.map((cat) => (
            <div key={cat}>
              <div style={{ padding: "8px 14px", fontSize: T.label, color: color.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontMono, background: surface.inset, borderBottom: "var(--scout-border)" }}>
                {cat}
              </div>
              {sidebarItems
                .filter((i) => i.category === cat)
                .map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => selectItem(item.key)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "9px 14px",
                      border: "none",
                      borderBottom: "var(--scout-border)",
                      background: selected === item.key ? surface.inset : surface.card,
                      cursor: "pointer",
                      fontFamily: fontSans,
                      fontSize: T.caption,
                      color: selected === item.key ? color.ink : color.stone,
                      fontStyle: item.kind === "settings" ? "italic" : "normal",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          ))}
        </ScoutBox>

        <ScoutBox style={{ flex: 1 }}>
          {isSettingsView ? (
            isKimchiAiSettingsView ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 600, color: color.ink, marginBottom: 4 }}>
                    {KIMCHI_AI_SETTINGS_SIDEBAR.label}
                  </div>
                  <div style={{ fontSize: T.caption, color: color.muted }}>{KIMCHI_AI_SETTINGS_SIDEBAR.description}</div>
                </div>
                <KimchiAiSettingsPanel />
              </>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 600, color: color.ink, marginBottom: 4 }}>
                    {COMPANY_SCAN_SETTINGS_SIDEBAR.label}
                  </div>
                  <div style={{ fontSize: T.caption, color: color.muted }}>{COMPANY_SCAN_SETTINGS_SIDEBAR.description}</div>
                </div>
                <CompanyScanSettingsPanel />
                <p style={{ marginTop: 20, fontSize: T.label, color: color.muted }}>
                  <Link href="/admin/company-scans" style={{ color: color.forest }}>
                    View full scan dashboard →
                  </Link>{" "}
                  (intel catalog, stale status, manual run history)
                </p>
              </>
            )
          ) : current ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 600, color: color.ink, marginBottom: 4 }}>
                  {current.label}
                </div>
                <div style={{ fontSize: T.caption, color: color.muted }}>{current.description}</div>
                {current.key === "CHAT_SYSTEM" && (
                  <button
                    type="button"
                    onClick={() => selectItem(KIMCHI_AI_SETTINGS_KEY)}
                    style={{ marginTop: 10, padding: 0, border: "none", background: "none", fontFamily: fontSans, fontSize: T.caption, color: color.forest, cursor: "pointer", textDecoration: "underline" }}
                  >
                    Edit AI models & cost controls →
                  </button>
                )}
                {current.key === "COMPANY_JOBS_SCAN" && (
                  <button
                    type="button"
                    onClick={() => selectItem(COMPANY_SCAN_SETTINGS_KEY)}
                    style={{ marginTop: 10, padding: 0, border: "none", background: "none", fontFamily: fontSans, fontSize: T.caption, color: color.forest, cursor: "pointer", textDecoration: "underline" }}
                  >
                    Edit scan schedule & automation →
                  </button>
                )}
                {current.variables.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {current.variables.map((v) => (
                      <span key={v} style={{ fontSize: T.label, fontFamily: fontMono, background: surface.inset, color: color.stone, padding: "2px 7px", border: "var(--scout-border)" }}>
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <textarea
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setSaveStatus("idle"); }}
                style={{ width: "100%", minHeight: 400, fontFamily: fontMono, fontSize: T.caption, lineHeight: 1.6, padding: "12px 14px", border: "var(--scout-border)", borderRadius: "var(--scout-radius)", background: surface.inset, color: color.ink, resize: "vertical", outline: "none", boxSizing: "border-box" }}
              />
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <ScoutPrimaryBtn onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </ScoutPrimaryBtn>
                <ScoutSecondaryBtn onClick={handleReset} disabled={saving}>
                  Reset to default
                </ScoutSecondaryBtn>
                {saveStatus === "saved" && <span style={{ fontSize: T.caption, color: color.forest }}>Saved</span>}
                {saveStatus === "error" && <span style={{ fontSize: T.caption, color: "#b45309" }}>Error saving</span>}
                {current.updatedAt && (
                  <span style={{ marginLeft: "auto", fontSize: T.label, color: color.muted, fontFamily: fontMono }}>
                    Last saved {new Date(current.updatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p style={{ fontSize: T.caption, color: color.muted }}>Select a prompt to edit.</p>
          )}
        </ScoutBox>
      </div>
    </div>
  );
}
