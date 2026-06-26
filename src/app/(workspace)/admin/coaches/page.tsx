"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/app/(workspace)/admin/admin-nav";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { ScoutBox } from "@/components/scout/scout-box";
import { border, color, displayTitleStyle, fontMono, fontSans, type as T } from "@/lib/typography";

type CoachRow = {
  id: string;
  displayName: string;
  email: string | null;
  slug: string | null;
  photoUrl: string | null;
  headline: string | null;
  status: string;
  calendarConnected: boolean;
  stats: {
    uniqueClients: number;
    totalSessions: number;
    upcomingSessions: number;
    completedSessions: number;
  };
};

export default function AdminCoachesPage() {
  const router = useRouter();
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/coach-hub")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load coaches");
        return r.json();
      })
      .then((d) => setCoaches(d.coaches ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <h1 style={{ ...displayTitleStyle(28), margin: 0 }}>Coaches</h1>
        <AdminNav />
      </div>

      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 20px", maxWidth: 720 }}>
        Coach hub — clients, Kimchi-booked sessions, and booking communications in one view. Sessions come from Nylas Scheduler webhooks only.
      </p>

      {loading && <p style={{ fontFamily: fontSans, color: color.muted }}>Loading coaches…</p>}
      {error && <p style={{ fontFamily: fontSans, color: "#dc2626" }}>{error}</p>}

      {!loading && !error && coaches.length === 0 && (
        <ScoutBox padding={24}>
          <p style={{ fontFamily: fontSans, fontSize: 15, color: color.muted, margin: 0 }}>No coaches yet.</p>
        </ScoutBox>
      )}

      {!loading && coaches.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {coaches.map((coach) => (
            <button
              key={coach.id}
              type="button"
              onClick={() => router.push(`/admin/coaches/${coach.id}`)}
              style={{
                textAlign: "left",
                border: border.line,
                background: "#fff",
                padding: 20,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
                <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={48} />
                <div>
                  <p style={{ margin: 0, fontFamily: fontSans, fontSize: 16, fontWeight: 600 }}>{coach.displayName}</p>
                  {coach.headline && (
                    <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: 12, color: color.muted }}>{coach.headline}</p>
                  )}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", color: color.muted }}>Clients</p>
                  <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 18, fontWeight: 600 }}>{coach.stats.uniqueClients}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", color: color.muted }}>Sessions</p>
                  <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 18, fontWeight: 600 }}>{coach.stats.totalSessions}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", color: color.muted }}>Upcoming</p>
                  <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 18, fontWeight: 600 }}>{coach.stats.upcomingSessions}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", color: color.muted }}>Calendar</p>
                  <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 13, color: coach.calendarConnected ? color.forest : color.muted }}>
                    {coach.calendarConnected ? "Connected" : "—"}
                  </p>
                </div>
              </div>
              {coach.slug && (
                <Link
                  href={`/coaching/coach/${coach.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: "inline-block", marginTop: 12, fontFamily: fontSans, fontSize: 12, color: color.forest }}
                >
                  Public profile →
                </Link>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
