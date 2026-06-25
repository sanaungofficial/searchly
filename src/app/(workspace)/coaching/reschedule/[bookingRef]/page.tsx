"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { NylasSchedulerEmbed } from "@/components/scout/nylas-scheduler-embed";
import { ScoutBox } from "@/components/scout/scout-box";
import { color, displayTitleStyle, fontSans } from "@/lib/typography";

export default function RescheduleBookingPage() {
  const params = useParams();
  const bookingRef = decodeURIComponent(String(params.bookingRef ?? ""));
  const [meta, setMeta] = useState<{
    configurationId: string;
    coachName: string;
    title: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bookings/ref/${encodeURIComponent(bookingRef)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Booking not found");
        return r.json();
      })
      .then((d) =>
        setMeta({
          configurationId: d.configurationId,
          coachName: d.coachName,
          title: d.title,
        }),
      )
      .catch(() => setError("This booking link is invalid or expired."));
  }, [bookingRef]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 64px" }}>
      <h1 style={{ ...displayTitleStyle(28), margin: "0 0 8px" }}>Reschedule session</h1>
      <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: "0 0 24px", lineHeight: 1.6 }}>
        {meta
          ? `Pick a new time for your session${meta.title ? `: ${meta.title}` : ""} with ${meta.coachName}.`
          : "Loading booking…"}
      </p>

      {error && (
        <ScoutBox padding={20}>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: "#dc2626" }}>{error}</p>
        </ScoutBox>
      )}

      {meta && (
        <ScoutBox padding={16}>
          <NylasSchedulerEmbed
            configurationId={meta.configurationId}
            bookingRef={bookingRef}
            flow="reschedule"
            minHeight={560}
          />
        </ScoutBox>
      )}
    </div>
  );
}
