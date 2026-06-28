"use client";

import React, { useMemo, useRef, useState } from "react";
import { LinkedInIcon } from "./icons";
import {
  COACH_CLIENT_SPECIALIZATIONS,
  COACH_CLIENT_TIERS,
  COACH_EXPERIENCE_LEVELS,
  COACH_GOALS,
  categoriesForGoal,
  expertiseForCategory,
  type CoachGoalId,
} from "@/lib/coach-categories";
import type { CoachOnboardingDraft } from "@/lib/coach-onboarding";
import { linkedInHandleFromUrl, normalizeLinkedInUrl } from "@/lib/linkedin-url";

export type CoachOnboardingScreen = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const COACH_ONBOARDING_STEP_COUNT = 9;

const FULL = "#1A3A2F";
const EMPTY = "rgba(26,58,47,0.15)";

const DISPLAY_H2: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(1.875rem, 8vw, 3.125rem)",
  fontWeight: 500,
  fontStyle: "italic",
  color: "#1A1A1A",
  lineHeight: 1.05,
  letterSpacing: "-0.2px",
};

const ONBOARDING_BODY: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "clamp(1rem, 2.5vw, 1.125rem)",
  fontWeight: 400,
  color: "#52493F",
  lineHeight: 1.7,
};

const ONBOARDING_CARD: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "var(--scout-radius)",
  padding: "clamp(16px, 4vw, 24px)",
  border: "1px solid rgba(26,58,47,0.14)",
  boxShadow: "0 2px 10px rgba(26,58,47,0.06)",
};

const ONBOARDING_FIELD_BG = "var(--scout-inset)";
const ONBOARDING_FIELD_BORDER = "1.5px solid rgba(26,58,47,0.2)";
const ONBOARDING_TEXT = "#1A1A1A";
const ONBOARDING_TEXT_SECONDARY = "#52493F";

const PRIMARY_CTA: React.CSSProperties = {
  padding: "14px 30px",
  background: "var(--scout-cta)",
  color: "var(--scout-cta-foreground)",
  border: "none",
  borderRadius: "var(--scout-radius)",
  fontFamily: "var(--font-ui)",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  letterSpacing: "0.2px",
  transition: "opacity 0.15s",
  minHeight: 48,
};

const SECONDARY_CTA: React.CSSProperties = {
  ...PRIMARY_CTA,
  background: "#FFFFFF",
  color: ONBOARDING_TEXT,
  border: ONBOARDING_FIELD_BORDER,
};

