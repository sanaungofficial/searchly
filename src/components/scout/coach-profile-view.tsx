"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { InternalCoachBadge } from "@/components/scout/internal-coach-badge";
import { CoachAvatar, CoachStarRating } from "@/components/scout/coach-avatar";
import { CoachExperienceCompanies } from "@/components/scout/coach-experience-companies";
import { CoachMatchSection, CoachMatchScoreCluster } from "@/components/scout/match-score-ui";
import { ClientCoachSharedDocuments } from "@/components/scout/client-coach-shared-documents";
import { CreditsStatusBar } from "@/components/scout/credits-display";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn, scoutInsetChipStyle } from "@/components/scout/scout-box";
import { formatCoachNextAvailable } from "@/components/scout/coach-booking-modal";
import { bioSnippet } from "@/lib/coach-directory";
import type { CoachProfileDetail, CoachReviewItem } from "@/lib/coach-types";
import type { LiveSessionView } from "@/lib/live-session-types";
import { liveSessionRouteId } from "@/lib/live-sessions";
import { bruddleHeadingStyle, color, fontMono, fontSans, radius, surface, type as T } from "@/lib/typography";

const line = "var(--scout-border)";
const cardBg = surface.card;

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <ScoutBox padding={20} style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <h3 style={{ ...bruddleHeadingStyle("h5"), margin: 0, color: color.ink }}>{title}</h3>
        {action}
      </div>
      {children}
    </ScoutBox>
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

