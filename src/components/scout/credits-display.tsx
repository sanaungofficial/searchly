"use client";

import Link from "next/link";
import {
  FREE_MONTHLY_CREDITS,
  isCreditsExhausted,
  isCreditsLow,
  type CreditBalance,
} from "@/lib/credits";
import { creditsSummary, creditsReferenceLabel, useCredits } from "@/hooks/useCredits";

type Props = {
  credits: CreditBalance;
  compact?: boolean;
  onUpgrade?: () => void;
};

export function CreditsMeter({ credits, compact = false, unlimitedAi = false }: Props & { unlimitedAi?: boolean }) {
  const exhausted = !unlimitedAi && isCreditsExhausted(credits);
  const low = !unlimitedAi && isCreditsLow(credits);
  const pct = credits.limit > 0 ? Math.min(100, (credits.used / credits.limit) * 100) : 0;
  const barColor = exhausted ? "#C4574A" : low ? "#C4A86A" : "#4A8B6A";

  if (compact) {
    return (
      <span
        title={unlimitedAi ? "Unlimited AI — admin account" : `${credits.remaining} of ${credits.limit} AI credits left this month`}
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 11,
          fontWeight: 600,
          color: exhausted ? "#C4574A" : "rgba(232,213,163,0.65)",
        }}
      >
        {unlimitedAi ? "∞" : credits.remaining}
      </span>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: exhausted ? "#C4574A" : "#E8D5A3", letterSpacing: "0.2px" }}>
          {unlimitedAi ? "Unlimited AI" : exhausted ? "No credits left" : `${credits.remaining} credit${credits.remaining === 1 ? "" : "s"} left`}
        </p>
        <span style={{ fontSize: 11, color: "rgba(232,213,163,0.35)" }}>
          {unlimitedAi ? "Admin" : `${credits.used}/${credits.limit} used`}
        </span>
      </div>
      <div style={{ height: 4, background: "rgba(232,213,163,0.12)", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
        <div style={{ height: "100%", width: unlimitedAi ? "100%" : `${100 - pct}%`, background: unlimitedAi ? "#4A8B6A" : barColor, borderRadius: 4, transition: "width 0.3s ease" }} />
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "rgba(232,213,163,0.35)", lineHeight: 1.45 }}>
        {unlimitedAi
          ? `${creditsReferenceLabel(credits)} — not your limit`
          : exhausted
            ? "Resets monthly · Pro is unlimited"
            : "1 credit per AI action · Resets monthly"}
      </p>
    </div>
  );
}

export function CreditsSidebarBlock({
  credits,
  onUpgrade,
  unlimitedAi = false,
}: {
  credits: CreditBalance;
  onUpgrade?: () => void;
  unlimitedAi?: boolean;
}) {
  const exhausted = !unlimitedAi && isCreditsExhausted(credits);

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
        <CreditsMeter credits={credits} unlimitedAi={unlimitedAi} />
      </div>
      {!unlimitedAi && (exhausted ? (
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
      ))}
    </div>
  );
}

/** Compact pill — e.g. chat header, tool cards */
export function CreditCostBadge({ cost = 1 }: { cost?: number }) {
  const { showCredits, credits, exhausted, unlimitedAi, isAdmin } = useCredits();
  if (!showCredits || !credits) return null;

  return (
    <span
      title={unlimitedAi ? (isAdmin ? "Admin · unlimited AI" : "Pro · unlimited AI") : creditsSummary(credits)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 100,
        fontFamily: "var(--font-ui)",
        fontSize: 11,
        fontWeight: 600,
        background: exhausted ? "rgba(196,87,74,0.15)" : "rgba(26,58,47,0.08)",
        color: exhausted ? "#C4574A" : "#1A3A2F",
        whiteSpace: "nowrap",
      }}
    >
      {unlimitedAi
        ? (isAdmin ? "Unlimited · Admin" : "Unlimited · Pro")
        : `${cost} credit${cost !== 1 ? "s" : ""} · ${credits.remaining} left`}
    </span>
  );
}

type StatusBarProps = {
  variant?: "light" | "dark";
  onUpgrade?: () => void;
  className?: string;
};

/** Inline banner for drawers, chat, job tools — reads live balance from subscription. */
export function CreditsStatusBar({ variant = "light", onUpgrade }: StatusBarProps) {
  const { showCredits, credits, exhausted, low, unlimitedAi, isAdmin, startCheckout } = useCredits();
  if (!showCredits || !credits) return null;

  const isDark = variant === "dark";
  const showExhausted = !unlimitedAi && exhausted;
  const showLow = !unlimitedAi && low;
  const bg = showExhausted
    ? isDark ? "rgba(196,87,74,0.2)" : "rgba(196,87,74,0.08)"
    : showLow
      ? isDark ? "rgba(196,168,106,0.15)" : "rgba(196,168,106,0.12)"
      : isDark ? "rgba(232,213,163,0.1)" : "rgba(26,58,47,0.04)";
  const border = showExhausted
    ? "rgba(196,87,74,0.35)"
    : isDark ? "rgba(232,213,163,0.15)" : "rgba(26,58,47,0.1)";
  const accent = showExhausted ? "#C4574A" : isDark ? "#E8D5A3" : "#1A3A2F";
  const pct = credits.limit > 0 ? (credits.used / credits.limit) * 100 : 0;

  return (
    <div
      style={{
        padding: "10px 14px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <p style={{ margin: "0 0 6px", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: showExhausted ? "#C4574A" : accent }}>
            {unlimitedAi ? creditsSummary(credits, true) : showExhausted ? "Out of credits" : creditsSummary(credits)}
          </p>
          <div style={{ height: 4, background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: unlimitedAi ? "100%" : `${100 - Math.min(100, pct)}%`,
                background: showExhausted ? "#C4574A" : showLow ? "#C4A86A" : "#4A8B6A",
                borderRadius: 4,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <p style={{ margin: "6px 0 0", fontFamily: "var(--font-ui)", fontSize: 11, color: isDark ? "rgba(232,213,163,0.5)" : "var(--scout-muted)", lineHeight: 1.45 }}>
            {unlimitedAi
              ? `${creditsReferenceLabel(credits)} — ${isAdmin ? "admin" : "pro"}, not limited`
              : showExhausted
                ? "Upgrade for unlimited AI, or wait until next month."
                : `${credits.used} of ${credits.limit} used · 1 credit per AI action`}
          </p>
        </div>
        {showExhausted && (
          <button
            type="button"
            onClick={onUpgrade ?? (() => startCheckout())}
            data-offer="pro"
            data-trigger="credits_bar_exhausted"
            style={{
              padding: "8px 14px",
              background: "#1A3A2F",
              color: "#E8D5A3",
              border: "none",
              borderRadius: 8,
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Upgrade
          </button>
        )}
      </div>
    </div>
  );
}

export { FREE_MONTHLY_CREDITS };

/** Single-line hint for compact areas (chat input, tool lists). */
export function CreditsInlineHint() {
  const { showCredits, credits, exhausted, unlimitedAi } = useCredits();
  if (!showCredits || !credits) return null;

  return (
    <p
      style={{
        margin: "0 0 8px",
        fontFamily: "var(--font-ui)",
        fontSize: 11,
        fontWeight: 500,
        color: exhausted ? "#C4574A" : "var(--scout-muted)",
        lineHeight: 1.45,
      }}
    >
      {unlimitedAi
        ? "Unlimited AI · admin account (free plan is 15/mo for reference)"
        : exhausted
          ? "No credits left this month — upgrade for unlimited AI"
          : `${credits.remaining} of ${credits.limit} credits left · 1 per AI action`}
    </p>
  );
}