export function CoachOnboardingHeader({ screen }: { screen: CoachOnboardingScreen }) {
  return (
    <div
      className="w-full max-w-[720px] flex justify-between items-start onboarding-header"
      style={{ paddingTop: "clamp(24px, 6vw, 40px)", paddingBottom: 0 }}
    >
      <div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 19,
            fontWeight: 500,
            color: "#1A1A1A",
            letterSpacing: "-0.3px",
            lineHeight: 1,
          }}
        >
          Kimchi
        </div>
        <div
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--scout-muted)",
            letterSpacing: "1.1px",
            textTransform: "uppercase",
            marginTop: 4,
          }}
        >
          Coach setup
        </div>
      </div>
      <div className="flex gap-[5px] items-center" style={{ paddingTop: 6 }}>
        {Array.from({ length: COACH_ONBOARDING_STEP_COUNT }, (_, i) => i).map((i) => (
          <div
            key={i}
            style={{
              width: 24,
              height: 2,
              borderRadius: 1,
              background: screen >= i ? FULL : EMPTY,
              transition: "background 0.6s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ScreenIntro({ title, body }: { title: string; body?: string }) {
  return (
    <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.1s" }}>
      <h2 style={{ ...DISPLAY_H2, lineHeight: 1.04, marginBottom: body ? 12 : 0, marginTop: 0 }}>{title}</h2>
      {body && (
        <p style={{ ...ONBOARDING_BODY, margin: 0, fontSize: "clamp(0.9375rem, 2.5vw, 1rem)", lineHeight: 1.65 }}>
          {body}
        </p>
      )}
    </div>
  );
}

function NavRow({
  onBack,
  onNext,
  nextLabel = "Next step",
  nextDisabled,
  showBack = true,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
}) {
  return (
    <div className="anim-fade-up flex justify-between items-center gap-3" style={{ ...ONBOARDING_CARD }}>
      {showBack && onBack ? (
        <button type="button" className="onboarding-cta" onClick={onBack} style={SECONDARY_CTA}>
          Previous step
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        className="onboarding-cta"
        onClick={onNext}
        disabled={nextDisabled}
        style={{
          ...PRIMARY_CTA,
          opacity: nextDisabled ? 0.45 : 1,
          cursor: nextDisabled ? "default" : "pointer",
          marginLeft: "auto",
        }}
      >
        {nextLabel}
      </button>
    </div>
  );
}

function Chip({
  selected,
  onClick,
  label,
  fullWidth,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      className="onboarding-chip"
      onClick={onClick}
      style={{
        padding: fullWidth ? "14px 18px" : "10px 16px",
        background: selected ? "#1A3A2F" : ONBOARDING_FIELD_BG,
        color: selected ? "#E8D5A3" : ONBOARDING_TEXT,
        border: selected ? "1.5px solid #1A3A2F" : ONBOARDING_FIELD_BORDER,
        borderRadius: "var(--scout-radius)",
        fontFamily: "var(--font-ui)",
        fontSize: fullWidth ? 15 : 14,
        fontWeight: selected ? 600 : 500,
        cursor: "pointer",
        transition: "all 0.15s",
        textAlign: fullWidth ? "left" : "center",
        width: fullWidth ? "100%" : undefined,
        whiteSpace: fullWidth ? undefined : "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function MultiChip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="onboarding-chip"
      onClick={onClick}
      style={{
        padding: "10px 16px",
        background: selected ? "rgba(26,58,47,0.12)" : ONBOARDING_FIELD_BG,
        color: selected ? "#1A3A2F" : ONBOARDING_TEXT,
        border: selected ? "1.5px solid #1A3A2F" : ONBOARDING_FIELD_BORDER,
        borderRadius: "var(--scout-radius)",
        fontFamily: "var(--font-ui)",
        fontSize: 14,
        fontWeight: selected ? 600 : 500,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 15,
  background: ONBOARDING_FIELD_BG,
  border: ONBOARDING_FIELD_BORDER,
  borderRadius: "var(--scout-radius)",
  padding: "12px 14px",
  outline: "none",
  fontFamily: "var(--font-ui)",
  boxSizing: "border-box",
  color: ONBOARDING_TEXT,
};

export function CoachScreenCategory({
  draft,
  onChange,
  onNext,
}: {
  draft: CoachOnboardingDraft;
  onChange: (patch: Partial<CoachOnboardingDraft>) => void;
  onNext: () => void;
}) {
  const [search, setSearch] = useState("");
  const groups = categoriesForGoal(draft.goal);
  const q = search.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <ScreenIntro
        title="Set up your first coaching category"
        body="Select a goal and category. You can add more categories later from your provider profile."
      />

      <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.15s" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {COACH_GOALS.map((g) => {
            const selected = draft.goal === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onChange({ goal: g.id as CoachGoalId, category: "" })}
                style={{
                  padding: "16px 14px",
                  textAlign: "left",
                  background: selected ? "rgba(26,58,47,0.06)" : ONBOARDING_FIELD_BG,
                  border: selected ? "1.5px solid #1A3A2F" : ONBOARDING_FIELD_BORDER,
                  borderRadius: "var(--scout-radius)",
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                {selected && (
                  <span style={{ position: "absolute", top: 10, right: 10, fontSize: 12, color: "#1A3A2F" }}>✓</span>
                )}
                <div style={{ fontSize: 22, marginBottom: 8 }}>{g.icon}</div>
                <div style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 14, color: ONBOARDING_TEXT }}>{g.label}</div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: ONBOARDING_TEXT_SECONDARY, marginTop: 4 }}>{g.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.25s" }}>
        <input
          type="text"
          placeholder="Search categories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />
      </div>

      {groups.map((group) => {
        const visible = group.categories.filter((c) => !q || c.toLowerCase().includes(q));
        if (!visible.length) return null;
        return (
          <div key={group.label} className="anim-fade-up" style={{ ...ONBOARDING_CARD }}>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: ONBOARDING_TEXT_SECONDARY, marginTop: 0, marginBottom: 12 }}>
              {group.label}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {visible.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  selected={draft.category === cat}
                  onClick={() => onChange({ category: draft.category === cat ? "" : cat })}
                />
              ))}
            </div>
          </div>
        );
      })}

      <NavRow onNext={onNext} nextDisabled={!draft.category} showBack={false} />
    </div>
  );
}

export function CoachScreenLinkedIn({
  draft,
  onChange,
  onBack,
  onNext,
  onSkip,
}: {
  draft: CoachOnboardingDraft;
  onChange: (patch: Partial<CoachOnboardingDraft>) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const onLIChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.trim();
    if (/linkedin\.com/i.test(value)) value = linkedInHandleFromUrl(value);
    value = value.replace(/^@/, "").replace(/\//g, "");
    onChange({ linkedinUrl: value ? `https://linkedin.com/in/${value}` : "" });
  };

  const display = draft.linkedinUrl ? linkedInHandleFromUrl(draft.linkedinUrl) : "";

  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <ScreenIntro title="Share your LinkedIn profile" body="We'll use this to help fill in parts of your coach profile." />

      <div className="anim-fade-up" style={ONBOARDING_CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, ...inputStyle, padding: "10px 14px" }}>
          <LinkedInIcon width={18} height={18} />
          <input
            type="text"
            placeholder="linkedin.com/in/your-handle"
            value={display}
            onChange={onLIChange}
            style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontFamily: "var(--font-ui)", fontSize: 15 }}
          />
        </div>
        <button type="button" onClick={onSkip} style={{ marginTop: 14, background: "none", border: "none", fontFamily: "var(--font-ui)", fontSize: 13, color: ONBOARDING_TEXT_SECONDARY, cursor: "pointer", textDecoration: "underline" }}>
          I don&apos;t have a LinkedIn
        </button>
      </div>

      <NavRow onBack={onBack} onNext={onNext} nextDisabled={!normalizeLinkedInUrl(display) && !draft.linkedinUrl} />
    </div>
  );
}

export function CoachScreenExperienceLevel({
  draft,
  onChange,
  onBack,
  onNext,
}: {
  draft: CoachOnboardingDraft;
  onChange: (patch: Partial<CoachOnboardingDraft>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <ScreenIntro
        title={`What is your level of experience in ${draft.category || "this area"}?`}
        body="This helps us show your profile to clients who are more likely to book with you."
      />
      <div className="anim-fade-up" style={ONBOARDING_CARD}>
        <select
          value={draft.experienceLevel}
          onChange={(e) => onChange({ experienceLevel: e.target.value as CoachOnboardingDraft["experienceLevel"] })}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="">Select level…</option>
          {COACH_EXPERIENCE_LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={!draft.experienceLevel} />
    </div>
  );
}

export function CoachScreenExpertise({
  draft,
  onChange,
  onBack,
  onNext,
}: {
  draft: CoachOnboardingDraft;
  onChange: (patch: Partial<CoachOnboardingDraft>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const options = useMemo(() => expertiseForCategory(draft.category), [draft.category]);
  const toggle = (item: string) => {
    const next = draft.specialties.includes(item)
      ? draft.specialties.filter((s) => s !== item)
      : [...draft.specialties, item];
    onChange({ specialties: next });
  };

  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <ScreenIntro title="Select your areas of expertise" body="Select all options that apply." />
      <div className="anim-fade-up" style={ONBOARDING_CARD}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {options.map((item) => (
            <MultiChip key={item} label={item} selected={draft.specialties.includes(item)} onClick={() => toggle(item)} />
          ))}
        </div>
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={draft.specialties.length === 0} />
    </div>
  );
}

export function CoachScreenCoachingExperience({
  draft,
  onChange,
  onBack,
  onNext,
}: {
  draft: CoachOnboardingDraft;
  onChange: (patch: Partial<CoachOnboardingDraft>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <ScreenIntro title="Add your experience" body="Tell us how much experience you have in this category." />

      <div className="anim-fade-up" style={ONBOARDING_CARD}>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, marginTop: 0, marginBottom: 8 }}>Industry experience</p>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: ONBOARDING_TEXT_SECONDARY, marginTop: 0, marginBottom: 12 }}>
          How long have you worked in {draft.category}?
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            min={0}
            max={60}
            value={draft.industryYears ?? ""}
            onChange={(e) => onChange({ industryYears: e.target.value === "" ? null : Number(e.target.value) })}
            style={{ ...inputStyle, width: 100 }}
          />
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: ONBOARDING_TEXT_SECONDARY }}>years of experience</span>
        </div>
      </div>

      <div className="anim-fade-up" style={ONBOARDING_CARD}>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, marginTop: 0, marginBottom: 8 }}>Coaching experience</p>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: ONBOARDING_TEXT_SECONDARY, marginTop: 0, marginBottom: 12 }}>
          How many clients have you coached in {draft.category}?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {COACH_CLIENT_TIERS.map((tier) => (
            <Chip
              key={tier.id}
              label={`${tier.label} — ${tier.hint}`}
              selected={draft.clientTier === tier.id}
              onClick={() => onChange({ clientTier: tier.id })}
              fullWidth
            />
          ))}
        </div>
      </div>

      <NavRow onBack={onBack} onNext={onNext} nextDisabled={draft.industryYears == null || !draft.clientTier} />
    </div>
  );
}

