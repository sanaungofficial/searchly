"use client";

import { PricingPanel } from "./pricing-panel";

type Props = {
  onClose: () => void;
};

export function PricingModal({ onClose }: Props) {
  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 200,
        }}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-labelledby="pricing-modal-title"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 920,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "90vh",
          overflow: "auto",
          background: "var(--scout-page)",
          borderRadius: 16,
          zIndex: 201,
          padding: "24px 28px 28px",
          fontFamily: "var(--font-ui), sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span id="pricing-modal-title" style={{ fontSize: 13, fontWeight: 600, color: "#8A7F72", letterSpacing: "0.3px" }}>
            PLANS & PRICING
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: 4, color: "#8A7F72" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <PricingPanel compact />
      </div>
    </>
  );
}
