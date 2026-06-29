"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { InternalCoachBadge } from "@/components/scout/internal-coach-badge";
import { CoachAvatar, CoachStarRating } from "@/components/scout/coach-avatar";
import { CompanyLogo } from "@/components/scout/company-logo";
import { CoachMatchScoreColumn } from "@/components/scout/match-score-ui";
import {
  buildCoachExperienceCompanies,
  type CoachCompanyLookupMeta,
} from "@/lib/coach-experience-companies";
import { ClientCoachSharedDocuments } from "@/components/scout/client-coach-shared-documents";
import { CreditsStatusBar } from "@/components/scout/credits-display";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { formatCoachNextAvailable } from "@/components/scout/coach-booking-modal";
import { bioSnippet } from "@/lib/coach-directory";
import type { CoachProfileDetail, CoachReviewItem } from "@/lib/coach-types";
import type { LiveSessionView } from "@/lib/live-session-types";
import { liveSessionRouteId } from "@/lib/live-sessions";
import { bruddleHeadingStyle, color, fontMono, fontSans, radius, surface, type as T } from "@/lib/typography";

const line = "var(--scout-border)";
const cardBg = surface.card;
const SECTION_GAP = 32;

const PACKAGE_GRADIENTS = [
  "linear-gradient(145deg, rgba(26,58,47,0.95) 0%, rgba(74,139,106,0.82) 100%)",
  "linear-gradient(145deg, #1A3A2F 0%, #2F5A48 100%)",
  "linear-gradient(145deg, rgba(26,58,47,0.88) 0%, rgba(196,168,106,0.55) 100%)",
  "linear-gradient(145deg, #163028 0%, #3A6B52 100%)",
];

function formatCoachedMinutes(minutes: number): string {
  if (minutes >= 60) return `${minutes.toLocaleString()} min coached`;
  if (minutes > 0) return `${minutes} min coached`;
  return "";
}

function packageSaveLabel(
  pkg: { hours: number; displayPriceCents: number | null },
  hourlyRate: number | null,
): string | null {
  if (!hourlyRate || !pkg.displayPriceCents) return null;
  const fullPriceCents = hourlyRate * 100 * pkg.hours;
  const savedCents = fullPriceCents - pkg.displayPriceCents;
  if (savedCents < 100) return null;
  return `Save $${Math.round(savedCents / 100).toLocaleString()}`;
}

function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
      <h2 style={{ ...bruddleHeadingStyle("h4"), margin: 0, color: color.ink }}>{title}</h2>
      {action}
    </div>
  );
}

function ContentSection({ children }: { children: ReactNode }) {
  return <section style={{ marginBottom: SECTION_GAP }}>{children}</section>;
}

function CredentialRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "rgba(26,58,47,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ fontFamily: fontSans, fontSize: 14, color: color.stone, lineHeight: 1.4 }}>{label}</span>
    </div>
  );
}

function CompanyLogoRow({
  companies,
  lookup,
  label,
}: {
  companies: ReturnType<typeof buildCoachExperienceCompanies>;
  lookup: Record<string, CoachCompanyLookupMeta>;
  label: string;
}) {
  if (!companies.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 10px" }}>{label}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {companies.slice(0, 8).map((company) => {
          const meta = lookup[company.key];
          return (
            <CompanyLogo
              key={company.key}
              name={meta?.name ?? company.displayName}
              logoUrl={meta?.logoUrl}
              website={meta?.website}
              size={32}
              borderRadius={8}
            />
          );
        })}
      </div>
    </div>
  );
}