export function CoachScreenQualifications({
  draft,
  onChange,
  onBack,
  onNext,
}: {
  draft: CoachOnboardingDraft;
  onChange: (patch: Partial<CoachOnboardingDraft>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <ScreenIntro
        title="Tell clients why you're qualified"
        body="Share why you're a great coach in this category. This appears on your marketplace profile once approved."
      />
      <div className="anim-fade-up" style={ONBOARDING_CARD}>
        <textarea
          value={draft.qualifications}
          onChange={(e) => onChange({ qualifications: e.target.value })}
          rows={8}
          placeholder={`Write about your ${draft.category} qualifications…`}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
        />
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={draft.qualifications.trim().length < 40} />
    </div>
  );
}

export function CoachScreenHeadline({
  draft,
  onChange,
  onBack,
  onNext,
}: {
  draft: CoachOnboardingDraft;
  onChange: (patch: Partial<CoachOnboardingDraft>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <ScreenIntro
        title={`Write your ${draft.category} listing headline`}
        body="Make it specific — go beyond school and company names. This headline is used for this category listing."
      />
      <div className="anim-fade-up" style={ONBOARDING_CARD}>
        <input
          type="text"
          value={draft.headline}
          onChange={(e) => onChange({ headline: e.target.value })}
          placeholder="e.g. PM interview coach for career changers"
          style={inputStyle}
          maxLength={120}
        />
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: ONBOARDING_TEXT_SECONDARY, marginTop: 8, marginBottom: 0 }}>
          {draft.headline.length}/120 characters
        </p>
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={draft.headline.trim().length < 12} />
    </div>
  );
}

