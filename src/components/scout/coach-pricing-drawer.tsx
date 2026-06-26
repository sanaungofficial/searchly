"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  PLATFORM_TAKE_TIERS,
  RECOMMENDED_TIERS,
  SALES_ASSISTED_FEE_PERCENT,
  formatUsdFromCents,
  type BulkDiscountRow,
  type CoachPricingPayload,
  type PricingPackageRow,
} from "@/lib/coach-pricing";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

const DRAWER_WIDTH = "min(1180px, calc(100vw - 16px))";

type Props = {
  onClose?: () => void;
  coachSlug?: string | null;
  /** Admin: edit another coach's pricing */
  coachId?: string;
  /** Render inline (no overlay drawer shell) */
  embedded?: boolean;
};

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h3 style={{ ...displayTitleStyle(20), margin: "0 0 6px" }}>{title}</h3>
      {subtitle && (
        <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: "0 0 16px", lineHeight: 1.55 }}>
          {subtitle}
        </p>
      )}
      {children}
    </section>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        border: border.line,
        background: surface.card,
        padding: "16px 18px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "space-between" }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 15, fontWeight: 600 }}>{label}</p>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.muted, lineHeight: 1.55 }}>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          border: "none",
          background: checked ? color.forest : "rgba(26,58,47,0.15)",
          cursor: "pointer",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s ease",
          }}
        />
      </button>
    </div>
  );
}

function FaqItem({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: border.line }}>
      <span style={{ fontSize: 18, lineHeight: 1.2 }}>{icon}</span>
      <div>
        <p style={{ margin: "0 0 6px", fontFamily: fontSans, fontSize: 14, fontWeight: 600 }}>{title}</p>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.stone, lineHeight: 1.6 }}>{body}</p>
      </div>
    </div>
  );
}

