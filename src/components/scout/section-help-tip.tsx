"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { border, color, fontSans, type as T } from "@/lib/typography";

type HelpTipProps = {
  text: string;
  label?: string;
};

export function SectionHelpTip({ text, label = "What is this?" }: HelpTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
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
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          ?
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-[280px] border-0 bg-[#1A3A2F] px-3 py-2.5 text-left text-white shadow-lg [&>svg]:fill-[#1A3A2F]"
        style={{ fontFamily: fontSans, fontSize: T.caption, lineHeight: 1.55, fontWeight: 400 }}
      >
        {text}
      </TooltipContent>
    </Tooltip>
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
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
