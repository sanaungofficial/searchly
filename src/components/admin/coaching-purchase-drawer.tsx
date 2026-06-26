"use client";

import { useCallback, useEffect, useState } from "react";
import { ScoutBox } from "@/components/scout/scout-box";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatUsdFromCents } from "@/lib/coach-pricing";
import { formatPurchaseLeadSource, formatPurchaseStatus, type AdminPurchaseRow } from "@/lib/coach-purchase";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

const DRAWER_WIDTH = "min(720px, calc(100vw - 16px))";

export function CoachingPurchaseDrawer({
  purchase,
  onClose,
}: {
  purchase: AdminPurchaseRow;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const paidDate = purchase.paidAt ? new Date(purchase.paidAt) : null;
  const createdDate = new Date(purchase.createdAt);

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 60 }} />
      <div
        style={{
          position: "fixed",
          top: isMobile ? 0 : 8,
          right: isMobile ? 0 : 8,
          bottom: isMobile ? 0 : 8,
          left: isMobile ? 0 : undefined,
          width: isMobile ? "100vw" : DRAWER_WIDTH,
          maxWidth: isMobile ? "100vw" : "calc(100vw - 16px)",
          background: surface.page,
          overflow: "hidden",
          zIndex: 70,
          boxShadow: isMobile ? "none" : "3px 3px 0 rgba(17,17,17,0.08)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: isMobile ? "12px 16px" : "14px 28px",
            background: surface.card,
            borderBottom: border.line,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: color.muted, padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...displayTitleStyle(18), margin: 0 }}>Purchase details</p>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "2px 0 0" }}>
              {purchase.packageTitle}
            </p>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "20px 16px 32px" : "28px 32px 36px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <DetailBlock label="Status" value={formatPurchaseStatus(purchase.status)} />
            <DetailBlock label="Lead source" value={formatPurchaseLeadSource(purchase.leadSource)} />
            <DetailBlock label="Client" value={purchase.buyerName ?? purchase.buyerEmail ?? "—"} />
            <DetailBlock label="Email" value={purchase.buyerEmail ?? "—"} />
            <DetailBlock label="Coach" value={purchase.coachName} />
            <DetailBlock
              label="Hours balance"
              value={`${purchase.hoursRemaining} of ${purchase.hoursGranted} remaining`}
            />
            <DetailBlock
              label="Created"
              value={createdDate.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            />
            <DetailBlock
              label="Paid"
              value={paidDate ? paidDate.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"}
            />
          </div>

          <ScoutBox padding="16px 18px" style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 12px", fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
              Fee breakdown
            </p>
            {[
              { label: "Client paid", value: formatUsdFromCents(purchase.amountCents) },
              { label: "Platform fee", value: formatUsdFromCents(purchase.platformFeeCents) },
              { label: "Stripe fee (est.)", value: formatUsdFromCents(purchase.stripeFeeCents) },
              { label: "Coach payout", value: formatUsdFromCents(purchase.coachPayoutCents), highlight: true },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: border.line,
                  fontFamily: fontSans,
                  fontSize: 14,
                }}
              >
                <span style={{ color: color.muted }}>{row.label}</span>
                <span style={{ fontWeight: row.highlight ? 600 : 400, color: row.highlight ? color.forest : color.ink }}>
                  {row.value}
                </span>
              </div>
            ))}
          </ScoutBox>

          {purchase.salesAssisted && (
            <p style={{ margin: "0 0 16px", fontFamily: fontSans, fontSize: 13, color: "#b45309", lineHeight: 1.5 }}>
              Sales-assisted purchase — includes additional sales team fee in platform take.
            </p>
          )}

          <div style={{ fontFamily: fontMono, fontSize: 11, color: color.muted, lineHeight: 1.6 }}>
            {purchase.stripeCheckoutSessionId && <p style={{ margin: "0 0 4px" }}>Checkout: {purchase.stripeCheckoutSessionId}</p>}
            {purchase.stripePaymentIntentId && <p style={{ margin: 0 }}>Payment: {purchase.stripePaymentIntentId}</p>}
          </div>
        </div>
      </div>
    </>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: "0 0 4px", fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
        {label}
      </p>
      <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: color.stone }}>{value}</p>
    </div>
  );
}