function PackageOfferingCard({
  title,
  priceLabel,
  hoursLabel,
  saveLabel,
  gradient,
  onBuy,
  isMobile,
}: {
  title: string;
  priceLabel: string;
  hoursLabel: string;
  saveLabel?: string | null;
  gradient: string;
  onBuy?: () => void;
  isMobile: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={!onBuy}
      style={{
        display: "flex",
        flexDirection: "column",
        textAlign: "left",
        border: line,
        borderRadius: radius.px,
        overflow: "hidden",
        background: cardBg,
        cursor: onBuy ? "pointer" : "default",
        padding: 0,
        minWidth: isMobile ? 260 : 0,
        flex: isMobile ? "0 0 auto" : "1 1 0",
      }}
    >
      <div
        style={{
          background: gradient,
          padding: "20px 16px 18px",
          minHeight: 120,
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        <p style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.35 }}>
          {title}
        </p>
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <p style={{ fontFamily: fontSans, fontSize: 18, fontWeight: 700, color: color.ink, margin: "0 0 2px" }}>{priceLabel}</p>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>{hoursLabel} of coaching</p>
        {saveLabel && (
          <span
            style={{
              display: "inline-block",
              marginTop: 10,
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(74,139,106,0.14)",
              border: "1px solid rgba(74,139,106,0.28)",
              fontFamily: fontSans,
              fontSize: 12,
              fontWeight: 700,
              color: "#2A5A45",
            }}
          >
            {saveLabel}
          </span>
        )}
      </div>
    </button>
  );
}

function DimensionBar({ label, value }: { label: string; value: number }) {
  const pct = (value / 5) * 100;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: fontSans, fontSize: 13, color: color.stone }}>{label}</span>
        <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 6, background: "rgba(26,58,47,0.08)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color.forest }} />
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: CoachReviewItem }) {
  return (
    <div style={{ padding: "14px 0", borderBottom: line }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: 0 }}>{review.authorName}</p>
          {review.coachedFor && (
            <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "2px 0 0" }}>
              Coached for: {review.coachedFor}
            </p>
          )}
        </div>
        <CoachStarRating rating={review.rating} />
      </div>
      <p style={{ fontFamily: fontSans, fontSize: 14, lineHeight: 1.65, color: color.stone, margin: 0, whiteSpace: "pre-wrap" }}>
        {review.message}
      </p>
    </div>
  );
}

