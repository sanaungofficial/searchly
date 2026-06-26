"use client";

import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import type { InboxLens } from "./inbox-types";

const TABS: { id: InboxLens; label: string; hint: string }[] = [
  { id: "job_search", label: "Job search", hint: "Personal mail for applications and recruiters" },
  { id: "work", label: "Work", hint: "Client and coaching mail from your expert profile" },
];

type Props = {
  lens: InboxLens;
  onChange: (lens: InboxLens) => void;
};

export function InboxLensTabs({ lens, onChange }: Props) {
  return (
    <div>
      <div
        role="tablist"
        aria-label="Which inbox to view"
        style={{
          display: "inline-flex",
          border: border.line,
          borderRadius: 999,
          padding: 3,
          background: surface.card,
          gap: 2,
        }}
      >
        {TABS.map(({ id, label }) => {
          const active = lens === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(id)}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "7px 14px",
                background: active ? color.forest : "transparent",
                color: active ? "#fff" : color.stone,
                fontFamily: fontSans,
                fontSize: T.caption,
                fontWeight: 600,
                cursor: "pointer",
                lineHeight: 1.2,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: T.label, color: color.muted, lineHeight: 1.4 }}>
        {TABS.find((t) => t.id === lens)?.hint}
      </p>
    </div>
  );
}
