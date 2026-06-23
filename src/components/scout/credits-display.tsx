"use client";

import Link from "next/link";
import {
  FREE_MONTHLY_CREDITS,
  isCreditsExhausted,
  isCreditsLow,
  type CreditBalance,
} from "@/lib/credits";

type Props = {
  credits: CreditBalance;
  compact?: boolean;
  onUpgrade?: () => void;
};

export function CreditsMeter({ credits, compact = false }: Props) {
  const exhausted = isCreditsExhausted(credits);
  const low = isCreditsLow(credits);
  const pct = credits.limit > 0 ? Math.min(100, (credits.used / credits.limit) * 100) : 0;
  const barColor = exhausted ? "#C4574A" : low ? "#C4A86A" : "#4A8B6A";

  if (compact) {
    return (
      <span
        title={`${credits.remaining} of ${credits.limit} AI credits left this month`}
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 11,
          fontWeight: 600,
          color: exhausted ? "#C4574A" : "rgba(232,213,163,0.65)",
        }}
      >
        {credits.remaining}
      </span>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: exhausted ? "#C4574A" : "#E8D5A3", letterSpacing: "0.2px" }}>
          {exhausted ? "No credits left" : `${credits.remaining} credit${credits.remaining === 1 ? "" : "s"} left`}
        </p>
        <span style={{ fontSize: 11, color: "rgba(232,213,163,0.35)" }}>
          {credits.used}/{credits.limit}
        </span>
      </div>
      <div style={{ height: 4, background: "rgba(232,213,163,0.12)", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ height: "100%", width: `${100 - pct}%`, background: barColor, borderRadius: 4, transition: "width 0.3s ease" }} />
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "rgba(232,213,163,0.35)", lineHeight: 1.45 }}>
        {exhausted ? "Resets monthly · Pro is unlimited" : "Resets monthly · 1 credit per AI action"}
      </p>
    </div>
  );
}

export function CreditsSidebarBlock({
  credits,
  onUpgrade,
}: {
  credits: CreditBalance;
  onUpgrade?: () => void;
}) {
  const exhausted = isCreditsExhausted(credits);

  return (
    <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          background: exhausted ? "rgba(196,87,74,0.12)" : "rgba(232,213,163,0.06)",
          border: `1px solid ${exhausted ? "rgba(196,87,74,0.25)" : "rgba(232,213,163,0.12)"}`,
          borderRadius: 10,
          padding: "10px 14px",
        }}
      >
        <CreditsMeter credits={credits} />
      </div>
      {exhausted ? (
        <button
          type="button"
          onClick={onUpgrade}
          data-offer="pro"
          data-trigger="credits_exhausted"
          style={{
            display: "block",
            width: "100%",
            background: "#E8D5A3",
            border: "none",
            borderRadius: 10,
            padding: "10px 14px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "#1A3A2F" }}>Upgrade to Pro</p>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(26,58,47,0.65)", lineHeight: 1.45 }}>Unlimited AI — no credit limits</p>
        </button>
      ) : (
        <Link
          href="/pricing"
          data-offer="pro"
          data-trigger="sidebar_credits"
          style={{
            display: "block",
            background: "rgba(232,213,163,0.08)",
            border: "1px solid rgba(232,213,163,0.15)",
            borderRadius: 10,
            padding: "8px 14px",
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(232,213,163,0.55)" }}>Upgrade for unlimited →</span>
        </Link>
      )}
    </div>
  );
}

export { FREE_MONTHLY_CREDITS };