function EventCard({ session, variant }: { session: LiveSessionView; variant: "upcoming" | "recording" }) {
  const routeId = liveSessionRouteId(session);
  const href =
    variant === "recording"
      ? session.recordingUrl ?? `/live/${routeId}/replay`
      : `/live/${routeId}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "flex",
        gap: 14,
        padding: 14,
        border: line,
        borderRadius: radius.px,
        background: surface.inset,
        textDecoration: "none",
        color: color.ink,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          background: session.bgColor || "rgba(26,58,47,0.12)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fontMono,
          fontSize: 11,
          fontWeight: 700,
          color: color.forest,
        }}
      >
        {variant === "recording" ? "▶" : "📅"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>{session.title}</p>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>
          {variant === "recording" ? "Free recording" : `${session.date} · ${session.time}`}
          {variant === "upcoming" && session.registered > 0 ? ` · ${session.registered} registered` : ""}
        </p>
      </div>
      <span style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.forest, flexShrink: 0 }}>
        {variant === "recording" ? "Watch" : "View →"}
      </span>
    </a>
  );
}

function GoldBookBtn({ children, onClick, style }: { children: ReactNode; onClick?: () => void; style?: CSSProperties }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 44,
        padding: "12px 16px",
        background: color.gold,
        color: color.ink,
        border: line,
        borderRadius: radius.px,
        fontFamily: fontSans,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        boxSizing: "border-box",
        textAlign: "center",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function AiToolCard({
  title,
  subtitle,
  buttonLabel,
  creditCost,
  onClick,
}: {
  title: string;
  subtitle: string;
  buttonLabel: string;
  creditCost?: number;
  onClick: () => void;
}) {
  return (
    <div style={{ background: cardBg, border: line, borderRadius: radius.px, padding: "18px 20px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <p style={bruddleHeadingStyle("h6")}>{title}</p>
        {creditCost ? (
          <span style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600, color: color.muted }}>
            {creditCost} credit{creditCost !== 1 ? "s" : ""}
          </span>
        ) : null}
      </div>
      <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, lineHeight: 1.5, margin: "0 0 14px" }}>{subtitle}</p>
      <ScoutPrimaryBtn onClick={onClick} style={{ width: "100%", minHeight: 40 }}>{buttonLabel}</ScoutPrimaryBtn>
    </div>
  );
}

export type CoachProfileViewProps = {
  coach: CoachProfileDetail;
  isMobile: boolean;
  matchScore?: number;
  matchLabel?: string;
  matchReasons?: string[];
  matchedSkills?: string[];
  sessionDurationMinutes: number;
  canBookInApp: boolean;
  bookUrl?: string | null;
  nextSlotStart: number | null;
  nextSlotLoading: boolean;
  canSelfAssignCoach: boolean;
  isAdmin?: boolean;
  onBookIntro: () => void;
  onBookSession: () => void;
  onBuyPackage: (packageId: string) => void;
  onToggleFollow: () => void;
  onToggleMyCoach: () => void;
  onWriteReview: () => void;
  onPrepChat: () => void;
};

export function CoachProfileView({
  coach,
  isMobile,
  matchScore = 0,
  matchLabel = "",
  matchReasons = [],
  matchedSkills = [],
  sessionDurationMinutes,
  canBookInApp,
  bookUrl,
  nextSlotStart,
  nextSlotLoading,
  canSelfAssignCoach,
  isAdmin,
  onBookIntro,
  onBookSession,
  onBuyPackage,
  onToggleFollow,
  onToggleMyCoach,
  onWriteReview,
  onPrepChat,
}: CoachProfileViewProps) {
  const bookingAllowed = canBookInApp && (!coach.requiresAssignment || coach.isMyCoach);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [showAllPackages, setShowAllPackages] = useState(false);
  const [companyLookup, setCompanyLookup] = useState<Record<string, CoachCompanyLookupMeta>>({});

  const firstName = coach.displayName.split(" ")[0];
  const aboutText = coach.aboutMe || coach.bio || "";
  const heroHeadline = coach.headline?.trim() || coach.category || "Expert coach";
  const upcoming = coach.upcomingLiveSessions ?? [];
  const recordings = coach.pastRecordings ?? [];
  const packages = coach.purchasablePackages ?? [];
  const visiblePackages = showAllPackages ? packages : packages.slice(0, 3);
  const hiddenPackageCount = Math.max(0, packages.length - 3);
  const experienceCompanies = useMemo(
    () => buildCoachExperienceCompanies(coach),
    [coach.currentCompany, coach.firms],
  );
  const coachedMinutesLabel = formatCoachedMinutes(coach.totalCoachedMinutes ?? 0);
  const statsParts = [
    coachedMinutesLabel,
    `${coach.followerCount.toLocaleString()} follower${coach.followerCount !== 1 ? "s" : ""}`,
  ].filter(Boolean);

  useEffect(() => {
    if (!experienceCompanies.length) return;
    let cancelled = false;
    fetch("/api/coaches/companies/suggest?limit=80")
      .then((r) => (r.ok ? r.json() : []))
      .then((items: Array<{ catalogSlug: string; name: string; logoUrl?: string | null; website?: string | null }>) => {
        if (cancelled || !Array.isArray(items)) return;
        const map: Record<string, CoachCompanyLookupMeta> = {};
        for (const item of items) {
          const slug = item.catalogSlug?.toLowerCase();
          if (!slug) continue;
          map[slug] = { name: item.name, logoUrl: item.logoUrl ?? null, website: item.website ?? null, careersUrl: null };
        }
        setCompanyLookup(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [experienceCompanies.length]);

  const bookingSidebar = (
    <div>
      <div style={{ border: line, borderRadius: radius.px, overflow: "hidden", marginBottom: 16, background: surface.inset }}>
        <div style={{ position: "relative", minHeight: 160, background: "linear-gradient(145deg, rgba(26,58,47,0.12) 0%, rgba(74,139,106,0.18) 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={88} rounded />
          <span aria-hidden style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.92)", border: line, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: color.forest }}>▶</span>
        </div>
        <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.ink, textAlign: "center", margin: "12px 16px 0" }}>Get to know {firstName}</p>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, textAlign: "center", margin: "6px 16px 16px", lineHeight: 1.45 }}>
          {bioSnippet(coach.bio ?? coach.aboutMe ?? "", 120) || "Book a free intro to learn how they can help."}
        </p>
      </div>
      <ScoutBox padding={20}>
        {bookingAllowed ? (
          <>
            <GoldBookBtn onClick={onBookIntro} style={{ marginBottom: 10, borderRadius: 999, minHeight: 48 }}>Schedule a free intro call</GoldBookBtn>
            <ScoutSecondaryBtn onClick={onBookSession} style={{ width: "100%", minHeight: 48, borderRadius: 999 }}>Book a session</ScoutSecondaryBtn>
          </>
        ) : bookUrl ? (
          <a href={bookUrl} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none" }}>
            <GoldBookBtn style={{ borderRadius: 999 }}>Schedule via calendar</GoldBookBtn>
          </a>
        ) : (
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, textAlign: "center", margin: 0, lineHeight: 1.45 }}>
            {coach.requiresAssignment && !coach.isMyCoach ? "Contact your Second Ladder team to get assigned to this coach." : "Booking is not available for this coach yet."}
          </p>
        )}
        {bookingAllowed && (
          <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, textAlign: "center", margin: "14px 0 0", lineHeight: 1.45 }}>
            {nextSlotLoading ? "Checking availability…" : nextSlotStart ? formatCoachNextAvailable(nextSlotStart) : "No upcoming slots in the next two weeks"}
          </p>
        )}
        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, textAlign: "center", margin: "14px 0 0", lineHeight: 1.45 }}>Protected by the Kimchi coaching guarantee</p>
      </ScoutBox>
      <ScoutBox padding={18} style={{ marginTop: 12 }}>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.stone, margin: "0 0 10px", lineHeight: 1.45 }}>Questions? Reach out before you get started.</p>
        <button type="button" onClick={onBookIntro} style={{ background: "none", border: "none", padding: 0, fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.forest, cursor: "pointer", textDecoration: "underline" }}>Send {firstName} a message</button>
      </ScoutBox>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        <ScoutSecondaryBtn onClick={onToggleFollow} style={{ width: "100%", minHeight: 40 }}>{coach.isFollowing ? "Following ✓" : "+ Follow"}</ScoutSecondaryBtn>
        {canSelfAssignCoach && (coach.isMyCoach || (!coach.isInternal && !coach.requiresAssignment) || isAdmin) && (
          <ScoutSecondaryBtn onClick={onToggleMyCoach} style={{ width: "100%", minHeight: 40, ...(coach.isMyCoach ? { borderColor: color.forest, color: color.forest, fontWeight: 600 } : {}) }}>
            {coach.isMyCoach ? "Remove from my coaches" : isAdmin && (coach.isInternal || coach.requiresAssignment) ? "Assign coach" : "Add as my coach"}
          </ScoutSecondaryBtn>
        )}
        <button type="button" onClick={onWriteReview} style={{ width: "100%", background: "none", border: "none", fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, cursor: "pointer", textDecoration: "underline", padding: 8 }}>Write a review</button>
      </div>
      {!isMobile && (
        <div style={{ marginTop: 20 }}>
          <p style={{ ...bruddleHeadingStyle("h6"), margin: "0 0 14px" }}>Before your session</p>
          <CreditsStatusBar />
          <AiToolCard creditCost={1} title="Prepare for your session" subtitle="Questions to ask, what to share about your goals, and how this coach's background fits you." buttonLabel="Prep with Scout" onClick={onPrepChat} />
        </div>
      )}
    </div>
  );

  const mainColumn = (
    <>
      {packages.length > 0 && (
        <ContentSection>
          <SectionHeading title={`${firstName}'s offerings`} />
          <div style={{ display: "flex", gap: 12, overflowX: isMobile ? "auto" : undefined, flexWrap: isMobile ? "nowrap" : "wrap", paddingBottom: isMobile ? 4 : 0 }}>
            {visiblePackages.map((pkg, index) => (
              <PackageOfferingCard key={pkg.id} title={pkg.displayTitle} priceLabel={pkg.displayPriceLabel ?? "—"} hoursLabel={pkg.displayHoursLabel} saveLabel={packageSaveLabel(pkg, coach.hourlyRate)} gradient={PACKAGE_GRADIENTS[index % PACKAGE_GRADIENTS.length]} onBuy={bookingAllowed ? () => onBuyPackage(pkg.id) : undefined} isMobile={isMobile} />
            ))}
          </div>
          {(coach.hourlyRate || hiddenPackageCount > 0) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
              {coach.hourlyRate ? <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, color: color.ink, margin: 0 }}>Custom hourly · ${coach.hourlyRate}/hr</p> : <span />}
              {hiddenPackageCount > 0 && (
                <button type="button" onClick={() => setShowAllPackages((v) => !v)} style={{ background: "none", border: "none", fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.forest, cursor: "pointer", textDecoration: "underline" }}>
                  {showAllPackages ? "Show fewer packages" : `View ${hiddenPackageCount} more package${hiddenPackageCount === 1 ? "" : "s"}`}
                </button>
              )}
              {coach.hourlyRate && bookingAllowed && <ScoutSecondaryBtn onClick={onBookSession} style={{ minHeight: 40 }}>Buy coaching</ScoutSecondaryBtn>}
            </div>
          )}
        </ContentSection>
      )}
      {(recordings.length > 0 || (coach.publicResources?.length ?? 0) > 0 || upcoming.length > 0) && (
        <ContentSection>
          <SectionHeading title={`${firstName}'s resources`} />
          {upcoming.map((s) => <EventCard key={s.id} session={s} variant="upcoming" />)}
          {recordings.map((s) => <EventCard key={s.id} session={s} variant="recording" />)}
          {(coach.publicResources?.length ?? 0) > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: recordings.length ? 12 : 0 }}>
              {coach.publicResources!.map((doc) => (
                <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", border: line, borderRadius: radius.px, background: surface.inset, textDecoration: "none", color: "inherit" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: color.ink }}>{doc.name}</p>
                    <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: 0 }}>{doc.typeLabel}</p>
                  </div>
                  <span style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.forest, flexShrink: 0 }}>Download →</span>
                </a>
              ))}
            </div>
          )}
        </ContentSection>
      )}
      <ContentSection>
        <SectionHeading title={`${firstName}'s ${coach.category ?? "coaching"} qualifications`} />
        <ScoutBox padding={20}>
          {coach.isProfessionalCoach && <CredentialRow icon="🏆" label="Coaches professionally" />}
          {coach.experienceLevel && <CredentialRow icon="📊" label={`Experience level: ${coach.experienceLevel}`} />}
          {(coach.clientsCoachedCount ?? 0) > 0 && coach.category && <CredentialRow icon="👥" label={`${coach.clientsCoachedCount}+ people coached for ${coach.category}`} />}
          {coach.industryYears != null && coach.industryYears > 0 && <CredentialRow icon="⏱" label={`${coach.industryYears}+ years in industry`} />}
          <CompanyLogoRow companies={experienceCompanies} lookup={companyLookup} label={`${firstName} has helped clients at`} />
          {aboutText && <p style={{ fontFamily: fontSans, fontSize: T.bodySm, lineHeight: 1.75, color: color.stone, margin: "16px 0 0", whiteSpace: "pre-wrap" }}>{bioSnippet(aboutText, 480) || aboutText.slice(0, 480)}{aboutText.length > 480 ? "…" : ""}</p>}
          {coach.specialties.length > 0 && (
            <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "14px 0 0", lineHeight: 1.55 }}>
              {firstName} also coaches for {coach.specialties.slice(0, 6).map((s, i) => (<span key={s}>{i > 0 ? ", " : ""}<span style={{ color: color.forest, fontWeight: 600 }}>{s}</span></span>))}{coach.specialties.length > 6 ? " and more." : "."}
            </p>
          )}
        </ScoutBox>
      </ContentSection>
      {aboutText && (
        <ContentSection>
          <SectionHeading title={`About ${firstName}`} />
          <ScoutBox padding={20}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, lineHeight: 1.75, color: color.stone, margin: 0, whiteSpace: "pre-wrap" }}>{aboutExpanded ? aboutText : `${aboutText.slice(0, 800)}${aboutText.length > 800 ? "…" : ""}`}</p>
            {aboutText.length > 800 && <button type="button" onClick={() => setAboutExpanded((v) => !v)} style={{ marginTop: 10, background: "none", border: "none", color: color.forest, fontFamily: fontSans, fontSize: T.bodySm, cursor: "pointer", fontWeight: 600 }}>{aboutExpanded ? "Show less" : "View more"}</button>}
          </ScoutBox>
        </ContentSection>
      )}
      {coach.whyCoach && (
        <ContentSection>
          <SectionHeading title="Why do I coach?" />
          <ScoutBox padding={20}><p style={{ fontFamily: fontSans, fontSize: T.bodySm, lineHeight: 1.75, color: color.stone, margin: 0, whiteSpace: "pre-wrap" }}>{coach.whyCoach}</p></ScoutBox>
        </ContentSection>
      )}
      {(coach.currentRole || coach.currentCompany || experienceCompanies.length > 0) && (
        <ContentSection>
          <SectionHeading title="Work experience" />
          <ScoutBox padding={20}>
            {(coach.currentRole || coach.currentCompany) && (
              <div style={{ marginBottom: experienceCompanies.length ? 16 : 0, paddingBottom: experienceCompanies.length ? 16 : 0, borderBottom: experienceCompanies.length ? line : undefined }}>
                <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 700, margin: "0 0 4px", color: color.ink }}>{coach.currentRole ?? "Coach"}</p>
                {coach.currentCompany && <p style={{ fontFamily: fontSans, fontSize: 14, color: color.stone, margin: "0 0 4px" }}>{coach.currentCompany}</p>}
                <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>Current role</p>
              </div>
            )}
            {experienceCompanies.map((company) => {
              const meta = companyLookup[company.key];
              return (
                <div key={company.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: line }}>
                  <CompanyLogo name={meta?.name ?? company.displayName} logoUrl={meta?.logoUrl} website={meta?.website} size={36} borderRadius={8} />
                  <div>
                    <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: 0, color: color.ink }}>{company.label}</p>
                    <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "2px 0 0" }}>Previous experience</p>
                  </div>
                </div>
              );
            })}
          </ScoutBox>
        </ContentSection>
      )}
      {coach.schools.length > 0 && (
        <ContentSection>
          <SectionHeading title="Education" />
          <ScoutBox padding={20}>
            {coach.schools.map((school) => (
              <div key={school} style={{ padding: "12px 0", borderBottom: line }}>
                <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 700, margin: 0, color: color.ink }}>{school}</p>
              </div>
            ))}
          </ScoutBox>
        </ContentSection>
      )}
      {(coach.clientWins?.length ?? 0) > 0 && (
        <ContentSection>
          <SectionHeading title="Client results" />
          <ScoutBox padding={20}>
            <ul style={{ margin: 0, paddingLeft: 18, fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.65 }}>
              {coach.clientWins!.map((win) => <li key={win} style={{ marginBottom: 8 }}>{win}</li>)}
            </ul>
          </ScoutBox>
        </ContentSection>
      )}
      <ContentSection>
        <SectionHeading title={`${coach.reviewCount} review${coach.reviewCount === 1 ? "" : "s"}`} action={<CoachStarRating rating={coach.avgRating} count={coach.reviewCount} />} />
        <ScoutBox padding={20}>
          {coach.aggregates && (
            <div style={{ marginBottom: 20, maxWidth: 420 }}>
              <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 12px" }}>Overall rating</p>
              <p style={{ ...bruddleHeadingStyle("h3"), margin: "0 0 16px", color: color.ink }}>{coach.aggregates.avgRating.toFixed(1)}</p>
              <DimensionBar label="Knowledge" value={coach.aggregates.knowledge} />
              <DimensionBar label="Value" value={coach.aggregates.value} />
              <DimensionBar label="Responsiveness" value={coach.aggregates.responsiveness} />
              <DimensionBar label="Supportiveness" value={coach.aggregates.supportiveness} />
            </div>
          )}
          <CompanyLogoRow companies={experienceCompanies} lookup={companyLookup} label={`${firstName} has helped clients at`} />
          {coach.reviews.length === 0 ? <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, marginTop: 16 }}>No reviews yet.</p> : coach.reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
        </ScoutBox>
      </ContentSection>
      {coach.isMyCoach && (
        <ContentSection>
          <SectionHeading title="Shared with you" />
          <ScoutBox padding={20}><ClientCoachSharedDocuments coachProfileId={coach.id} coachName={coach.displayName} compact /></ScoutBox>
        </ContentSection>
      )}
      {matchReasons.length > 0 && (
        <ContentSection>
          <SectionHeading title="Why clients work with them" />
          <ScoutBox padding={20}>
            <ul style={{ margin: 0, paddingLeft: 18, fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.65 }}>
              {matchReasons.slice(0, 5).map((r) => <li key={r} style={{ marginBottom: 6 }}>{r}</li>)}
            </ul>
          </ScoutBox>
        </ContentSection>
      )}
    </>
  );

  return (
    <div>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "stretch", borderBottom: line, background: cardBg }}>
        <div style={{ flex: 1, minWidth: 0, padding: isMobile ? "20px 16px" : "28px 32px 24px" }}>
          <div style={{ display: "flex", gap: isMobile ? 16 : 24, alignItems: "flex-start" }}>
            <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={isMobile ? 96 : 120} rounded />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                <h1 style={bruddleHeadingStyle(isMobile ? "h4" : "h3", { lineHeight: 1.15 })}>{coach.displayName}</h1>
                {coach.isInternal && <InternalCoachBadge />}
              </div>
              <CoachStarRating rating={coach.avgRating} count={coach.reviewCount} />
              <h2 style={{ ...bruddleHeadingStyle(isMobile ? "h5" : "h4"), margin: "12px 0 0", lineHeight: 1.25, color: color.ink }}>{heroHeadline}</h2>
              {statsParts.length > 0 && <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: "10px 0 0" }}>{statsParts.join(" · ")}</p>}
              <div style={{ marginTop: 14 }}>
                {(coach.isProfessionalCoach || coach.featured || coach.spotlightBadge === "top-rated") && <CredentialRow icon="🏆" label="Top expert" />}
                {coach.schools[0] && <CredentialRow icon="🎓" label={`Studied at ${coach.schools[0]}`} />}
                {(coach.currentCompany || coach.firms[0]) && <CredentialRow icon="💼" label={`Worked at ${coach.currentCompany ?? coach.firms[0]}`} />}
              </div>
              <CompanyLogoRow companies={experienceCompanies} lookup={companyLookup} label="Successful clients at" />
              {coach.location && <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "12px 0 0" }}>{coach.location}</p>}
            </div>
          </div>
        </div>
        {matchScore > 0 && <CoachMatchScoreColumn score={matchScore} label={matchLabel} reasons={matchReasons} matchedSkills={matchedSkills} width={isMobile ? 96 : 120} />}
      </div>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0, padding: isMobile ? "24px 16px 88px" : "28px 32px 40px" }}>
          {isMobile && <div style={{ marginBottom: 28 }}>{bookingSidebar}</div>}
          {mainColumn}
        </div>
        {!isMobile && (
          <aside style={{ width: 340, flexShrink: 0, borderLeft: line, background: surface.inset, padding: "24px 20px 32px", position: "sticky", top: 0, alignSelf: "flex-start", maxHeight: "100vh", overflowY: "auto" }}>
            {bookingSidebar}
          </aside>
        )}
      </div>
      {isMobile && bookingAllowed && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: cardBg, borderTop: line, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 700, margin: 0, color: color.ink }}>{coach.displayName}</p>
            <CoachStarRating rating={coach.avgRating} count={coach.reviewCount} />
          </div>
          <GoldBookBtn onClick={onBookIntro} style={{ width: "auto", minWidth: 140, padding: "12px 20px", borderRadius: 999 }}>Schedule</GoldBookBtn>
        </div>
      )}
    </div>
  );
}
