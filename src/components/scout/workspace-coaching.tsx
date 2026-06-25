"use client";

import { useEffect, useState } from "react";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { WorkspacePageShell } from "@/components/scout/workspace-page-shell";
import { WorkspaceSegmentTabs } from "@/components/scout/workspace-segment-tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type CoachingTab = "mycoach" | "coaches";

type Coach = {
  id: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  location: string | null;
  linkedinUrl: string | null;
  lelandUrl: string | null;
  photoUrl: string | null;
  firms: string[];
  schools: string[];
  specialties: string[];
  industries: string[];
  hourlyRate: number | null;
  category: string | null;
  featured: boolean;
};

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
  const [tab, setTab] = useState<CoachingTab>("mycoach");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { openPricing } = useWorkspace();

  useEffect(() => {
    setLoadingCoaches(true);
    fetch("/api/coaches")
      .then((r) => r.json())
      .then((data) => { setCoaches(data); setLoadingCoaches(false); })
      .catch(() => setLoadingCoaches(false));

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
        <MyCoachTab featured={coaches.find((c) => c.featured) ?? null} loading={loadingCoaches} isPro={isPro} isMobile={isMobile} onSubscribe={openPricing} />
      ) : (
        <CoachSearchTab coaches={coaches} loading={loadingCoaches} isPro={isPro} isMobile={isMobile} onSubscribe={openPricing} />
      )}

      {showUpgrade && (
        <GrowthUpgradeModal trigger="coaching" onClose={() => setShowUpgrade(false)} onOpenPricing={openPricing} />
      )}
    </WorkspacePageShell>
  );
}

function CoachAvatar({ coach, size }: { coach: Coach; size: number }) {
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

function MyCoachTab({ featured, loading, isPro, isMobile, onSubscribe }: { featured: Coach | null; loading: boolean; isPro: boolean; isMobile: boolean; onSubscribe: () => void }) {
  if (loading) {
    return <p style={{ color: color.muted, fontSize: T.bodySm, fontFamily: fontSans }}>Loading…</p>;
  }
  if (!featured) {
    return (
      <ScoutBox padding={isMobile ? 20 : 24}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
          You haven&apos;t been matched with a coach yet. Browse the directory to find one.
        </p>
      </ScoutBox>
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <ScoutBox padding={isMobile ? 20 : 24} style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
          <CoachAvatar coach={featured} size={60} />
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, color: "#1A1A1A" }}>
              {featured.displayName}
            </p>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", marginTop: 2, marginBottom: 6 }}>
              {featured.currentRole}{featured.currentCompany ? ` · ${featured.currentCompany}` : ""}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {featured.firms.slice(0, 2).map((f) => (
                <span key={f} style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F", fontWeight: 500 }}>{f}</span>
              ))}
              {featured.hourlyRate && (
                isPro
                  ? <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F", fontWeight: 500 }}>${featured.hourlyRate}/hr</span>
                  : <span onClick={onSubscribe} title="Subscribe to see rate" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, userSelect: "none" }}>
                      <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: "#1A3A2F", filter: "blur(4px)", pointerEvents: "none" }}>${featured.hourlyRate}/hr</span>
                    </span>
              )}
              {featured.location && (
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>{featured.location}</span>
              )}
            </div>
          </div>
        </div>

        {featured.bio && (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 400, color: "#52493F", lineHeight: 1.65, marginBottom: 16, textWrap: "pretty" } as React.CSSProperties}>
            {featured.bio.slice(0, 400)}{featured.bio.length > 400 ? "…" : ""}
          </p>
        )}

        {featured.specialties.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {featured.specialties.map((s) => (
              <span key={s} style={{ padding: "5px 12px", background: "rgba(26,58,47,0.06)", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F" }}>
                {s}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isPro ? (
            <ScoutPrimaryBtn style={{ minHeight: isMobile ? 44 : undefined }}>Book a session →</ScoutPrimaryBtn>
          ) : (
            <ScoutSecondaryBtn onClick={onSubscribe} style={{ minHeight: isMobile ? 44 : undefined }}>
              Subscribe to book
            </ScoutSecondaryBtn>
          )}
          {featured.linkedinUrl && (
            <a
              href={featured.linkedinUrl}
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

function CoachSearchTab({ coaches, loading, isPro, isMobile, onSubscribe }: { coaches: Coach[]; loading: boolean; isPro: boolean; isMobile: boolean; onSubscribe: () => void }) {
  const [filter, setFilter] = useState("");
  const [selectedFirm, setSelectedFirm] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");

  const allFirms = Array.from(new Set(coaches.flatMap((c) => c.firms))).sort();
  const allSpecialties = Array.from(new Set(coaches.flatMap((c) => c.specialties))).sort();

  const filtered = coaches.filter((c) => {
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
        {filtered.length} coach{filtered.length !== 1 ? "es" : ""}
        {!isPro && <span style={{ marginLeft: 10, color: "#b45309", fontSize: 14 }}>🔒 Subscribe to see rates and book sessions</span>}
      </p>

      {loading ? (
        <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Loading coaches…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((c) => (
            <ScoutBox
              key={c.id}
              padding={isMobile ? "16px 18px" : "18px 22px"}
              style={{
                border: c.featured ? border.lineStrong : border.line,
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <CoachAvatar coach={c} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div>
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
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
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

                {c.headline && (
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 400, color: "#52493F", lineHeight: 1.55, marginBottom: 10, textWrap: "pretty" } as React.CSSProperties}>
                    {c.headline}
                  </p>
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