export function CoachPricingDrawer({ onClose, coachSlug, coachId, embedded = false }: Props) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(embedded);
  const pricingApi = coachId ? `/api/admin/coaches/${coachId}/pricing` : "/api/coach/pricing";
  const [data, setData] = useState<CoachPricingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [hourlyDraft, setHourlyDraft] = useState("");
  const [editingRate, setEditingRate] = useState(false);
  const [earningsOpen, setEarningsOpen] = useState(false);
  const [showAllDiscounts, setShowAllDiscounts] = useState(false);
  const [addingDiscount, setAddingDiscount] = useState(false);
  const [newDiscountHours, setNewDiscountHours] = useState("");
  const [newDiscountPercent, setNewDiscountPercent] = useState("");
  const [packageFormOpen, setPackageFormOpen] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(pricingApi);
      if (!r.ok) throw new Error("Failed to load pricing");
      const payload = (await r.json()) as CoachPricingPayload;
      setData(payload);
      setHourlyDraft(payload.hourlyRate != null ? String(payload.hourlyRate) : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading pricing");
    } finally {
      setLoading(false);
    }
  }, [pricingApi]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (embedded) return;
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, [embedded]);

  const close = useCallback(() => {
    if (embedded) return;
    setVisible(false);
    if (onClose) window.setTimeout(onClose, 220);
  }, [onClose, embedded]);

  useEffect(() => {
    if (embedded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, embedded]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(pricingApi, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? "Save failed");
      }
      const payload = (await r.json()) as CoachPricingPayload;
      setData(payload);
      setHourlyDraft(payload.hourlyRate != null ? String(payload.hourlyRate) : "");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveHourlyRate() {
    const rate = hourlyDraft.trim() ? Math.max(1, Math.round(Number(hourlyDraft))) : null;
    if (hourlyDraft.trim() && !Number.isFinite(rate)) {
      setError("Enter a valid hourly rate");
      return;
    }
    await patch({ hourlyRate: rate });
    setEditingRate(false);
  }

  async function updateField(body: Record<string, unknown>) {
    await patch(body);
  }

  async function saveBulkDiscount(row: BulkDiscountRow, discountPercent: number) {
    await patch({
      bulkDiscounts: [{ id: row.id, minHours: row.minHours, discountPercent, enabled: row.enabled, sortOrder: row.sortOrder }],
    });
  }

  async function savePackage(pkg: Record<string, unknown>) {
    await patch({ packages: [pkg] });
    setPackageFormOpen(false);
    setEditingPackageId(null);
  }

  async function setPackageOffering(row: PricingPackageRow, enabled: boolean) {
    await patch({
      packages: [{
        id: row.id,
        title: row.title,
        description: row.description,
        hours: row.hours,
        hoursMax: row.hoursMax,
        syncedToHourly: row.syncedToHourly,
        isPublic: row.isPublic,
        enabled,
        sortOrder: row.sortOrder,
        priceCents: row.priceCents,
      }],
    });
  }

  async function deletePackage(id: string) {
    await patch({ deletePackageId: id });
  }

  async function addBulkDiscount() {
    const minHours = Math.round(Number(newDiscountHours));
    const discountPercent = Math.round(Number(newDiscountPercent));
    if (!Number.isFinite(minHours) || minHours < 1) {
      setError("Enter valid minimum hours");
      return;
    }
    if (!Number.isFinite(discountPercent) || discountPercent < 1) {
      setError("Enter a valid discount percent");
      return;
    }
    await patch({
      bulkDiscounts: [
        {
          minHours,
          discountPercent,
          enabled: true,
          sortOrder: (data?.bulkDiscounts.length ?? 0) + 1,
        },
      ],
    });
    setAddingDiscount(false);
    setNewDiscountHours("");
    setNewDiscountPercent("");
  }

  const visibleDiscounts = data?.bulkDiscounts ?? [];
  const discountsToShow = showAllDiscounts ? visibleDiscounts : visibleDiscounts.slice(0, 3);
  const profileSlug = coachSlug ?? data?.slug;

  const header = (
    <div
      style={{
        padding: isMobile ? "12px 16px" : embedded ? "0 0 14px" : "14px 28px",
        background: embedded ? "transparent" : surface.card,
        borderBottom: embedded ? "none" : border.line,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}
    >
      {!embedded && (
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: color.muted, padding: 0, lineHeight: 1 }}
        >
          ×
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...displayTitleStyle(embedded ? 22 : 18), margin: 0 }}>Pricing</p>
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "2px 0 0" }}>
          Set pricing and settings around custom hourly coaching
        </p>
      </div>
      {saved && (
        <span style={{ fontFamily: fontSans, fontSize: 13, color: color.forest, fontWeight: 600 }}>Saved</span>
      )}
    </div>
  );

  const body = (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
        padding: isMobile ? "20px 16px 32px" : embedded ? "0 0 32px" : "28px 32px 36px",
      }}
    >
          {loading && !data && (
            <p style={{ fontFamily: fontSans, color: color.muted }}>Loading pricing…</p>
          )}
          {error && (
            <div style={{ marginBottom: 16, padding: "12px 14px", border: border.line, background: "rgba(220,38,38,0.06)", color: "#b45309", fontFamily: fontSans, fontSize: 14 }}>
              {error}
            </div>
          )}

          {data && (
            <>
              <Section title="Hourly pricing">
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "240px 1fr", gap: 16, alignItems: "start" }}>
                  <Card>
                    <p style={{ margin: "0 0 4px", fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
                      Packages
                    </p>
                    <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: color.stone }}>
                      <strong>{data.syncedPackageCount}</strong> synced
                      {data.unsyncedPackageCount > 0 ? (
                        <>
                          {" "}
                          · <strong>{data.unsyncedPackageCount}</strong> unsynced
                        </>
                      ) : (
                        " · 0 unsynced"
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => updateField({ packagesSyncToHourly: !data.packagesSyncToHourly })}
                      style={{ marginTop: 10, background: "none", border: "none", padding: 0, fontFamily: fontSans, fontSize: 13, color: color.forest, cursor: "pointer", textDecoration: "underline" }}
                    >
                      {data.packagesSyncToHourly ? "Packages sync to hourly rate" : "Custom package prices"}
                    </button>
                  </Card>

                  <Card>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 14, color: color.muted }}>Your hourly price</p>
                        {editingRate ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontFamily: fontSans, fontSize: 22, fontWeight: 600 }}>$</span>
                            <input
                              type="number"
                              value={hourlyDraft}
                              onChange={(e) => setHourlyDraft(e.target.value)}
                              style={{ width: 100, fontSize: 22, fontWeight: 600, padding: "4px 8px", border: border.line, fontFamily: fontSans }}
                              autoFocus
                            />
                            <span style={{ fontFamily: fontSans, fontSize: 16, color: color.muted }}>per hour</span>
                            <ScoutPrimaryBtn onClick={saveHourlyRate} disabled={saving} style={{ minHeight: 36, fontSize: 13 }}>
                              Save
                            </ScoutPrimaryBtn>
                            <ScoutSecondaryBtn onClick={() => { setEditingRate(false); setHourlyDraft(data.hourlyRate != null ? String(data.hourlyRate) : ""); }} style={{ minHeight: 36, fontSize: 13 }}>
                              Cancel
                            </ScoutSecondaryBtn>
                          </div>
                        ) : (
                          <p style={{ margin: 0, fontFamily: fontSans, fontSize: 26, fontWeight: 600, color: color.forest }}>
                            {data.hourlyRate != null ? `$${data.hourlyRate}` : "$0"}{" "}
                            <span style={{ fontSize: 16, fontWeight: 400, color: color.muted }}>per hour</span>
                          </p>
                        )}
                      </div>
                      {!editingRate && (
                        <button
                          type="button"
                          onClick={() => setEditingRate(true)}
                          aria-label="Edit hourly rate"
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: color.muted, padding: 4 }}
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  </Card>
                </div>

                <div style={{ marginTop: 20 }}>
                  <p style={{ margin: "0 0 10px", fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
                    Recommended pricing
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    {RECOMMENDED_TIERS.map((tier) => {
                      const active = data.recommendedTier.id === tier.id;
                      return (
                        <div
                          key={tier.id}
                          style={{
                            padding: "10px 14px",
                            background: tier.bg,
                            border: active ? `2px solid ${color.forest}` : border.line,
                            minWidth: 120,
                          }}
                        >
                          <p style={{ margin: "0 0 2px", fontFamily: fontSans, fontSize: 13, fontWeight: 700, color: tier.color }}>{tier.label}</p>
                          <p style={{ margin: 0, fontFamily: fontSans, fontSize: 12, color: color.stone }}>
                            ${tier.minRate}
                            {tier.maxRate != null ? ` – $${tier.maxRate}` : "+"}/hr
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ margin: 0, fontFamily: fontSans, fontSize: 12, color: color.muted }}>
                    Most clients have budget in the New and Experienced ranges
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEarningsOpen((v) => !v)}
                  style={{
                    marginTop: 16,
                    width: "100%",
                    textAlign: "left",
                    background: surface.inset,
                    border: border.line,
                    padding: "12px 14px",
                    cursor: "pointer",
                    fontFamily: fontSans,
                    fontSize: 14,
                    fontWeight: 600,
                    color: color.forest,
                  }}
                >
                  {earningsOpen ? "▾" : "▸"} Learn about your take-home earnings
                </button>
                {earningsOpen && (
                  <Card style={{ marginTop: 8 }}>
                    <p style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: 13, color: color.stone, lineHeight: 1.55 }}>
                      Pricing on your profile is what clients see — not your take-home rate. Kimchi&apos;s platform fee starts at 20% (plus Stripe fees) and slides down to 5% as a client spends more with you. Your own referrals are 5% + Stripe fees.
                    </p>
                    <div style={{ marginBottom: 16 }}>
                      {PLATFORM_TAKE_TIERS.map((tier) => (
                        <p key={tier.label} style={{ margin: "0 0 6px", fontFamily: fontSans, fontSize: 13 }}>
                          <strong>{tier.label}:</strong> {tier.platformPercent}% platform fee
                        </p>
                      ))}
                      <p style={{ margin: "8px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted }}>
                        Sales-assisted leads add {SALES_ASSISTED_FEE_PERCENT}% on top of the platform fee.
                      </p>
                    </div>
                    {data.takeHomeExamples.length > 0 && (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: fontSans }}>
                          <thead>
                            <tr style={{ borderBottom: border.line }}>
                              {["Scenario", "Client pays", "Platform", "Stripe", "You keep"].map((h) => (
                                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", color: color.muted, fontWeight: 400 }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.takeHomeExamples.map((row) => (
                              <tr key={row.scenario} style={{ borderBottom: "1px solid rgba(26,58,47,0.06)" }}>
                                <td style={{ padding: "8px 10px" }}>{row.scenario}</td>
                                <td style={{ padding: "8px 10px" }}>{formatUsdFromCents(row.clientPays)}</td>
                                <td style={{ padding: "8px 10px" }}>{formatUsdFromCents(row.platformFee)}</td>
                                <td style={{ padding: "8px 10px" }}>{formatUsdFromCents(row.stripeFee)}</td>
                                <td style={{ padding: "8px 10px", fontWeight: 600, color: color.forest }}>{formatUsdFromCents(row.takeHome)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                )}
              </Section>

              <Section title="Bulk discounts" subtitle="Give clients a discount when they purchase more hours at once.">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {discountsToShow.map((row) => (
                    <BulkDiscountRowEditor key={row.id} row={row} saving={saving} onSave={saveBulkDiscount} />
                  ))}
                </div>
                {visibleDiscounts.length > 3 && !showAllDiscounts && (
                  <button
                    type="button"
                    onClick={() => setShowAllDiscounts(true)}
                    style={{ marginTop: 10, background: "none", border: "none", padding: 0, fontFamily: fontSans, fontSize: 13, color: color.forest, cursor: "pointer", textDecoration: "underline" }}
                  >
                    Show more
                  </button>
                )}
                {addingDiscount ? (
                  <Card style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <input
                        type="number"
                        placeholder="Min hours"
                        value={newDiscountHours}
                        onChange={(e) => setNewDiscountHours(e.target.value)}
                        style={{ width: 100, padding: "8px 10px", border: border.line, fontFamily: fontSans }}
                      />
                      <span style={{ fontFamily: fontSans, fontSize: 14 }}>+ hours =</span>
                      <input
                        type="number"
                        placeholder="% off"
                        value={newDiscountPercent}
                        onChange={(e) => setNewDiscountPercent(e.target.value)}
                        style={{ width: 80, padding: "8px 10px", border: border.line, fontFamily: fontSans }}
                      />
                      <span style={{ fontFamily: fontSans, fontSize: 14 }}>% discount</span>
                      <ScoutPrimaryBtn onClick={addBulkDiscount} disabled={saving} style={{ minHeight: 36 }}>
                        Add
                      </ScoutPrimaryBtn>
                      <ScoutSecondaryBtn onClick={() => setAddingDiscount(false)} style={{ minHeight: 36 }}>
                        Cancel
                      </ScoutSecondaryBtn>
                    </div>
                  </Card>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingDiscount(true)}
                    style={{ marginTop: 12, background: "none", border: "none", padding: 0, fontFamily: fontSans, fontSize: 13, color: color.forest, cursor: "pointer", fontWeight: 600 }}
                  >
                    + Add bulk discount
                  </button>
                )}
              </Section>

              <Section title="Choose your first step" subtitle="Intro calls help clients get to know you and improve conversion.">
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <FirstStepCard
                    active={data.introOfferType === "FREE_INTRO"}
                    badge="Recommended"
                    title="Free intro call"
                    subtitle={`${data.introDurationMinutes} minutes · Get to know your coach`}
                    onSelect={() => updateField({ introOfferType: "FREE_INTRO" })}
                  />
                  <FirstStepCard
                    active={data.introOfferType === "TRIAL_SESSION"}
                    title="Trial session"
                    subtitle={
                      data.trialSessionDurationMinutes
                        ? `${data.trialSessionDurationMinutes} min · Paid trial session`
                        : "Custom duration · Paid trial session"
                    }
                    onSelect={() => updateField({ introOfferType: "TRIAL_SESSION", trialSessionDurationMinutes: data.trialSessionDurationMinutes ?? 30 })}
                  />
                </div>
                {data.introOfferType === "TRIAL_SESSION" && (
                  <Card style={{ marginTop: 12 }}>
                    <label style={{ fontFamily: fontSans, fontSize: 13, color: color.stone }}>
                      Trial duration (minutes)
                      <input
                        type="number"
                        value={data.trialSessionDurationMinutes ?? 30}
                        onChange={(e) => setData((d) => d && ({ ...d, trialSessionDurationMinutes: Number(e.target.value) }))}
                        onBlur={() =>
                          updateField({ trialSessionDurationMinutes: data.trialSessionDurationMinutes ?? 30 })
                        }
                        style={{ display: "block", marginTop: 6, width: 120, padding: "8px 10px", border: border.line, fontFamily: fontSans }}
                      />
                    </label>
                  </Card>
                )}
                {data.introOfferType === "FREE_INTRO" && (
                  <Card style={{ marginTop: 12 }}>
                    <label style={{ fontFamily: fontSans, fontSize: 13, color: color.stone }}>
                      Intro call duration (minutes)
                      <input
                        type="number"
                        value={data.introDurationMinutes}
                        onChange={(e) => setData((d) => d && ({ ...d, introDurationMinutes: Number(e.target.value) }))}
                        onBlur={() => updateField({ introDurationMinutes: data.introDurationMinutes })}
                        style={{ display: "block", marginTop: 6, width: 120, padding: "8px 10px", border: border.line, fontFamily: fontSans }}
                      />
                    </label>
                  </Card>
                )}
                <p style={{ margin: "12px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted }}>
                  Free intro calls generally result in more leads.
                </p>
              </Section>

              <Section title="Want more leads?">
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <Toggle
                    checked={data.salesAssistedLeadsEnabled}
                    onChange={(v) => updateField({ salesAssistedLeadsEnabled: v })}
                    label="Sales-assisted leads"
                    description={`Opt in to receive high-intent clients matched by the Kimchi sales team. A ${SALES_ASSISTED_FEE_PERCENT}% sales fee applies only when we source the lead.`}
                  />
                  <Toggle
                    checked={data.partnerProgramEnabled}
                    onChange={(v) => updateField({ partnerProgramEnabled: v })}
                    label="Receive partner program opportunities"
                    description="Opt in for university and business partner leads. Typical rates are $50–$75/hr depending on program."
                  />
                </div>
              </Section>

              <PackagesSection
                packages={data.packages}
                categoryLabel={data.category ?? "Coaching"}
                profileSlug={profileSlug}
                saving={saving}
                packageFormOpen={packageFormOpen}
                editingPackageId={editingPackageId}
                onOpenCreate={() => {
                  setEditingPackageId(null);
                  setPackageFormOpen(true);
                }}
                onCloseForm={() => {
                  setPackageFormOpen(false);
                  setEditingPackageId(null);
                }}
                onEdit={(id) => {
                  setEditingPackageId(id);
                  setPackageFormOpen(true);
                }}
                onSave={savePackage}
                onSetOffering={setPackageOffering}
                onDelete={deletePackage}
              />

              <Section title="Custom hourly services" subtitle="Time added to a client's balance at your hourly rate — ideal for ongoing coaching relationships.">
                <Card>
                  <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: color.stone, lineHeight: 1.55 }}>
                    Your hourly rate ({data.hourlyRate != null ? `$${data.hourlyRate}/hr` : "not set yet"}) applies when clients purchase custom hours outside fixed packages.
                  </p>
                </Card>
              </Section>

              <Section title="Good to know">
                <FaqItem
                  icon="💵"
                  title="Refund policy"
                  body="Clients may request a refund within 14 days of purchase for unused coaching credits. Used sessions are non-refundable. Refunds return to the client's original payment method."
                />
                <FaqItem
                  icon="📅"
                  title="Expiration terms"
                  body="Purchased coaching hours expire based on package size — typically 90 days for small packages up to 12 months for larger bundles. Clients are notified before credits expire."
                />
                <FaqItem
                  icon="❓"
                  title="What do fees cover?"
                  body="Platform fees cover marketing to bring you clients, payment processing, video hosting, scheduling tools, and ongoing product support."
                />
                <FaqItem
                  icon="💳"
                  title="Available payment plans"
                  body="Clients can split larger purchases into payment plans at checkout. Payment plans do not affect your payout timing or take-home amount per session."
                />
              </Section>
            </>
          )}
    </div>
  );

  if (embedded) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%" }}>
        {header}
        {body}
      </div>
    );
  }

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
        {header}
        {body}
      </div>
    </>
  );
}

