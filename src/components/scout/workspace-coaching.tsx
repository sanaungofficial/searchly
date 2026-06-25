"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { MatchFitCallout, MatchScoreBadge } from "@/components/scout/match-score-ui";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { WorkspacePageShell } from "@/components/scout/workspace-page-shell";
import { WorkspaceSegmentTabs } from "@/components/scout/workspace-segment-tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  readCoachMatchCache,
  writeCoachMatchCache,
} from "@/lib/coach-match-cache";
import type { MatchedCoach } from "@/lib/coach-match";
import { topMatchedCoach } from "@/lib/coach-match";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type CoachingTab = "mycoach" | "coaches";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function WorkspaceCoaching() {
  const isMobile = useIsMobile();
  const { actingUserId } = useWorkspace();
  const [tab, setTab] = useState<CoachingTab>("mycoach");
  const [coaches, setCoaches] = useState<MatchedCoach[]>(() => readCoachMatchCache()?.coaches ?? []);
  const [loadingCoaches, setLoadingCoaches] = useState(() => !readCoachMatchCache());
  const [needsProfile, setNeedsProfile] = useState(() => readCoachMatchCache()?.needsProfile ?? false);
  const [profileHint, setProfileHint] = useState<string | null>(() => readCoachMatchCache()?.hint ?? null);
  const [isPro, setIsPro] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { openPricing } = useWorkspace();

  const loadCoaches = useCallback(async (options?: { force?: boolean }) => {
    if (!options?.force) {
      const cached = readCoachMatchCache();
      if (cached) {
        setCoaches(cached.coaches);
        setNeedsProfile(Boolean(cached.needsProfile));
        setProfileHint(cached.hint ?? null);
        setLoadingCoaches(false);
        return;
      }
    }

    setLoadingCoaches(true);
    try {
      const res = await fetch("/api/coaches/match");
      const data = (await res.json()) as {
        coaches?: MatchedCoach[];
        needsProfile?: boolean;
        hint?: string;
        scored?: boolean;
      };
      if (res.ok && Array.isArray(data.coaches)) {
        setCoaches(data.coaches);
        setNeedsProfile(Boolean(data.needsProfile));
        setProfileHint(data.hint ?? null);
        writeCoachMatchCache({
          coaches: data.coaches,
          fetchedAt: Date.now(),
          scored: Boolean(data.scored),
          needsProfile: data.needsProfile,
          hint: data.hint ?? null,
        });
      }
    } catch {
      /* keep existing list */
    } finally {
      setLoadingCoaches(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => { if (d.isPro) setIsPro(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const cached = readCoachMatchCache();
    if (cached) {
      setCoaches(cached.coaches);
      setNeedsProfile(Boolean(cached.needsProfile));
      setProfileHint(cached.hint ?? null);
      setLoadingCoaches(false);
    } else {
      void loadCoaches();
    }
  }, [actingUserId, loadCoaches]);

  const myCoach = useMemo(() => topMatchedCoach(coaches), [coaches]);

  return (
    <WorkspacePageShell
      isMobile={isMobile}
      label="1:1 coaching"
      mobileBarTitle="Coaching"
      title="Talk to someone who's done it."
    >
      <WorkspaceSegmentTabs
        isMobile={isMobile}
        tabs={[
          { id: "mycoach", label: "My Coach" },
          { id: "coaches", label: "Find a Coach" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "mycoach" ? (
        <MyCoachTab
          coach={myCoach}
          loading={loadingCoaches}
          needsProfile={needsProfile}
          profileHint={profileHint}
          isPro={isPro}
          isMobile={isMobile}
          onSubscribe={openPricing}
        />
      ) : (
        <CoachSearchTab
          coaches={coaches}
          loading={loadingCoaches}
          needsProfile={needsProfile}
          profileHint={profileHint}
          isPro={isPro}
          isMobile={isMobile}
          onSubscribe={openPricing}
          onRefresh={() => void loadCoaches({ force: true })}
        />
      )}

      {showUpgrade && (
        <GrowthUpgradeModal trigger="coaching" onClose={() => setShowUpgrade(false)} onOpenPricing={openPricing} />
      )}
    </WorkspacePageShell>
  );
}

function CoachAvatar({ coach, size }: { coach: MatchedCoach; size: number }) {
  const [imgError, setImgError] = useState(false);
  if (coach.photoUrl && !imgError) {
    return (
      <img
        src={coach.photoUrl}
        alt={coach.displayName}
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#1A3A2F",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span style={{ fontFamily: "var(--font-ui)", fontSize: size * 0.33, fontWeight: 600, color: "#E8D5A3" }}>
        {initials(coach.displayName)}
      </span>
    </div>
  );
}

function ProfileHintBanner({
  needsProfile,
  profileHint,
  isMobile,
}: {
  needsProfile: boolean;
  profileHint: string | null;
  isMobile: boolean;
}) {
  if (!needsProfile) return null;
  return (
    <ScoutBox padding={isMobile ? "14px 16px" : "16px 20px"} style={{ marginBottom: 14, background: "rgba(196,168,106,0.08)", border: border.lineStrong }}>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, margin: "0 0 8px", lineHeight: 1.55 }}>
        {profileHint ?? "Add target roles or upload a resume in Profile to unlock coach match scores."}
      </p>
      <Link
        href="/profile"
        style={{
          fontFamily: fontSans,
          fontSize: T.bodySm,
          fontWeight: 600,
          color: color.forest,
          textDecoration: "none",
        }}
      >
        Complete your profile →
      </Link>
    </ScoutBox>
  );
}

function MyCoachTab({
  coach,
  loading,
  needsProfile,
  profileHint,
  isPro,
  isMobile,
  onSubscribe,
}: {
  coach: MatchedCoach | null;
  loading: boolean;
  needsProfile: boolean;
  profileHint: string | null;
  isPro: boolean;
  isMobile: boolean;
  onSubscribe: () => void;
}) {
  if (loading) {
    return <p style={{ color: color.muted, fontSize: T.bodySm, fontFamily: fontSans }}>Loading…</p>;
  }
  if (!coach) {
    return (
      <>
        <ProfileHintBanner needsProfile={needsProfile} profileHint={profileHint} isMobile={isMobile} />
        <ScoutBox padding={isMobile ? 20 : 24}>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
            {needsProfile
              ? "Complete your profile with target roles or a resume to get matched with a coach."
              : "No coaches available yet. Browse the directory to find one."}
          </p>
        </ScoutBox>
      </>
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <ProfileHintBanner needsProfile={needsProfile} profileHint={profileHint} isMobile={isMobile} />
      <ScoutBox padding={isMobile ? 20 : 24} style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
          <CoachAvatar coach={coach} size={60} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, color: "#1A1A1A" }}>
                  {coach.displayName}
                </p>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", marginTop: 2, marginBottom: 6 }}>
                  {coach.currentRole}{coach.currentCompany ? ` · ${coach.currentCompany}` : ""}
                </p>
              </div>
              {coach.matchScore > 0 && (
                <MatchScoreBadge score={coach.matchScore} label={coach.matchLabel} />
              )}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {coach.firms.slice(0, 2).map((f) => (
                <span key={f} style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F", fontWeight: 500 }}>{f}</span>
              ))}
              {coach.hourlyRate && (
                isPro
                  ? <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F", fontWeight: 500 }}>${coach.hourlyRate}/hr</span>
                  : <span onClick={onSubscribe} title="Subscribe to see rate" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, userSelect: "none" }}>
                      <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: "#1A3A2F", filter: "blur(4px)", pointerEvents: "none" }}>${coach.hourlyRate}/hr</span>
                    </span>
              )}
              {coach.location && (
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>{coach.location}</span>
              )}
            </div>
          </div>
        </div>

        {coach.bio && (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 400, color: "#52493F", lineHeight: 1.65, marginBottom: 16, textWrap: "pretty" } as React.CSSProperties}>
            {coach.bio.slice(0, 400)}{coach.bio.length > 400 ? "…" : ""}
          </p>
        )}

        {coach.specialties.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {coach.specialties.map((s) => (
              <span key={s} style={{ padding: "5px 12px", background: "rgba(26,58,47,0.06)", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F" }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {coach.matchScore > 0 && (
          <MatchFitCallout
            job={{
              matchScore: coach.matchScore,
              matchLabel: coach.matchLabel,
              matchReasons: coach.matchReasons,
              matchedSkills: coach.matchedTags,
            }}
          />
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          {isPro ? (
            <ScoutPrimaryBtn style={{ minHeight: isMobile ? 44 : undefined }}>Book a session →</ScoutPrimaryBtn>
          ) : (
            <ScoutSecondaryBtn onClick={onSubscribe} style={{ minHeight: isMobile ? 44 : undefined }}>
              Subscribe to book
            </ScoutSecondaryBtn>
          )}
          {coach.linkedinUrl && (
            <a
              href={coach.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "8px 16px",
                background: surface.card,
                color: color.forest,
                border: border.lineStrong,
                fontFamily: fontSans,
                fontSize: T.bodySm,
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                minHeight: isMobile ? 44 : undefined,
              }}
            >
              LinkedIn ↗
            </a>
          )}
        </div>
      </ScoutBox>

      <ScoutBox padding={isMobile ? "16px 20px" : "18px 24px"}>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
          Upcoming sessions
        </p>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
          No upcoming sessions scheduled. Book one to start your prep.
        </p>
      </ScoutBox>
    </div>
  );
}

function CoachSearchTab({
  coaches,
  loading,
  needsProfile,
  profileHint,
  isPro,
  isMobile,
  onSubscribe,
  onRefresh,
}: {
  coaches: MatchedCoach[];
  loading: boolean;
  needsProfile: boolean;
  profileHint: string | null;
  isPro: boolean;
  isMobile: boolean;
  onSubscribe: () => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [selectedFirm, setSelectedFirm] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");

  const allFirms = Array.from(new Set(coaches.flatMap((c) => c.firms))).sort();
  const allSpecialties = Array.from(new Set(coaches.flatMap((c) => c.specialties))).sort();

  const filtered = useMemo(() => {
    const rows = coaches.filter((c) => {
      const q = filter.toLowerCase();
      const matchText =
        !q ||
        c.displayName.toLowerCase().includes(q) ||
        c.firms.some((f) => f.toLowerCase().includes(q)) ||
        c.specialties.some((s) => s.toLowerCase().includes(q)) ||
        c.industries.some((i) => i.toLowerCase().includes(q)) ||
        (c.location ?? "").toLowerCase().includes(q);
      const matchFirm = !selectedFirm || c.firms.includes(selectedFirm);
      const matchSpecialty = !selectedSpecialty || c.specialties.includes(selectedSpecialty);
      return matchText && matchFirm && matchSpecialty;
    });
    return [...rows].sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [coaches, filter, selectedFirm, selectedSpecialty]);

  const fieldStyle: React.CSSProperties = {
    flex: 1,
    minWidth: isMobile ? "100%" : 220,
    padding: isMobile ? "12px 14px" : "10px 14px",
    minHeight: isMobile ? 44 : undefined,
    border: border.line,
    borderRadius: 0,
    background: surface.inset,
    fontFamily: fontSans,
    fontSize: isMobile ? 16 : T.bodySm,
    color: color.ink,
    boxSizing: "border-box",
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: 12, marginBottom: 14 }}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.55, maxWidth: 560 }}>
          Coaches ranked by how well they match your profile. Use filters to narrow the list.
        </p>
        <ScoutSecondaryBtn onClick={onRefresh} disabled={loading} style={{ flexShrink: 0, minHeight: isMobile ? 44 : undefined }}>
          {loading ? "Loading…" : "↻ Refresh matches"}
        </ScoutSecondaryBtn>
      </div>

      <ProfileHintBanner needsProfile={needsProfile} profileHint={profileHint} isMobile={isMobile} />

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by name, firm, specialty, or location…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={fieldStyle}
        />
        <select
          value={selectedFirm}
          onChange={(e) => setSelectedFirm(e.target.value)}
          style={{ ...fieldStyle, flex: isMobile ? "1 1 100%" : "0 1 auto", minWidth: isMobile ? "100%" : 140, cursor: "pointer" }}
        >
          <option value="">All firms</option>
          {allFirms.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={selectedSpecialty}
          onChange={(e) => setSelectedSpecialty(e.target.value)}
          style={{ ...fieldStyle, flex: isMobile ? "1 1 100%" : "0 1 auto", minWidth: isMobile ? "100%" : 160, cursor: "pointer" }}
        >
          <option value="">All specialties</option>
          {allSpecialties.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", marginBottom: 14 }}>
        {filtered.length} coach{filtered.length !== 1 ? "es" : ""} · sorted by best match
        {!isPro && <span style={{ marginLeft: 10, color: "#b45309", fontSize: 14 }}>🔒 Subscribe to see rates and book sessions</span>}
      </p>

      {loading && !coaches.length ? (
        <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Loading coaches…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((c) => (
            <ScoutBox
              key={c.id}
              padding={isMobile ? "16px 18px" : "18px 22px"}
              style={{
                border: c.matchRank === 1 ? border.lineStrong : border.line,
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <CoachAvatar coach={c} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
                      {c.displayName}{" "}
                      {c.featured && (
                        <span style={{ marginLeft: 6, padding: "1px 7px", background: "rgba(196,168,106,0.15)", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, color: "#7A6020", fontWeight: 600 }}>
                          Featured
                        </span>
                      )}
                    </p>
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>
                      {c.currentRole}{c.currentCompany ? ` · ${c.currentCompany}` : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
                    {c.matchScore > 0 && (
                      <MatchScoreBadge score={c.matchScore} label={c.matchLabel} />
                    )}
                    <div style={{ textAlign: "right" }}>
                      {c.hourlyRate ? (
                        isPro
                          ? <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "#1A3A2F" }}>${c.hourlyRate}<span style={{ fontSize: 14, color: "var(--scout-muted)", fontWeight: 400 }}>/hr</span></p>
                          : <p onClick={onSubscribe} title="Subscribe to see rate" style={{ cursor: "pointer", userSelect: "none" }}>
                              <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "#1A3A2F", filter: "blur(5px)", pointerEvents: "none" }}>${c.hourlyRate}</span>
                              <span style={{ fontSize: 14, color: "var(--scout-muted)", filter: "blur(5px)", pointerEvents: "none" }}>/hr</span>
                            </p>
                      ) : null}
                      {c.location && (
                        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>{c.location}</p>
                      )}
                    </div>
                  </div>
                </div>

                {c.headline && (
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 400, color: "#52493F", lineHeight: 1.55, marginBottom: 10, textWrap: "pretty" } as React.CSSProperties}>
                    {c.headline}
                  </p>
                )}

                {c.matchScore > 0 && (
                  <MatchFitCallout
                    job={{
                      matchScore: c.matchScore,
                      matchLabel: c.matchLabel,
                      matchReasons: c.matchReasons,
                      matchedSkills: c.matchedTags,
                    }}
                  />
                )}

                {c.specialties.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {c.specialties.map((s) => (
                      <span key={s} style={{ padding: "4px 10px", background: "rgba(26,58,47,0.06)", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F" }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {c.firms.map((f) => (
                    <span key={f} style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F", fontWeight: 500 }}>{f}</span>
                  ))}
                  {c.firms.length > 0 && c.schools.length > 0 && <span style={{ color: "#d4cfc9", fontSize: 14 }}>·</span>}
                  {c.schools.slice(0, 2).map((s) => (
                    <span key={s} style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>{s}</span>
                  ))}
                  {(c.linkedinUrl || c.lelandUrl) && <span style={{ color: "#d4cfc9", fontSize: 14 }}>·</span>}
                  {c.lelandUrl && (
                    <a href={c.lelandUrl} target="_blank" rel="noreferrer" style={{ fontSize: T.bodySm, color: color.forest, textDecoration: "none", fontFamily: fontSans, fontWeight: 600 }}>
                      Leland ↗
                    </a>
                  )}
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noreferrer" style={{ fontSize: T.bodySm, color: color.forest, textDecoration: "none", fontFamily: fontSans, fontWeight: 600 }}>
                      LinkedIn ↗
                    </a>
                  )}
                  <span style={{ flex: 1 }} />
                  {isPro ? (
                    <ScoutPrimaryBtn style={{ minHeight: isMobile ? 44 : undefined }}>Book →</ScoutPrimaryBtn>
                  ) : (
                    <ScoutSecondaryBtn onClick={onSubscribe} style={{ minHeight: isMobile ? 44 : undefined }}>Subscribe to book</ScoutSecondaryBtn>
                  )}
                </div>
              </div>
            </ScoutBox>
          ))}

          {filtered.length === 0 && (
            <p style={{ color: "var(--scout-muted)", fontSize: 14, textAlign: "center", padding: "40px 0" }}>No coaches match your search.</p>
          )}
        </div>
      )}
    </div>
  );
}
