"use client";

import { useEffect, useMemo, useState } from "react";
import { ScoutSecondaryBtn } from "../scout-box";
import { color, fontSans, border, type as T } from "@/lib/typography";
import { parseOpportunityFromSubject } from "@/lib/inbox-crm/parse-opportunity";
import type { ContactCardData, PipelineJobOption } from "./inbox-types";

type Props = {
  contactCard: ContactCardData | null;
  subject: string;
  linkedJobId: string | null;
  linkedJobLabel: string | null;
  saving: boolean;
  saveContactSaving: boolean;
  scopePath: (path: string) => string;
  onLinkJob: (jobId: string | null) => void;
  onCreateAndLink: (company: string, role: string) => void;
  onSaveContact: () => void;
};

export function InboxContactBar({
  contactCard,
  subject,
  linkedJobId,
  linkedJobLabel,
  saving,
  saveContactSaving,
  scopePath,
  onLinkJob,
  onCreateAndLink,
  onSaveContact,
}: Props) {
  const [jobs, setJobs] = useState<PipelineJobOption[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const hints = useMemo(() => parseOpportunityFromSubject(subject), [subject]);
  const contact = contactCard?.contact;
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    setCompany(contact?.company ?? hints.company ?? "");
    setRole(hints.role ?? "");
  }, [contact?.company, contact?.id, hints.company, hints.role]);

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

  if (!contact) return null;

  const priorCount = contactCard?.timeline?.length ?? 0;
  const saved = contact.savedToNylas;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginBottom: 10,
        padding: "10px 12px",
        borderRadius: 10,
        border: border.line,
        background: "rgba(42,107,74,0.04)",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <select
          value={linkedJobId ?? ""}
          disabled={saving || jobsLoading}
          onChange={(e) => onLinkJob(e.target.value || null)}
          style={{
            flex: 1,
            minWidth: 160,
            padding: "6px 10px",
            borderRadius: 8,
            border: border.line,
            background: "#fff",
            fontFamily: fontSans,
            fontSize: 12,
            color: color.ink,
          }}
        >
          <option value="">{linkedJobLabel ? "Change opportunity…" : "Link to opportunity…"}</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.role} @ {job.company}
            </option>
          ))}
        </select>

        <ScoutSecondaryBtn
          onClick={() => setShowCreate((v) => !v)}
          disabled={saving}
          style={{ padding: "6px 12px", fontSize: 12 }}
        >
          {showCreate ? "Cancel" : "+ New opportunity"}
        </ScoutSecondaryBtn>

        <button
          type="button"
          onClick={onSaveContact}
          disabled={saveContactSaving || saved}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: border.line,
            background: saved ? "rgba(42,107,74,0.12)" : "#fff",
            fontFamily: fontSans,
            fontSize: 12,
            fontWeight: 600,
            color: saved ? color.forest : color.ink,
            cursor: saveContactSaving || saved ? "default" : "pointer",
          }}
        >
          {saved ? "Saved to contacts" : saveContactSaving ? "Saving…" : "Save contact"}
        </button>
      </div>

      {linkedJobLabel && (
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 11, color: color.forest, fontWeight: 600 }}>
          Linked: {linkedJobLabel}
        </p>
      )}

      {showCreate && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <label style={{ flex: 1, minWidth: 120, fontFamily: fontSans, fontSize: 11, color: color.muted }}>
            Company
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: "6px 8px",
                borderRadius: 6,
                border: border.line,
                fontFamily: fontSans,
                fontSize: 12,
              }}
            />
          </label>
          <label style={{ flex: 2, minWidth: 160, fontFamily: fontSans, fontSize: 11, color: color.muted }}>
            Role
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: "6px 8px",
                borderRadius: 6,
                border: border.line,
                fontFamily: fontSans,
                fontSize: 12,
              }}
            />
          </label>
          <ScoutSecondaryBtn
            disabled={saving || !company.trim() || !role.trim()}
            onClick={() => {
              onCreateAndLink(company.trim(), role.trim());
              setShowCreate(false);
            }}
            style={{ padding: "7px 12px", fontSize: 12 }}
          >
            Create & link
          </ScoutSecondaryBtn>
        </div>
      )}

      {priorCount > 0 && (
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 11, color: color.muted }}>
          {priorCount} earlier {priorCount === 1 ? "message" : "messages"} with {contact.name?.split(" ")[0] ?? "this contact"}
        </p>
      )}
    </div>
  );
}