export function CoachScreenFinal({
  draft,
  onChange,
  onBack,
  onNext,
}: {
  draft: CoachOnboardingDraft;
  onChange: (patch: Partial<CoachOnboardingDraft>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const toggleSpec = (item: string) => {
    const next = draft.clientSpecializations.includes(item)
      ? draft.clientSpecializations.filter((s) => s !== item)
      : [...draft.clientSpecializations, item];
    onChange({ clientSpecializations: next });
  };

  const onFile = async (file: File | undefined | null) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onChange({ photoUrl: data.url });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <ScreenIntro title="Answer some final questions" body="A few more details before you submit your profile for review." />

      <div className="anim-fade-up" style={ONBOARDING_CARD}>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, marginTop: 0, marginBottom: 8 }}>Why do you coach?</p>
        <textarea
          value={draft.whyCoach}
          onChange={(e) => onChange({ whyCoach: e.target.value })}
          rows={4}
          placeholder="Share your motivation — what drives you to help others?"
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
        />
      </div>

      <div className="anim-fade-up" style={ONBOARDING_CARD}>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, marginTop: 0, marginBottom: 8 }}>Hourly rate (USD)</p>
        <input
          type="number"
          min={0}
          value={draft.hourlyRate ?? ""}
          onChange={(e) => onChange({ hourlyRate: e.target.value ? Number(e.target.value) : null })}
          placeholder="e.g. 150"
          style={inputStyle}
        />
      </div>

      <div className="anim-fade-up" style={ONBOARDING_CARD}>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, marginTop: 0, marginBottom: 8 }}>Booking link</p>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: ONBOARDING_TEXT_SECONDARY, marginTop: 0, marginBottom: 10 }}>
          Paste your Cal.com, Calendly, or other scheduling link. Clients will use this to book intro calls and sessions.
        </p>
        <input
          type="url"
          value={draft.calLink}
          onChange={(e) => onChange({ calLink: e.target.value })}
          placeholder="https://cal.com/your-name"
          style={inputStyle}
        />
      </div>

      <div className="anim-fade-up" style={ONBOARDING_CARD}>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: ONBOARDING_TEXT_SECONDARY, marginTop: 0 }}>Optional</p>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, marginTop: 4, marginBottom: 8 }}>Do you coach professionally?</p>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontFamily: "var(--font-ui)", fontSize: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={draft.isProfessionalCoach}
            onChange={(e) => onChange({ isProfessionalCoach: e.target.checked })}
            style={{ marginTop: 3 }}
          />
          <span>I am a professional coach</span>
        </label>
      </div>

      <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, paddingTop: 20 }}>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: ONBOARDING_TEXT_SECONDARY, marginTop: 0 }}>Optional</p>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, marginTop: 4, marginBottom: 12 }}>I specialize in coaching individuals who are:</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {COACH_CLIENT_SPECIALIZATIONS.map((item) => (
            <MultiChip key={item} label={item} selected={draft.clientSpecializations.includes(item)} onClick={() => toggleSpec(item)} />
          ))}
        </div>
      </div>

      <div className="anim-fade-up" style={ONBOARDING_CARD}>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, marginTop: 0, marginBottom: 8 }}>Add a photo</p>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: ONBOARDING_TEXT_SECONDARY, marginTop: 0, marginBottom: 16 }}>
          Use a photo that shows your face clearly. Under 5MB.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", background: ONBOARDING_FIELD_BG, border: ONBOARDING_FIELD_BORDER, flexShrink: 0 }}>
            {draft.photoUrl ? (
              <img src={draft.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: ONBOARDING_TEXT_SECONDARY }}>?</div>
            )}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onFile(e.target.files?.[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={SECONDARY_CTA}>
              {uploading ? "Uploading…" : draft.photoUrl ? "Upload new photo" : "Upload photo"}
            </button>
            {uploadError && <p style={{ fontSize: 13, color: "#dc2626", marginTop: 8 }}>{uploadError}</p>}
          </div>
        </div>
      </div>

      <NavRow onBack={onBack} onNext={onNext} nextLabel="Review my profile" nextDisabled={!draft.hourlyRate || draft.hourlyRate < 1} />
    </div>
  );
}

