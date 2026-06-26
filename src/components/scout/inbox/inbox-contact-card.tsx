"use client";

import { useEffect, useState } from "react";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import { SenderAvatar } from "./sender-avatar";
import { buildSenderAvatarUrls } from "@/lib/email-sender-display";
import type { ContactCardData, PipelineJobOption } from "./inbox-types";

type Props = {
  contactCard: ContactCardData | null;
  linkedJobId: string | null;
  saving: boolean;
  scopePath: (path: string) => string;
  onLinkJob: (jobId: string | null) => void;
};

export function InboxContactCard({ contactCard, linkedJobId, saving, scopePath, onLinkJob }: Props) {
  const [jobs, setJobs] = useState<PipelineJobOption[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setJobsLoading(true);
    fetch(scopePath("/api/jobs"))
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled) return;
        setJobs(
          (Array.isArray(data) ? data : []).map((j: PipelineJobOption) => ({
            id: j.id,
            company: j.company,
            role: j.role,
            stage: j.stage,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setJobs([]);
      })
      .finally(() => {
        if (!cancelled) setJobsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scopePath]);

  if (!contactCard?.contact) return null;

  const { contact, linkedJobs, timeline } = contactCard;
  const avatar = buildSenderAvatarUrls(contact.name ?? contact.email, contact.email);

  return (
    <div
      style={{
        marginBottom: 16,
        padding: 14,
        borderRadius: 12,
        border: border.line,
        background: surface.page,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
        <SenderAvatar
          primary={avatar.primary}
          fallback={avatar.fallback}
          initials={avatar.initials}
          displayName={avatar.displayName}
          size={40}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink }}>
            {contact.name ?? contact.email}
          </p>
          <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
            {contact.email}
            {contact.company ? ` · ${contact.company}` : ""}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: linkedJobs.length ? 10 : 0 }}>
        <label style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, fontWeight: 600 }}>
          Pipeline
        </label>
        <select
          value={linkedJobId ?? ""}
          disabled={saving || jobsLoading}
          onChange={(e) => onLinkJob(e.target.value || null)}
          style={{
            flex: 1,
            minWidth: 180,
            padding: "6px 10px",
            borderRadius: 8,
            border: border.line,
            background: "#fff",
            fontFamily: fontSans,
            fontSize: 12,
            color: color.ink,
          }}
        >
          <option value="">{jobsLoading ? "Loading jobs…" : "Link to opportunity…"}</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.role} @ {job.company} ({job.stage})
            </option>
          ))}
        </select>
      </div>

      {linkedJobs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: timeline.length ? 12 : 0 }}>
          {linkedJobs.map((job) => (
            <span
              key={job.id}
              style={{
                fontFamily: fontSans,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                padding: "3px 8px",
                borderRadius: 999,
                background: "rgba(42,107,74,0.1)",
                color: color.forest,
                border: "1px solid rgba(42,107,74,0.18)",
              }}
            >
              {job.role} @ {job.company}
            </span>
          ))}
        </div>
      )}

      {timeline.length > 0 && (
        <div>
          <p
            style={{
              margin: "0 0 8px",
              fontFamily: fontSans,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: color.muted,
            }}
          >
            Recent with this contact
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {timeline.slice(0, 5).map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "#fff",
                  border: border.line,
                }}
              >
                <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.ink }}>
                  {item.subject ?? "(No subject)"}
                </p>
                <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 11, color: color.muted }}>
                  {item.direction === "OUTBOUND" ? "You sent" : "Received"}
                  {item.occurredAt
                    ? ` · ${new Date(item.occurredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
