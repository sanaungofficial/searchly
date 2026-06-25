"use client";

import { useEffect, useMemo, useState } from "react";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import {
  CoachAvatar,
  CoachRate,
  ProfileHintBanner,
} from "@/components/scout/coach-ui";
import { MatchFitCallout, MatchScoreBadge } from "@/components/scout/match-score-ui";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { WorkspacePageShell } from "@/components/scout/workspace-page-shell";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCoachMatches } from "@/hooks/use-coach-matches";
import { useWorkspace } from "@/contexts/workspace-context";
import type { MatchedCoach } from "@/lib/coach-match";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

export function WorkspaceCoaching() {
  const isMobile = useIsMobile();
  const { openPricing } = useWorkspace();
  const { coaches, loading, needsProfile, profileHint, refresh } = useCoachMatches();
  const [isPro, setIsPro] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => { if (d.isPro) setIsPro(true); })
      .catch(() => {});
  }, []);

  return (
    <WorkspacePageShell
      isMobile={isMobile}
      label="1:1 coaching"
      mobileBarTitle="Coaching"
      title="Talk to someone who's done it."
      subtitle="Browse coaches ranked by how well they match your profile."
    >
      <CoachDirectory
        coaches={coaches}
        loading={loading}
        needsProfile={needsProfile}
        profileHint={profileHint}
        isPro={isPro}
        isMobile={isMobile}
        onSubscribe={openPricing}
        onRefresh={refresh}
      />

      {showUpgrade && (
        <GrowthUpgradeModal trigger="coaching" onClose={() => setShowUpgrade(false)} onOpenPricing={openPricing} />
      )}
    </WorkspacePageShell>
  );
}

function CoachDirectory({
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
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <ScoutSecondaryBtn onClick={onRefresh} disabled={loading} style={{ minHeight: isMobile ? 44 : undefined }}>
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
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <CoachAvatar coach={c} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
                        {c.displayName}{" "}
                        {c.featured && (
                          <span style={{ marginLeft: 6, padding: "1px 7px", background: "rgba(196,168,106,0.15)", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, color: "#7A6020", fontWeight: 600 }}>
                            Featured
                          </span>
                        )}
                      </p>
                      <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", margin: "4px 0 0" }}>
                        {c.currentRole}{c.currentCompany ? ` · ${c.currentCompany}` : ""}
                      </p>
                    </div>
                    {c.matchScore > 0 && (
                      <MatchScoreBadge score={c.matchScore} label={c.matchLabel} />
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: c.headline ? 10 : 0, alignItems: "center" }}>
                    {c.firms.slice(0, 2).map((f) => (
                      <span key={f} style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F", fontWeight: 500 }}>{f}</span>
                    ))}
                    <CoachRate hourlyRate={c.hourlyRate} isPro={isPro} onSubscribe={onSubscribe} />
                    {c.location && (
                      <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>{c.location}</span>
                    )}
                  </div>

                  {c.headline && (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 400, color: "#52493F", lineHeight: 1.55, margin: "0 0 10px", textWrap: "pretty" } as React.CSSProperties}>
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
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, marginBottom: 10 }}>
                      {c.specialties.map((s) => (
                        <span key={s} style={{ padding: "4px 10px", background: "rgba(26,58,47,0.06)", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F" }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                    {c.schools.slice(0, 2).map((s) => (
                      <span key={s} style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>{s}</span>
                    ))}
                    {(c.linkedinUrl || c.lelandUrl) && c.schools.length > 0 && <span style={{ color: "#d4cfc9", fontSize: 14 }}>·</span>}
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
