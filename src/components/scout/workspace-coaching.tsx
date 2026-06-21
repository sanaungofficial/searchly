"use client";

import { useEffect, useState } from "react";

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
  const [tab, setTab] = useState<CoachingTab>("mycoach");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

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
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#F2EDE3",
        animation: "fadeIn 0.3s ease both",
      }}
    >
      <div style={{ padding: "20px 32px 0", overflowY: "auto", flex: 1 }}>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 10,
            fontWeight: 500,
            color: "#A09890",
            letterSpacing: "1.1px",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          1:1 coaching
        </p>
        <h1
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontSize: 32,
            fontWeight: 500,
            fontStyle: "italic",
            color: "#1A1A1A",
            letterSpacing: "-0.3px",
            marginBottom: 24,
          }}
        >
          Talk to someone who&apos;s done it.
        </h1>

        {/* Tab bar */}
        <div
          style={{
            display: "inline-flex",
            gap: 3,
            background: "rgba(0,0,0,0.05)",
            padding: 3,
            borderRadius: 7,
            marginBottom: 24,
          }}
        >
          {([
            ["mycoach", "My Coach"],
            ["coaches", "Find a Coach"],
          ] as [CoachingTab, string][]).map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  padding: "7px 18px",
                  border: "none",
                  borderRadius: 5,
                  background: active ? "#FFFFFF" : "transparent",
                  color: active ? "#1A1A1A" : "#7A7268",
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {tab === "mycoach" ? (
          <MyCoachTab featured={coaches.find((c) => c.featured) ?? null} loading={loadingCoaches} isPro={isPro} onSubscribe={() => setShowUpgrade(true)} />
        ) : (
          <CoachSearchTab coaches={coaches} loading={loadingCoaches} isPro={isPro} onSubscribe={() => setShowUpgrade(true)} />
        )}
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}

function UpgradeModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
      <div style={{ position: "relative", background: "#fff", borderRadius: 14, padding: "36px 32px", maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#F2EDE3", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", fontSize: 22 }}>🔒</div>
        <p style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 22, fontWeight: 600, fontStyle: "italic", color: "#1a1a1a", marginBottom: 10 }}>Coaching is a paid feature</p>
        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#7a7268", lineHeight: 1.65, marginBottom: 28 }}>
          Subscribe to Searchly to book 1:1 sessions with coaches, see their rates, and get personalized guidance on your job search.
        </p>
        <a href="/pricing" style={{ display: "block", padding: "12px 0", background: "#1A3A2F", color: "#E8D5A3", borderRadius: 8, fontFamily: "var(--font-dm-sans)", fontSize: 13, fontWeight: 600, textDecoration: "none", marginBottom: 10 }}>View plans →</a>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "#a09890" }}>Maybe later</button>
      </div>
    </div>
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
      <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: size * 0.33, fontWeight: 600, color: "#E8D5A3" }}>
        {initials(coach.displayName)}
      </span>
    </div>
  );
}

