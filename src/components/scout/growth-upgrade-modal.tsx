"use client";

import { useSubscription } from "@/hooks/useSubscription";
import { ScoutModal } from "@/components/scout/scout-modal";

export type GrowthUpgradeTrigger = "limit_hit" | "low_match" | "usage_warning" | "coaching";

const COPY: Record<
  GrowthUpgradeTrigger,
  { title: string; body: string; primary: string; secondary?: string }
> = {
  limit_hit: {
    title: "You're out of credits this month",
    body: "Free includes 15 AI credits per month — match, tailor, cover letter, and Scout. Pro removes the cap.",
    primary: "View Pro plans",
  },
  low_match: {
    title: "Low match on this role",
    body: "A score under 6 usually means your resume isn't lining up with the listing yet. Pro lets you tailor without using another credit — or talk to a coach about repositioning.",
    primary: "Upgrade to Pro",
    secondary: "Find a coach",
  },
  usage_warning: {
    title: "Running low on credits",
    body: "A few credits left this month. Pro removes the monthly cap on match, tailor, cover letters, and Scout.",
    primary: "Upgrade to Pro",
  },
  coaching: {
    title: "Coaching is a Pro feature",
    body: "Pro unlocks 1:1 sessions with career coaches — book time, see rates, and get help on your search.",
    primary: "View plans",
  },
};

type Props = {
  trigger: GrowthUpgradeTrigger;
  onClose: () => void;
  /** Opens full pricing modal (interval picker). Falls back to direct checkout. */
  onOpenPricing?: () => void;
  /** When set, secondary CTA navigates here (e.g. /coaching). */
  secondaryHref?: string;
};

export function GrowthUpgradeModal({ trigger, onClose, onOpenPricing, secondaryHref }: Props) {
  const { startCheckout, loading } = useSubscription();
  const copy = COPY[trigger];

  const handlePrimary = async () => {
    if (onOpenPricing) {
      onOpenPricing();
      onClose();
      return;
    }
    await startCheckout();
  };

  return (
    <ScoutModal open bruddle onClose={onClose} ariaLabelledBy="growth-upgrade-title" maxWidth={420} padding="36px 32px" zIndex={70}>
        <p
          id="growth-upgrade-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 600,
            fontStyle: "italic",
            color: "#1a1a1a",
            marginBottom: 10,
            lineHeight: 1.3,
          }}
        >
          {copy.title}
        </p>
        <p
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 14,
            color: "var(--scout-muted)",
            lineHeight: 1.65,
            marginBottom: 28,
          }}
        >
          {copy.body}
        </p>
        <button
          onClick={handlePrimary}
          disabled={loading}
          data-offer="pro"
          data-trigger={trigger}
          style={{
            display: "block",
            width: "100%",
            padding: "12px 0",
            background: "var(--scout-cta)",
            color: "var(--scout-cta-foreground)",
            borderRadius: "var(--scout-radius)",
            fontFamily: "var(--font-ui)",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
            marginBottom: copy.secondary ? 10 : 0,
          }}
        >
          {loading ? "Redirecting…" : copy.primary}
        </button>
        {copy.secondary && secondaryHref && (
          <a
            href={secondaryHref}
            data-offer="coaching"
            data-trigger={trigger}
            style={{
              display: "block",
              width: "100%",
              padding: "12px 0",
              background: "var(--scout-inset)",
              color: "#1A3A2F",
              borderRadius: "var(--scout-radius)",
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              textAlign: "center",
              border: "1px solid rgba(26,58,47,0.15)",
              marginBottom: 10,
            }}
          >
            {copy.secondary}
          </a>
        )}
        <button
          onClick={onClose}
          style={{
            display: "block",
            width: "100%",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-ui)",
            fontSize: 14,
            color: "var(--scout-muted)",
            marginTop: copy.secondary ? 0 : 10,
          }}
        >
          Maybe later
        </button>
    </ScoutModal>
  );
}

/** Inline banner for low resume-match scores — not a blocking modal. */
export function GrowthMatchOffer({
  onUpgrade,
  isPro,
}: {
  onUpgrade: () => void;
  isPro: boolean;
}) {
  if (isPro) {
    return (
      <div
        style={{
          marginTop: 14,
          padding: "14px 16px",
          background: "rgba(26,58,47,0.04)",
          borderRadius: "var(--scout-radius)",
          border: "1px solid rgba(26,58,47,0.12)",
        }}
      >
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#52493F", margin: "0 0 10px", lineHeight: 1.55 }}>
          Want a second opinion on positioning? A coach can help you reframe this role.
        </p>
        <a
          href="/coaching"
          data-offer="coaching"
          data-trigger="low_match"
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 14,
            fontWeight: 600,
            color: "#1A3A2F",
            textDecoration: "none",
          }}
        >
          Find a coach →
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 14,
        padding: "14px 16px",
        background: "rgba(196,87,74,0.06)",
        borderRadius: "var(--scout-radius)",
        border: "1px solid rgba(196,87,74,0.15)",
      }}
    >
      <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#52493F", margin: "0 0 12px", lineHeight: 1.55 }}>
        Pro tailors your resume for this role without using another credit. Or talk to a coach about repositioning.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onUpgrade}
          data-offer="pro"
          data-trigger="low_match"
          style={{
            padding: "8px 16px",
            background: "var(--scout-cta)",
            color: "var(--scout-cta-foreground)",
            border: "none",
            borderRadius: "var(--scout-radius)",
            fontFamily: "var(--font-ui)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Upgrade to Pro
        </button>
        <a
          href="/coaching"
          data-offer="coaching"
          data-trigger="low_match"
          style={{
            padding: "8px 16px",
            background: "transparent",
            color: "#1A3A2F",
            border: "1px solid rgba(26,58,47,0.2)",
            borderRadius: "var(--scout-radius)",
            fontFamily: "var(--font-ui)",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Find a coach
        </a>
      </div>
    </div>
  );
}