export function CoachScreenReview({
  draft,
  onBack,
  onSubmit,
  submitting,
}: {
  draft: CoachOnboardingDraft;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <ScreenIntro
        title="Review your profile"
        body="After you submit, the Kimchi team will review your coach profile before it goes live in the marketplace."
      />

      <div className="anim-fade-up" style={ONBOARDING_CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          {draft.photoUrl ? (
            <img src={draft.photoUrl} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: ONBOARDING_FIELD_BG }} />
          )}
          <div>
            <p style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 16, margin: 0 }}>{draft.displayName || "Your name"}</p>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: ONBOARDING_TEXT_SECONDARY, margin: "4px 0 0" }}>{draft.headline}</p>
          </div>
        </div>

        <ReviewRow label="Category" value={draft.category} />
        <ReviewRow label="Experience" value={draft.experienceLevel} />
        <ReviewRow label="Expertise" value={draft.specialties.join(", ")} />
        <ReviewRow label="Hourly rate" value={draft.hourlyRate ? `$${draft.hourlyRate}/hr` : ""} />
        <ReviewRow label="Booking link" value={draft.calLink} />
        <ReviewRow label="LinkedIn" value={draft.linkedinUrl} />
        {draft.clientSpecializations.length > 0 && (
          <ReviewRow label="Client focus" value={draft.clientSpecializations.join(", ")} />
        )}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(26,58,47,0.08)" }}>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: ONBOARDING_TEXT_SECONDARY, textTransform: "uppercase", letterSpacing: "0.8px", marginTop: 0 }}>Qualifications</p>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, lineHeight: 1.65, color: ONBOARDING_TEXT, marginBottom: 0, whiteSpace: "pre-wrap" }}>
            {draft.qualifications.slice(0, 400)}{draft.qualifications.length > 400 ? "…" : ""}
          </p>
        </div>
      </div>

      <NavRow
        onBack={onBack}
        onNext={onSubmit}
        nextLabel={submitting ? "Submitting…" : "Submit for review"}
        nextDisabled={submitting}
      />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: ONBOARDING_TEXT_SECONDARY, margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: ONBOARDING_TEXT, margin: 0 }}>{value}</p>
    </div>
  );
}