function MyCoachTab({ featured, loading, isPro, onSubscribe }: { featured: Coach | null; loading: boolean; isPro: boolean; onSubscribe: () => void }) {
  if (loading) {
    return <p style={{ color: "#a09890", fontSize: 13 }}>Loading…</p>;
  }
  if (!featured) {
    return (
      <div style={{ background: "#fff", borderRadius: 10, padding: 24, border: "1px solid rgba(0,0,0,0.06)" }}>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 13, color: "#7A7268" }}>
          You haven&apos;t been matched with a coach yet. Browse the directory to find one.
        </p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: 24,
          border: "1px solid rgba(0,0,0,0.06)",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
          <CoachAvatar coach={featured} size={60} />
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 16, fontWeight: 600, color: "#1A1A1A" }}>
              {featured.displayName}
            </p>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#7A7268", marginTop: 2, marginBottom: 6 }}>
              {featured.currentRole}{featured.currentCompany ? ` · ${featured.currentCompany}` : ""}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {featured.firms.slice(0, 2).map((f) => (
                <span key={f} style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "#1A3A2F", fontWeight: 500 }}>{f}</span>
              ))}
              {featured.hourlyRate && (
                isPro
                  ? <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "#1A3A2F", fontWeight: 500 }}>${featured.hourlyRate}/hr</span>
                  : <span onClick={onSubscribe} title="Subscribe to see rate" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, userSelect: "none" }}>
                      <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 500, color: "#1A3A2F", filter: "blur(4px)", pointerEvents: "none" }}>${featured.hourlyRate}/hr</span>
                    </span>
              )}
              {featured.location && (
                <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "#7A7268" }}>{featured.location}</span>
              )}
            </div>
          </div>
        </div>

        {featured.bio && (
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, fontWeight: 300, color: "#52493F", lineHeight: 1.65, marginBottom: 16, textWrap: "pretty" } as React.CSSProperties}>
            {featured.bio.slice(0, 400)}{featured.bio.length > 400 ? "…" : ""}
          </p>
        )}

        {featured.specialties.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {featured.specialties.map((s) => (
              <span key={s} style={{ padding: "5px 12px", background: "rgba(26,58,47,0.06)", borderRadius: 100, fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "#1A3A2F" }}>
                {s}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          {isPro
            ? <button style={{ padding: "11px 22px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: 6, fontFamily: "var(--font-dm-sans)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Book a session →</button>
            : <button onClick={onSubscribe} style={{ padding: "11px 22px", background: "#F2EDE3", color: "#7a7268", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6, fontFamily: "var(--font-dm-sans)", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>🔒 Subscribe to book</button>
          }
          {featured.linkedinUrl && (
            <a
              href={featured.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              style={{ padding: "11px 18px", background: "transparent", color: "#1A3A2F", border: "1px solid rgba(26,58,47,0.2)", borderRadius: 6, fontFamily: "var(--font-dm-sans)", fontSize: 12, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center" }}
            >
              LinkedIn ↗
            </a>
          )}
        </div>
      </div>

      <div style={{ background: "#FFFFFF", borderRadius: 10, padding: "18px 24px", border: "1px solid rgba(0,0,0,0.06)" }}>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 9, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
          Upcoming sessions
        </p>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 12, color: "#7A7268" }}>
          No upcoming sessions scheduled. Book one to start your prep.
        </p>
      </div>
    </div>
  );
}

function CoachSearchTab({ coaches, loading, isPro, onSubscribe }: { coaches: Coach[]; loading: boolean; isPro: boolean; onSubscribe: () => void }) {
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

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Search + filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by name, firm, specialty, or location…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            flex: 1,
            minWidth: 220,
            padding: "10px 14px",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 6,
            background: "#FFFFFF",
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 12,
            color: "#1A1A1A",
          }}
        />
        <select
          value={selectedFirm}
          onChange={(e) => setSelectedFirm(e.target.value)}
          style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, background: "#FFFFFF", fontFamily: "var(--font-dm-sans)", fontSize: 12, color: selectedFirm ? "#1A1A1A" : "#7A7268", cursor: "pointer" }}
        >
          <option value="">All firms</option>
          {allFirms.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={selectedSpecialty}
          onChange={(e) => setSelectedSpecialty(e.target.value)}
          style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, background: "#FFFFFF", fontFamily: "var(--font-dm-sans)", fontSize: 12, color: selectedSpecialty ? "#1A1A1A" : "#7A7268", cursor: "pointer" }}
        >
          <option value="">All specialties</option>
          {allSpecialties.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "#A09890", marginBottom: 14 }}>
        {filtered.length} coach{filtered.length !== 1 ? "es" : ""}
        {!isPro && <span style={{ marginLeft: 10, color: "#b45309", fontSize: 10 }}>🔒 Subscribe to see rates and book sessions</span>}
      </p>

      {loading ? (
        <p style={{ color: "#a09890", fontSize: 13 }}>Loading coaches…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((c) => (
            <div
              key={c.id}
              style={{
                background: "#FFFFFF",
                borderRadius: 10,
                padding: "18px 22px",
                border: `1px solid ${c.featured ? "rgba(26,58,47,0.25)" : "rgba(0,0,0,0.06)"}`,
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <CoachAvatar coach={c} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div>
                    <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
                      {c.displayName}{" "}
                      {c.featured && (
                        <span style={{ marginLeft: 6, padding: "1px 7px", background: "rgba(196,168,106,0.15)", borderRadius: 100, fontFamily: "var(--font-dm-sans)", fontSize: 9, color: "#7A6020", fontWeight: 600 }}>
                          Featured
                        </span>
                      )}
                    </p>
                    <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, color: "#7A7268" }}>
                      {c.currentRole}{c.currentCompany ? ` · ${c.currentCompany}` : ""}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {c.hourlyRate ? (
                      isPro
                        ? <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 14, fontWeight: 600, color: "#1A3A2F" }}>${c.hourlyRate}<span style={{ fontSize: 10, color: "#A09890", fontWeight: 400 }}>/hr</span></p>
                        : <p onClick={onSubscribe} title="Subscribe to see rate" style={{ cursor: "pointer", userSelect: "none" }}>
                            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: 14, fontWeight: 600, color: "#1A3A2F", filter: "blur(5px)", pointerEvents: "none" }}>${c.hourlyRate}</span>
                            <span style={{ fontSize: 10, color: "#A09890", filter: "blur(5px)", pointerEvents: "none" }}>/hr</span>
                          </p>
                    ) : null}
                    {c.location && (
                      <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, color: "#A09890" }}>{c.location}</p>
                    )}
                  </div>
                </div>

                {c.headline && (
                  <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 300, color: "#52493F", lineHeight: 1.55, marginBottom: 10, textWrap: "pretty" } as React.CSSProperties}>
                    {c.headline}
                  </p>
                )}

                {c.specialties.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {c.specialties.map((s) => (
                      <span key={s} style={{ padding: "4px 10px", background: "rgba(26,58,47,0.06)", borderRadius: 100, fontFamily: "var(--font-dm-sans)", fontSize: 10, color: "#1A3A2F" }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {c.firms.map((f) => (
                    <span key={f} style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, color: "#1A3A2F", fontWeight: 500 }}>{f}</span>
                  ))}
                  {c.firms.length > 0 && c.schools.length > 0 && <span style={{ color: "#d4cfc9", fontSize: 10 }}>·</span>}
                  {c.schools.slice(0, 2).map((s) => (
                    <span key={s} style={{ fontFamily: "var(--font-dm-sans)", fontSize: 10, color: "#A09890" }}>{s}</span>
                  ))}
                  {(c.linkedinUrl || c.lelandUrl) && <span style={{ color: "#d4cfc9", fontSize: 10 }}>·</span>}
                  {c.lelandUrl && (
                    <a href={c.lelandUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#4A8B6A", textDecoration: "none", fontFamily: "var(--font-dm-sans)" }}>
                      Leland ↗
                    </a>
                  )}
                  {c.linkedinUrl && (
                    <a href={c.linkedinUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#4A8B6A", textDecoration: "none", fontFamily: "var(--font-dm-sans)" }}>
                      LinkedIn ↗
                    </a>
                  )}
                  <span style={{ flex: 1 }} />
                  {isPro
                    ? <button style={{ padding: "8px 16px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: 6, fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Book →</button>
                    : <button onClick={onSubscribe} style={{ padding: "8px 16px", background: "#F2EDE3", color: "#7a7268", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontFamily: "var(--font-dm-sans)", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>🔒 Book</button>
                  }
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <p style={{ color: "#a09890", fontSize: 13, textAlign: "center", padding: "40px 0" }}>No coaches match your search.</p>
          )}
        </div>
      )}
    </div>
  );
}
