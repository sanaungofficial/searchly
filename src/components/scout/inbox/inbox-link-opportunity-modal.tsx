"use client";

import { useEffect, useMemo, useState } from "react";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "../scout-box";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import { parseOpportunityFromSubject } from "@/lib/inbox-crm/parse-opportunity";
import type { PipelineJobOption } from "./inbox-types";

type Props = {
  open: boolean;
  subject: string;
  linkedJobId: string | null;
  saving: boolean;
  scopePath: (path: string) => string;
  onClose: () => void;
  onLink: (jobId: string) => void;
  onCreateAndLink: (company: string, role: string) => void;
  onUnlink: () => void;
};

export function InboxLinkOpportunityModal({
  open,
  subject,
  linkedJobId,
  saving,
  scopePath,
  onClose,
  onLink,
  onCreateAndLink,
  onUnlink,
}: Props) {
  const [jobs, setJobs] = useState<PipelineJobOption[]>([]);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const hints = useMemo(() => parseOpportunityFromSubject(subject), [subject]);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    if (!open) return;
    setCompany(hints.company ?? "");
    setRole(hints.role ?? "");
    setShowCreate(false);
    setQuery("");
    fetch(scopePath("/api/jobs"))
      .then((res) => (res.ok ? res.json() : []))
      .then((data) =>
        setJobs(
          (Array.isArray(data) ? data : []).map((j: PipelineJobOption) => ({
            id: j.id,
            company: j.company,
            role: j.role,
            stage: j.stage,
          })),
        ),
      )
      .catch(() => setJobs([]));
  }, [open, scopePath, hints.company, hints.role]);

  if (!open) return null;

  const filtered = jobs.filter((j) => {
    const hay = `${j.company} ${j.role} ${j.stage}`.toLowerCase();
    return !query.trim() || hay.includes(query.trim().toLowerCase());
  });

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(26,24,20,0.4)", zIndex: 1100 }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(440px, 94vw)",
          maxHeight: "85vh",
          overflow: "auto",
          background: surface.card,
          border: "var(--scout-border)",
          borderRadius: 12,
          zIndex: 1101,
          boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "var(--scout-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink }}>
            Link to opportunity
          </p>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18 }}>
            ×
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {!showCreate ? (
            <>
              <input
                type="search"
                placeholder="Search pipeline…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "var(--scout-border)",
                  borderRadius: 8,
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  marginBottom: 10,
                }}
              />
              <div style={{ maxHeight: 220, overflowY: "auto", border: "var(--scout-border)", borderRadius: 8, marginBottom: 12 }}>
                {filtered.length === 0 && (
                  <p style={{ padding: 12, margin: 0, fontFamily: fontSans, fontSize: 12, color: color.muted }}>
                    No matching opportunities.
                  </p>
                )}
                {filtered.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    disabled={saving}
                    onClick={() => onLink(job.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      borderBottom: "var(--scout-border)",
                      background: linkedJobId === job.id ? "rgba(42,107,74,0.08)" : "#fff",
                      cursor: saving ? "wait" : "pointer",
                    }}
                  >
                    <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.ink }}>
                      {job.role}
                    </span>
                    <span style={{ fontFamily: fontSans, fontSize: 12, color: color.muted }}> @ {job.company}</span>
                  </button>
                ))}
              </div>
              <ScoutSecondaryBtn onClick={() => setShowCreate(true)} disabled={saving} style={{ width: "100%" }}>
                + Create new opportunity
              </ScoutSecondaryBtn>
              {linkedJobId && (
                <button
                  type="button"
                  onClick={onUnlink}
                  disabled={saving}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    padding: "8px",
                    border: "none",
                    background: "none",
                    fontFamily: fontSans,
                    fontSize: 12,
                    color: color.muted,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Remove link
                </button>
              )}
            </>
          ) : (
            <>
              <label style={{ display: "block", fontFamily: fontSans, fontSize: 11, color: color.muted, marginBottom: 10 }}>
                Company
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 10px",
                    border: "var(--scout-border)",
                    borderRadius: 6,
                    fontFamily: fontSans,
                    fontSize: 13,
                  }}
                />
              </label>
              <label style={{ display: "block", fontFamily: fontSans, fontSize: 11, color: color.muted, marginBottom: 14 }}>
                Role
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 10px",
                    border: "var(--scout-border)",
                    borderRadius: 6,
                    fontFamily: fontSans,
                    fontSize: 13,
                  }}
                />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <ScoutSecondaryBtn onClick={() => setShowCreate(false)} disabled={saving}>
                  Back
                </ScoutSecondaryBtn>
                <ScoutPrimaryBtn
                  disabled={saving || !company.trim() || !role.trim()}
                  onClick={() => onCreateAndLink(company.trim(), role.trim())}
                >
                  Create & link
                </ScoutPrimaryBtn>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
