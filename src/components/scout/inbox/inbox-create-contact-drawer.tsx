"use client";

import { useEffect, useState } from "react";
import { ScoutPrimaryBtn, ScoutSecondaryBtn, scoutFieldStyle } from "@/components/scout/scout-box";
import { useWorkspaceDrawerLayout } from "@/hooks/use-workspace-drawer-layout";
import { color, fontSans, surface, type as T } from "@/lib/typography";
import { DRAWER_BACKDROP_Z, DRAWER_Z } from "@/lib/z-layers";

const DRAWER_WIDTH = 480;

type FormState = {
  name: string;
  email: string;
  company: string;
  title: string;
  phone: string;
  linkedinUrl: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  company: "",
  title: "",
  phone: "",
  linkedinUrl: "",
  notes: "",
};

type Props = {
  open: boolean;
  onClose: () => void;
  scopePath: (path: string) => string;
  onCreated?: () => void;
};

export function InboxCreateContactDrawer({ open, onClose, scopePath, onCreated }: Props) {
  const { isMobile, backdropStyle, panelStyle } = useWorkspaceDrawerLayout();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setError(null);
      setSaving(false);
    }
  }, [open]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim()) {
      setError("Email is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(scopePath("/api/user/inbox/contacts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim() || null,
          email: form.email.trim(),
          company: form.company.trim() || null,
          title: form.title.trim() || null,
          phone: form.phone.trim() || null,
          linkedinUrl: form.linkedinUrl.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create contact.");

      onCreated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create contact.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const line = "var(--scout-border)";

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: fontSans,
    fontSize: T.bodySm,
    fontWeight: 600,
    color: color.muted,
    marginBottom: 6,
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          ...backdropStyle,
          background: "rgba(0,0,0,0.18)",
          zIndex: DRAWER_BACKDROP_Z,
        }}
      />
      <div
        style={{
          ...panelStyle,
          width: isMobile ? "100%" : DRAWER_WIDTH,
          maxWidth: isMobile ? "100%" : "calc(100vw - 16px)",
          background: surface.inset,
          border: isMobile ? "none" : line,
          zIndex: DRAWER_Z,
          boxShadow: isMobile ? "none" : "3px 3px 0 rgba(17,17,17,0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            padding: isMobile ? "14px 16px 12px" : "18px 20px 14px",
            borderBottom: line,
            background: surface.card,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: "none",
                background: "none",
                fontFamily: fontSans,
                fontSize: T.bodySm,
                color: color.forest,
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              ✕
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.body, fontWeight: 700, color: color.ink }}>
                New contact
              </p>
              <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.45 }}>
                Add someone to My Network manually.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 16px",
              fontFamily: fontSans,
              fontSize: T.caption,
              color: "#C4574A",
              background: "rgba(196,87,74,0.08)",
              borderBottom: line,
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: isMobile ? "16px" : "20px" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label>
              <span style={labelStyle}>
                Name
              </span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Jane Smith"
                autoComplete="name"
                style={{ ...scoutFieldStyle, width: "100%", boxSizing: "border-box" }}
              />
            </label>

            <label>
              <span style={labelStyle}>
                Email <span style={{ color: "#C4574A" }}>*</span>
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="jane@company.com"
                autoComplete="email"
                required
                style={{ ...scoutFieldStyle, width: "100%", boxSizing: "border-box" }}
              />
            </label>

            <label>
              <span style={labelStyle}>Company</span>
              <input
                type="text"
                value={form.company}
                onChange={(e) => updateField("company", e.target.value)}
                placeholder="Acme Corp"
                autoComplete="organization"
                style={{ ...scoutFieldStyle, width: "100%", boxSizing: "border-box" }}
              />
            </label>

            <label>
              <span style={labelStyle}>Title</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Product Manager"
                autoComplete="organization-title"
                style={{ ...scoutFieldStyle, width: "100%", boxSizing: "border-box" }}
              />
            </label>

            <label>
              <span style={labelStyle}>Phone</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+1 555 123 4567"
                autoComplete="tel"
                style={{ ...scoutFieldStyle, width: "100%", boxSizing: "border-box" }}
              />
            </label>

            <label>
              <span style={labelStyle}>LinkedIn</span>
              <input
                type="url"
                value={form.linkedinUrl}
                onChange={(e) => updateField("linkedinUrl", e.target.value)}
                placeholder="https://linkedin.com/in/janesmith"
                style={{ ...scoutFieldStyle, width: "100%", boxSizing: "border-box" }}
              />
            </label>

            <label>
              <span style={labelStyle}>Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={4}
                placeholder="How you met, follow-up ideas…"
                style={{ ...scoutFieldStyle, width: "100%", boxSizing: "border-box", resize: "vertical" }}
              />
            </label>
          </div>
        </form>

        <div
          style={{
            padding: "12px 16px",
            borderTop: line,
            background: "#FAFAFA",
            flexShrink: 0,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <ScoutSecondaryBtn type="button" onClick={onClose} disabled={saving}>
            Cancel
          </ScoutSecondaryBtn>
          <ScoutPrimaryBtn
            type="button"
            onClick={(e) => void handleSubmit(e as unknown as React.FormEvent)}
            disabled={saving || !form.email.trim()}
          >
            {saving ? "Saving…" : "Add contact"}
          </ScoutPrimaryBtn>
        </div>
      </div>
    </>
  );
}