function BulkDiscountRowEditor({
  row,
  saving,
  onSave,
}: {
  row: BulkDiscountRow;
  saving: boolean;
  onSave: (row: BulkDiscountRow, percent: number) => void;
}) {
  const [draft, setDraft] = useState(String(row.discountPercent));
  useEffect(() => {
    setDraft(String(row.discountPercent));
  }, [row.discountPercent]);

  return (
    <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontFamily: fontSans, fontSize: 14 }}>
        {row.minHours}+ hours ={" "}
        <input
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = Math.round(Number(draft));
            if (Number.isFinite(n) && n >= 0 && n !== row.discountPercent) onSave(row, n);
          }}
          style={{ width: 48, padding: "2px 6px", border: border.line, fontFamily: fontSans, fontSize: 14 }}
        />
        % discount
      </span>
      <button
        type="button"
        aria-label="Edit discount"
        disabled={saving}
        onClick={() => {
          const n = Math.round(Number(draft));
          if (Number.isFinite(n)) onSave(row, n);
        }}
        style={{ background: "none", border: "none", cursor: "pointer", color: color.muted, fontSize: 16 }}
      >
        ✎
      </button>
    </Card>
  );
}

function PackagesSection({
  packages,
  categoryLabel,
  profileSlug,
  saving,
  packageFormOpen,
  editingPackageId,
  onOpenCreate,
  onCloseForm,
  onEdit,
  onSave,
  onSetOffering,
  onDelete,
}: {
  packages: PricingPackageRow[];
  categoryLabel: string;
  profileSlug: string | null | undefined;
  saving: boolean;
  packageFormOpen: boolean;
  editingPackageId: string | null;
  onOpenCreate: () => void;
  onCloseForm: () => void;
  onEdit: (id: string) => void;
  onSave: (pkg: Record<string, unknown>) => Promise<void>;
  onSetOffering: (row: PricingPackageRow, enabled: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const offering = packages.filter((p) => p.enabled);
  const notOffering = packages.filter((p) => !p.enabled);
  const editingPackage = editingPackageId ? packages.find((p) => p.id === editingPackageId) : null;

  return (
    <Section
      title="Packages"
      subtitle="Packages are statements of work linked to a specified amount of time. Public packages appear on your profile; private packages can still be shared via direct link."
    >
      <p style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.stone }}>
        Your {categoryLabel} packages
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <ScoutPrimaryBtn onClick={onOpenCreate} disabled={saving} style={{ minHeight: 38, fontSize: 13 }}>
          + Create new
        </ScoutPrimaryBtn>
      </div>

      {packageFormOpen && (
        <PackageForm
          initial={editingPackage ?? undefined}
          saving={saving}
          onCancel={onCloseForm}
          onSave={onSave}
        />
      )}

      <PackageGroup title="Offering" packages={offering} profileSlug={profileSlug} saving={saving} onSetOffering={onSetOffering} onEdit={onEdit} onDelete={onDelete} />
      <PackageGroup
        title="Not offering"
        packages={notOffering}
        profileSlug={profileSlug}
        saving={saving}
        onSetOffering={onSetOffering}
        onEdit={onEdit}
        onDelete={onDelete}
        emptyMessage="No packages here — create one or set a package to Don't offer."
      />

      {profileSlug && (
        <Link
          href={`/coaching/coach/${profileSlug}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 16,
            padding: "14px 16px",
            border: border.line,
            background: surface.inset,
            textDecoration: "none",
            color: color.forest,
            fontFamily: fontSans,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          See how your clients view offerings
          <span>→</span>
        </Link>
      )}
    </Section>
  );
}

function PackageGroup({
  title,
  packages,
  profileSlug,
  saving,
  onSetOffering,
  onEdit,
  onDelete,
  emptyMessage,
}: {
  title: string;
  packages: PricingPackageRow[];
  profileSlug: string | null | undefined;
  saving: boolean;
  onSetOffering: (row: PricingPackageRow, enabled: boolean) => Promise<void>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  emptyMessage?: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ margin: "0 0 8px", fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
        {title}
      </p>
      <div style={{ border: border.line, background: surface.card }}>
        {packages.length === 0 ? (
          <p style={{ margin: 0, padding: "16px 18px", fontFamily: fontSans, fontSize: 13, color: color.muted }}>
            {emptyMessage ?? "No packages in this group."}
          </p>
        ) : (
          packages.map((pkg, i) => (
            <PackageRow
              key={pkg.id}
              pkg={pkg}
              profileSlug={profileSlug}
              saving={saving}
              isLast={i === packages.length - 1}
              onSetOffering={onSetOffering}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PackageRow({
  pkg,
  profileSlug,
  saving,
  isLast,
  onSetOffering,
  onEdit,
  onDelete,
}: {
  pkg: PricingPackageRow;
  profileSlug: string | null | undefined;
  saving: boolean;
  isLast: boolean;
  onSetOffering: (row: PricingPackageRow, enabled: boolean) => Promise<void>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const packageUrl =
    profileSlug && typeof window !== "undefined"
      ? `${window.location.origin}/coaching/coach/${profileSlug}?package=${pkg.id}`
      : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderBottom: isLast ? "none" : border.line,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          width: 56,
          height: 40,
          background: "rgba(26,58,47,0.06)",
          border: border.line,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fontMono,
          fontSize: 11,
          color: color.muted,
        }}
      >
        {pkg.displayHoursLabel}
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <button
          type="button"
          onClick={() => onEdit(pkg.id)}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
        >
          <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.forest, textDecoration: "underline" }}>
            {pkg.displayTitle}
          </p>
        </button>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 12, color: color.muted }}>
          {pkg.displayHoursLabel}
          {pkg.displayPriceLabel ? ` · ${pkg.displayPriceLabel}` : ""}
          {pkg.syncedToHourly ? " · synced" : " · custom price"}
          {!pkg.isPublic ? " · private" : ""}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <select
          value={pkg.enabled ? "offering" : "dont_offer"}
          disabled={saving}
          onChange={(e) => onSetOffering(pkg, e.target.value === "offering")}
          style={{
            padding: "8px 10px",
            border: border.line,
            fontFamily: fontSans,
            fontSize: 13,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="offering">Offering</option>
          <option value="dont_offer">Don&apos;t offer</option>
        </select>
        {packageUrl && (
          <button
            type="button"
            title="Copy package link"
            onClick={() => {
              navigator.clipboard.writeText(packageUrl).catch(() => {});
            }}
            style={{
              padding: "8px 10px",
              border: border.line,
              background: "#fff",
              cursor: "pointer",
              fontFamily: fontSans,
              fontSize: 14,
            }}
          >
            🔗
          </button>
        )}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Package actions"
            style={{ padding: "8px 10px", border: border.line, background: "#fff", cursor: "pointer", fontSize: 16 }}
          >
            ⋮
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: 4,
                background: "#fff",
                border: border.line,
                boxShadow: "2px 2px 0 rgba(0,0,0,0.06)",
                zIndex: 10,
                minWidth: 120,
              }}
            >
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onEdit(pkg.id); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", border: "none", background: "none", fontFamily: fontSans, fontSize: 13, cursor: "pointer" }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onDelete(pkg.id); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", border: "none", background: "none", fontFamily: fontSans, fontSize: 13, cursor: "pointer", color: "#b45309" }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PackageForm({
  initial,
  saving,
  onCancel,
  onSave,
}: {
  initial?: PricingPackageRow;
  saving: boolean;
  onCancel: () => void;
  onSave: (pkg: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? initial?.displayTitle ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [hours, setHours] = useState(String(initial?.hours ?? 1));
  const [hoursMax, setHoursMax] = useState(initial?.hoursMax != null ? String(initial.hoursMax) : "");
  const [syncedToHourly, setSyncedToHourly] = useState(initial?.syncedToHourly ?? true);
  const [priceUsd, setPriceUsd] = useState(
    initial?.priceCents != null ? String(Math.round(initial.priceCents / 100)) : "",
  );
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? true);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const h = Math.round(Number(hours));
    if (!title.trim() || !Number.isFinite(h) || h < 1) return;
    const maxRaw = hoursMax.trim() ? Math.round(Number(hoursMax)) : null;
    await onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      title: title.trim(),
      description: description.trim() || null,
      hours: h,
      hoursMax: maxRaw != null && Number.isFinite(maxRaw) && maxRaw > h ? maxRaw : null,
      syncedToHourly,
      priceCents: !syncedToHourly && priceUsd.trim() ? Math.round(Number(priceUsd) * 100) : null,
      isPublic,
      enabled,
      sortOrder: initial?.sortOrder ?? 999,
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    border: border.line,
    fontFamily: fontSans,
    fontSize: 14,
    boxSizing: "border-box",
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <form onSubmit={submit}>
        <p style={{ margin: "0 0 14px", fontFamily: fontSans, fontSize: 15, fontWeight: 600 }}>
          {initial ? "Edit package" : "Create package"}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontFamily: fontSans, fontSize: 13 }}>
            Title *
            <input required value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} placeholder="e.g. Interview prep intensive" />
          </label>
          <label style={{ fontFamily: fontSans, fontSize: 13 }}>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, marginTop: 6, resize: "vertical" }} placeholder="What clients get in this package…" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ fontFamily: fontSans, fontSize: 13 }}>
              Hours (min) *
              <input type="number" min={1} required value={hours} onChange={(e) => setHours(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
            </label>
            <label style={{ fontFamily: fontSans, fontSize: 13 }}>
              Hours (max)
              <input type="number" min={1} value={hoursMax} onChange={(e) => setHoursMax(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} placeholder="Optional range" />
            </label>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: fontSans, fontSize: 13 }}>
            <input type="checkbox" checked={syncedToHourly} onChange={(e) => setSyncedToHourly(e.target.checked)} />
            Sync price to hourly rate and bulk discounts
          </label>
          {!syncedToHourly && (
            <label style={{ fontFamily: fontSans, fontSize: 13 }}>
              Custom price (USD)
              <input type="number" min={1} value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
            </label>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: fontSans, fontSize: 13 }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Show on public profile
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: fontSans, fontSize: 13 }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Currently offering this package
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <ScoutPrimaryBtn type="submit" disabled={saving} style={{ minHeight: 38 }}>
            {saving ? "Saving…" : initial ? "Save package" : "Create package"}
          </ScoutPrimaryBtn>
          <ScoutSecondaryBtn type="button" onClick={onCancel} style={{ minHeight: 38 }}>
            Cancel
          </ScoutSecondaryBtn>
        </div>
      </form>
    </Card>
  );
}

function FirstStepCard({
  active,
  badge,
  title,
  subtitle,
  onSelect,
}: {
  active: boolean;
  badge?: string;
  title: string;
  subtitle: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        textAlign: "left",
        border: active ? `2px solid ${color.forest}` : border.line,
        background: active ? "rgba(45,122,80,0.06)" : surface.card,
        padding: "16px 18px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: `2px solid ${active ? color.forest : color.muted}`,
            background: active ? color.forest : "transparent",
            boxShadow: active ? "inset 0 0 0 3px #fff" : "none",
            flexShrink: 0,
          }}
        />
        {badge && (
          <span style={{ fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: color.forest, background: "rgba(45,122,80,0.1)", padding: "2px 6px" }}>
            {badge}
          </span>
        )}
      </div>
      <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 15, fontWeight: 600 }}>{title}</p>
      <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.muted }}>{subtitle}</p>
    </button>
  );
}