function OfferingRow({
  title,
  subtitle,
  priceLabel,
  secondaryPrice,
  onBook,
  bookLabel,
  style,
}: {
  title: string;
  subtitle: string;
  priceLabel: string;
  secondaryPrice?: string;
  onBook?: () => void;
  bookLabel?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: 14,
        border: line,
        borderRadius: radius.px,
        background: surface.inset,
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>{title}</p>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>{subtitle}</p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 700, color: color.forest, margin: 0 }}>{priceLabel}</p>
        {secondaryPrice && (
          <p style={{ fontFamily: fontSans, fontSize: 11, color: color.muted, margin: "4px 0 0" }}>{secondaryPrice}</p>
        )}
        {onBook && bookLabel && (
          <button
            type="button"
            onClick={onBook}
            style={{
              marginTop: 8,
              background: "none",
              border: "none",
              fontFamily: fontSans,
              fontSize: 12,
              fontWeight: 600,
              color: color.forest,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {bookLabel}
          </button>
        )}
      </div>
    </div>
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
  const aboutText = coach.aboutMe || coach.bio || "";
  const introText = bioSnippet(coach.bio ?? coach.aboutMe ?? "", 280) || aboutText.slice(0, 280);
  const upcoming = coach.upcomingLiveSessions ?? [];
  const recordings = coach.pastRecordings ?? [];
  const categoryPills = [
    coach.category,
    ...coach.specialties.slice(0, 4),
    ...coach.clientSpecializations.slice(0, 2),
  ].filter(Boolean);

  const bookingSidebar = (
    <ScoutBox padding={20}>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, margin: "0 0 14px", textAlign: "center" }}>
        Book a session
      </p>
      <OfferingRow
        title="Free intro call"
        subtitle="30 minutes · Get to know your coach"
        priceLabel="Free"
        onBook={bookingAllowed ? onBookIntro : undefined}
        bookLabel="Book intro"
      />
      <OfferingRow
        title="1:1 coaching session"
        subtitle={`${sessionDurationMinutes} minutes · Tailored to your goals`}
        priceLabel={coach.isInternal || coach.requiresAssignment ? "Included" : coach.hourlyRate ? `$${coach.hourlyRate}/hr` : "See rate"}
        secondaryPrice={!coach.isInternal && !coach.requiresAssignment && coach.hourlyRate ? "after intro" : undefined}
        onBook={bookingAllowed ? onBookSession : undefined}
        bookLabel="Book session"
        style={{ marginTop: 10 }}
      />
      {coach.purchasablePackages?.map((pkg) => (
        <OfferingRow
          key={pkg.id}
          title={pkg.displayTitle}
          subtitle={`${pkg.displayHoursLabel} · Coaching package`}
          priceLabel={pkg.displayPriceLabel ?? "—"}
          onBook={() => onBuyPackage(pkg.id)}
          bookLabel="Buy package"
          style={{ marginTop: 10 }}
        />
      ))}
      {bookingAllowed && (
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            border: line,
            background: "rgba(26,58,47,0.04)",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "2px solid #1A3A2F",
              flexShrink: 0,
              marginTop: 2,
              background: "#1A3A2F",
              boxShadow: "inset 0 0 0 3px #fff",
            }}
          />
          <p style={{ fontFamily: fontSans, fontSize: 13, margin: 0, lineHeight: 1.45, color: color.stone }}>
            {nextSlotLoading
              ? "Checking availability…"
              : nextSlotStart
                ? formatCoachNextAvailable(nextSlotStart)
                : "No upcoming slots in the next two weeks"}
          </p>
        </div>
      )}
      {bookingAllowed ? (
        <div style={{ marginTop: 14 }}>
          <GoldBookBtn onClick={onBookIntro} style={{ marginBottom: 8 }}>Schedule a free intro call</GoldBookBtn>
          <ScoutSecondaryBtn onClick={onBookSession} style={{ width: "100%", minHeight: 44, marginBottom: 8 }}>
            Book a session
          </ScoutSecondaryBtn>
        </div>
      ) : bookUrl ? (
        <a href={bookUrl} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 14, textDecoration: "none" }}>
          <GoldBookBtn>Schedule via calendar</GoldBookBtn>
        </a>
      ) : null}
      <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, textAlign: "center", margin: "12px 0 8px" }}>
        {coach.followerCount} follower{coach.followerCount !== 1 ? "s" : ""}
      </p>
      <ScoutSecondaryBtn onClick={onToggleFollow} style={{ width: "100%", minHeight: 40, marginBottom: 8 }}>
        {coach.isFollowing ? "Following ✓" : "+ Follow"}
      </ScoutSecondaryBtn>
      {coach.requiresAssignment && !coach.isMyCoach && !isAdmin && (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, textAlign: "center", margin: "8px 0", lineHeight: 1.45 }}>
          This coach is available through Second Ladder. Contact your team to get assigned.
        </p>
      )}
      {canSelfAssignCoach && (coach.isMyCoach || (!coach.isInternal && !coach.requiresAssignment) || isAdmin) && (
        <ScoutSecondaryBtn
          onClick={onToggleMyCoach}
          style={{
            width: "100%",
            minHeight: 40,
            marginBottom: 8,
            ...(coach.isMyCoach ? { borderColor: color.forest, color: color.forest, fontWeight: 600 } : {}),
          }}
        >
          {coach.isMyCoach
            ? "Remove from my coaches"
            : isAdmin && (coach.isInternal || coach.requiresAssignment)
              ? "Assign coach"
              : "Add as my coach"}
        </ScoutSecondaryBtn>
      )}
      <button
        type="button"
        onClick={onWriteReview}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          fontFamily: fontSans,
          fontSize: T.bodySm,
          color: color.forest,
          cursor: "pointer",
          textDecoration: "underline",
          padding: 8,
        }}
      >
        Write a review
      </button>
    </ScoutBox>
  );

  return (
    <div>
      {/* Hero */}
      <div
        style={{
          padding: isMobile ? "20px 16px" : "28px 32px",
          background: cardBg,
          borderBottom: line,
        }}
      >
        <div style={{ display: "flex", gap: isMobile ? 16 : 24, alignItems: "flex-start" }}>
          <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={isMobile ? 88 : 120} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
              <h1 style={bruddleHeadingStyle(isMobile ? "h4" : "h3", { lineHeight: 1.15 })}>{coach.displayName}</h1>
              {coach.isProfessionalCoach && (
                <span style={{ fontFamily: fontSans, fontSize: 12, color: color.forest, fontWeight: 600 }}>✓ Verified</span>
              )}
              {coach.isInternal && <InternalCoachBadge />}
            </div>
            <CoachStarRating rating={coach.avgRating} count={coach.reviewCount} />
            {coach.headline && (
              <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.stone, lineHeight: 1.5, margin: "10px 0 0" }}>
                {coach.headline}
              </p>
            )}
            {categoryPills.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {categoryPills.map((pill) => (
                  <span
                    key={pill}
                    style={{
                      ...scoutInsetChipStyle,
                      color: color.forest,
                      fontWeight: 600,
                    }}
                  >
                    {pill}
                  </span>
                ))}
              </div>
            )}
            {coach.location && (
              <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "10px 0 0" }}>{coach.location}</p>
            )}
          </div>
          {!isMobile && matchScore > 0 && (
            <CoachMatchScoreCluster
              score={matchScore}
              label={matchLabel}
              align="right"
              job={{ matchScore, matchLabel, matchReasons, matchedSkills }}
            />
          )}
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: "flex-start",
          gap: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, padding: isMobile ? "20px 16px 28px" : "28px 32px 36px" }}>
          {matchScore > 0 && (
            <CoachMatchSection job={{ matchScore, matchLabel, matchReasons, matchedSkills }} />
          )}

          {introText && (
            <Section title={`Message from ${coach.displayName.split(" ")[0]}`}>
              <p style={{ fontFamily: fontSans, fontSize: T.body, lineHeight: 1.7, color: color.stone, margin: 0 }}>
                {introText}{introText.length < (coach.bio?.length ?? 0) ? "…" : ""}
              </p>
            </Section>
          )}

          {isMobile && bookingSidebar}

          {aboutText && (
            <Section title="About">
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, lineHeight: 1.75, color: color.stone, margin: 0, whiteSpace: "pre-wrap" }}>
                {aboutExpanded ? aboutText : `${aboutText.slice(0, 600)}${aboutText.length > 600 ? "…" : ""}`}
              </p>
              {aboutText.length > 600 && (
                <button
                  type="button"
                  onClick={() => setAboutExpanded((v) => !v)}
                  style={{
                    marginTop: 10,
                    background: "none",
                    border: "none",
                    color: color.forest,
                    fontFamily: fontSans,
                    fontSize: T.bodySm,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {aboutExpanded ? "Show less" : "View more"}
                </button>
              )}
            </Section>
          )}

          {matchReasons.length > 0 && (
            <Section title="Why clients work with them">
              <ul style={{ margin: 0, paddingLeft: 18, fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.65 }}>
                {matchReasons.slice(0, 5).map((r) => (
                  <li key={r} style={{ marginBottom: 6 }}>{r}</li>
                ))}
              </ul>
            </Section>
          )}

          {(coach.clientWins?.length ?? 0) > 0 && (
            <Section title="Client results">
              <ul style={{ margin: 0, paddingLeft: 18, fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.65 }}>
                {coach.clientWins!.map((win) => (
                  <li key={win} style={{ marginBottom: 8 }}>{win}</li>
                ))}
              </ul>
            </Section>
          )}

          <Section
            title="Reviews"
            action={<CoachStarRating rating={coach.avgRating} count={coach.reviewCount} />}
          >
            {coach.aggregates && (
              <div style={{ marginBottom: 16, maxWidth: 360 }}>
                <DimensionBar label="Knowledge" value={coach.aggregates.knowledge} />
                <DimensionBar label="Value" value={coach.aggregates.value} />
                <DimensionBar label="Responsiveness" value={coach.aggregates.responsiveness} />
                <DimensionBar label="Supportiveness" value={coach.aggregates.supportiveness} />
              </div>
            )}
            {coach.reviews.length === 0 ? (
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>No reviews yet.</p>
            ) : (
              coach.reviews.map((r) => <ReviewCard key={r.id} review={r} />)
            )}
          </Section>

          {coach.whyCoach && (
            <Section title="Coaching philosophy">
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, lineHeight: 1.75, color: color.stone, margin: 0, whiteSpace: "pre-wrap" }}>
                {coach.whyCoach}
              </p>
            </Section>
          )}

          <CoachExperienceCompanies coach={coach} isMobile={isMobile} embedded />

          {coach.schools.length > 0 && (
            <Section title="Education">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {coach.schools.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: "8px 14px",
                      border: line,
                      borderRadius: radius.px,
                      fontFamily: fontSans,
                      fontSize: T.bodySm,
                      color: color.stone,
                      background: surface.inset,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {upcoming.length > 0 && (
            <Section title="Upcoming events">
              {upcoming.map((s) => <EventCard key={s.id} session={s} variant="upcoming" />)}
            </Section>
          )}

          {(recordings.length > 0 || (coach.publicResources?.length ?? 0) > 0 || coach.isMyCoach) && (
            <Section title="Resources & recordings">
              {recordings.map((s) => <EventCard key={s.id} session={s} variant="recording" />)}
              {(coach.publicResources?.length ?? 0) > 0 && (
                <div style={{ marginTop: recordings.length ? 16 : 0 }}>
                  {recordings.length === 0 && (
                    <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.ink, margin: "0 0 10px" }}>
                      Resources
                    </p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {coach.publicResources!.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "12px 14px",
                          border: line,
                          borderRadius: radius.px,
                          background: surface.inset,
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: color.ink }}>
                            {doc.name}
                          </p>
                          <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: 0 }}>
                            {doc.typeLabel}
                          </p>
                        </div>
                        <span style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.forest, flexShrink: 0 }}>
                          Download →
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {coach.isMyCoach && (
                <div style={{ marginTop: recordings.length ? 16 : 0 }}>
                  <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.ink, margin: "0 0 10px" }}>
                    Shared with you
                  </p>
                  <ClientCoachSharedDocuments
                    coachProfileId={coach.id}
                    coachName={coach.displayName}
                    compact
                  />
                </div>
              )}
              {recordings.length === 0 && !coach.isMyCoach && (
                <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: 0, lineHeight: 1.55 }}>
                  No public recordings yet. When this coach hosts Live sessions, replays will appear here.
                </p>
              )}
            </Section>
          )}

          {coach.specialties.length > 0 && (
            <Section title="Can help with">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {coach.specialties.map((s) => (
                  <span
                    key={s}
                    style={{ ...scoutInsetChipStyle, color: color.forest, fontSize: T.bodySm }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>

        {!isMobile && (
          <aside
            style={{
              width: 340,
              flexShrink: 0,
              borderLeft: line,
              background: surface.inset,
              padding: "24px 20px 32px",
              position: "sticky",
              top: 0,
              alignSelf: "flex-start",
              maxHeight: "100%",
              overflowY: "auto",
            }}
          >
            {bookingSidebar}
            <div style={{ marginTop: 20 }}>
              <p style={{ ...bruddleHeadingStyle("h6"), margin: "0 0 14px" }}>Before your session</p>
              <CreditsStatusBar />
              <AiToolCard
                creditCost={1}
                title="Prepare for your session"
                subtitle="Questions to ask, what to share about your goals, and how this coach's background fits you."
                buttonLabel="Prep with Scout"
                onClick={onPrepChat}
              />
              <AiToolCard
                creditCost={1}
                title="Interview prep"
                subtitle="Practice questions and talking points tailored to your target roles."
                buttonLabel="Start interview prep"
                onClick={onPrepChat}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
