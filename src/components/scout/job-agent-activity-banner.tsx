"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScoutBox } from "@/components/scout/scout-box";
import { color, fontSans, type as T } from "@/lib/typography";
import { INBOX_PATH } from "@/lib/workspace-urls";

type Activity = {
  id: string;
  status: string;
  snippet: string | null;
  title: string | null;
  suggestedStage: string | null;
  job: { company: string; role: string } | null;
};

export function JobAgentActivityBanner() {
  const [items, setItems] = useState<Activity[]>([]);

  useEffect(() => {
    fetch("/api/user/job-agent/activity?limit=5")
      .then((r) => (r.ok ? r.json() : { activities: [] }))
      .then((d) => {
        const recent = (d.activities ?? []).filter(
          (a: Activity) => a.status === "APPLIED" || a.status === "PENDING_REVIEW",
        );
        setItems(recent.slice(0, 3));
      })
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <ScoutBox padding={16} style={{ marginBottom: 20, borderColor: "rgba(45,122,80,0.2)" }}>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Inbox agent updates
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((a) => (
          <p key={a.id} style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, margin: 0, lineHeight: 1.5 }}>
            <strong>{a.job ? `${a.job.company} — ${a.job.role}` : a.title ?? "Update"}</strong>
            {a.snippet ? `: ${a.snippet}` : ""}
            {a.suggestedStage && a.status === "PENDING_REVIEW" ? (
              <>
                {" "}
                <Link href={INBOX_PATH} style={{ color: color.forest, fontWeight: 600 }}>
                  Review in Inbox →
                </Link>
              </>
            ) : null}
          </p>
        ))}
      </div>
    </ScoutBox>
  );
}
