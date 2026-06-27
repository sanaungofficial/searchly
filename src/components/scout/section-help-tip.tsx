"use client";

import { useId, useState, type ReactNode } from "react";
import { border, color, fontSans, type as T } from "@/lib/typography";

type HelpTipProps = {
  text: string;
  label?: string;
};

export function SectionHelpTip({ text, label = "What is this?" }: HelpTipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: border.line,
          background: "rgba(26,58,47,0.06)",
          color: color.muted,
          fontFamily: fontSans,
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          cursor: "help",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "calc(100% + 8px)",
            transform: "translateX(-50%)",
            width: "max-content",
            maxWidth: 280,
            padding: "10px 12px",
            borderRadius: "var(--scout-radius)",
            background: color.forest,
            color: "#fff",
            fontFamily: fontSans,
            fontSize: T.caption,
            lineHeight: 1.55,
            fontWeight: 400,
            textAlign: "left",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            zIndex: 20,
            pointerEvents: "none",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function SectionHeadingWithHelp({
  title,
  help,
  titleStyle,
  trailing,
}: {
  title: string;
  help: string;
  titleStyle?: React.CSSProperties;
  trailing?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: trailing ? "100%" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: trailing ? 1 : undefined, minWidth: 0 }}>
        <p
          style={{
            fontFamily: fontSans,
            fontSize: T.bodySm,
            fontWeight: 700,
            color: color.ink,
            margin: 0,
            ...titleStyle,
          }}
        >
          {title}
        </p>
        <SectionHelpTip text={help} label={`About ${title}`} />
      </div>
      {trailing}
    </div>
  );
}
