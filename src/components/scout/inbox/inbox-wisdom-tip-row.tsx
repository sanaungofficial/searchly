"use client";

import { color, fontSans, border, type as T } from "@/lib/typography";
import type { InboxWisdomTip } from "@/lib/inbox-wisdom-tips";

type Props = {
  tip: InboxWisdomTip;
  compact?: boolean;
};

export function InboxWisdomTipRow({ tip, compact }: Props) {
  return (
    <div
      style={{
        padding: compact ? "10px 0" : "12px 14px",
        borderBottom: "var(--scout-border)",
        background: compact ? undefined : "rgba(196,168,106,0.06)",
      }}
    >
      <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest }}>
        {tip.title}
      </p>
      <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, color: color.stone, lineHeight: 1.55 }}>
        {tip.body}
      </p>
    </div>
  );
}
