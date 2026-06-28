"use client";

import { useCallback, useRef, useState } from "react";
import type { ClientImportApplyResult, ClientImportPreview } from "@/lib/client-import/types";
import { truncateImportJobUrl } from "@/lib/client-import/job-url";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";
import { formatApiErrorMessage, readResponseJson } from "@/lib/api-error-message";

const ACCEPT = ".xlsx,.xls,.docx,.doc,.pdf,.txt";

function toggleRow<T extends { id: string; selected: boolean }>(
  preview: ClientImportPreview,
  bucket: keyof Pick<
    ClientImportPreview,
    "pipelineJobs" | "companies" | "contacts" | "profile"
  >,
  id: string,
  selected: boolean,
): ClientImportPreview {
  if (bucket === "profile") return preview;
  const rows = preview[bucket].map((row) => (row.id === id ? { ...row, selected } : row));
  return { ...preview, [bucket]: rows };
}

function toggleProfileRole(
  preview: ClientImportPreview,
  kind: "targetRoles" | "deprioritizedRoles",
  id: string,
  selected: boolean,
): ClientImportPreview {
  const rows = preview.profile[kind].map((row) => (row.id === id ? { ...row, selected } : row));
  return {
    ...preview,
    profile: { ...preview.profile, [kind]: rows },
  };
}

function setBucketSelection(
  preview: ClientImportPreview,
  bucket: "pipelineJobs" | "companies" | "contacts",
  selected: boolean,
): ClientImportPreview {
  return {
    ...preview,
    [bucket]: preview[bucket].map((row) => ({ ...row, selected })),
  };
}

function setProfileRoleSelection(
  preview: ClientImportPreview,
  kind: "targetRoles" | "deprioritizedRoles",
  selected: boolean,
): ClientImportPreview {
  return {
    ...preview,
    profile: {
      ...preview.profile,
      [kind]: preview.profile[kind].map((row) => ({ ...row, selected })),
    },
  };
}

function ImportReviewModal({
  preview,
  applyResume,
  onApplyResumeChange,
  onToggle,
  onToggleRole,
  onSelectAll,
  onUnselectAll,
  onSelectAllRoles,
  onUnselectAllRoles,
  onClose,
  onApply,
  applying,
}: {
  preview: ClientImportPreview;
  applyResume: boolean;
  onApplyResumeChange: (v: boolean) => void;
  onToggle: (bucket: "pipelineJobs" | "companies" | "contacts", id: string, selected: boolean) => void;
  onToggleRole: (kind: "targetRoles" | "deprioritizedRoles", id: string, selected: boolean) => void;
  onSelectAll: (bucket: "pipelineJobs" | "companies" | "contacts") => void;
  onUnselectAll: (bucket: "pipelineJobs" | "companies" | "contacts") => void;
  onSelectAllRoles: (kind: "targetRoles" | "deprioritizedRoles") => void;
  onUnselectAllRoles: (kind: "targetRoles" | "deprioritizedRoles") => void;
  onClose: () => void;
  onApply: () => void;
  applying: boolean;
}) {
  const selectedJobs = preview.pipelineJobs.filter((r) => r.selected).length;
  const selectedCos = preview.companies.filter((r) => r.selected).length;
  const selectedContacts = preview.contacts.filter((r) => r.selected).length;
  const selectedRoles = preview.profile.targetRoles.filter((r) => r.selected).length;
  const selectedDeprioritized = preview.profile.deprioritizedRoles.filter((r) => r.selected).length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#FFFDF9",
          maxWidth: 720,
          width: "100%",
          maxHeight: "88vh",
          overflow: "auto",
          padding: 24,
          border: "var(--scout-border)",
        }}
      >
        <h3 style={{ fontFamily: fontSans, fontSize: 18, fontWeight: 600, margin: "0 0 8px", color: color.forest }}>
          Review import
        </h3>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 8px", lineHeight: 1.5 }}>
          Nothing is written until you click Apply selected. Uncheck rows you want to skip.
        </p>
        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.forest, margin: "0 0 16px", lineHeight: 1.5 }}>
          {preview.pipelineJobs.length} pipeline jobs · {preview.companies.length} companies ·{" "}
          {preview.contacts.length} contacts
          {preview.pipelineJobs.length > 0
            ? " — jobs import with stage from Application Status; companies match Hirebase when possible so they stay on the watchlist even if a posting is gone."
            : ""}
        </p>

        {preview.warnings.length > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: surface.inset, border: "var(--scout-border)" }}>
            {preview.warnings.map((w) => (
              <p key={w} style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "0 0 4px" }}>
                {w}
              </p>
            ))}
          </div>
        )}

        {preview.resume && (
          <Section title="Resume">
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontFamily: fontSans, fontSize: 13 }}>
              <input type="checkbox" checked={applyResume} onChange={(e) => onApplyResumeChange(e.target.checked)} />
              <span>
                Apply <strong>{preview.resume.filename}</strong>
                {preview.resume.summary ? ` — ${preview.resume.summary}` : ""}
              </span>
            </label>
          </Section>
        )}

        {(preview.profile.targetRoles.length > 0 ||
          preview.profile.deprioritizedRoles.length > 0 ||
          preview.profile.searchDuration ||
          preview.profile.avoidNotes) && (
          <Section title="Profile & roles">
            {preview.profile.searchDuration && (
              <p style={{ fontFamily: fontSans, fontSize: 13, margin: "0 0 8px" }}>
                Search activity: {preview.profile.searchDuration}
              </p>
            )}
            {preview.profile.avoidNotes && (
              <p style={{ fontFamily: fontSans, fontSize: 13, margin: "0 0 8px", color: color.stone }}>
                Notes: {preview.profile.avoidNotes.slice(0, 200)}
                {preview.profile.avoidNotes.length > 200 ? "…" : ""}
              </p>
            )}
            {preview.profile.targetRoles.length > 0 && (
              <>
                <BulkToggle
                  label={`Target roles (${selectedRoles}/${preview.profile.targetRoles.length})`}
                  onSelectAll={() => onSelectAllRoles("targetRoles")}
                  onUnselectAll={() => onUnselectAllRoles("targetRoles")}
                />
                {preview.profile.targetRoles.map((row) => (
                  <CheckRow
                    key={row.id}
                    checked={row.selected}
                    onChange={(v) => onToggleRole("targetRoles", row.id, v)}
                    label={row.data}
                  />
                ))}
              </>
            )}
            {preview.profile.deprioritizedRoles.length > 0 && (
              <>
                <BulkToggle
                  label={`Deprioritized (${selectedDeprioritized}/${preview.profile.deprioritizedRoles.length})`}
                  onSelectAll={() => onSelectAllRoles("deprioritizedRoles")}
                  onUnselectAll={() => onUnselectAllRoles("deprioritizedRoles")}
                />
                {preview.profile.deprioritizedRoles.map((row) => (
                  <CheckRow
                    key={row.id}
                    checked={row.selected}
                    onChange={(v) => onToggleRole("deprioritizedRoles", row.id, v)}
                    label={row.data}
                  />
                ))}
              </>
            )}
          </Section>
        )}

        <Section
          title={`Pipeline jobs (${selectedJobs}/${preview.pipelineJobs.length})`}
          onSelectAll={() => onSelectAll("pipelineJobs")}
          onUnselectAll={() => onUnselectAll("pipelineJobs")}
          showBulk={preview.pipelineJobs.length > 0}
        >
          {preview.pipelineJobs.length === 0 ? (
            <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>
              No jobs found. Your sheet needs a tab with Company and Job Title columns (e.g. Job Tracker).
            </p>
          ) : (
            <div style={{ maxHeight: 280, overflowY: "auto", paddingRight: 4 }}>
              {preview.pipelineJobs.map((row) => (
                <JobCheckRow
                  key={row.id}
                  checked={row.selected}
                  onChange={(v) => onToggle("pipelineJobs", row.id, v)}
                  company={row.data.company}
                  role={row.data.role}
                  stage={row.data.stage}
                  url={row.data.url}
                />
              ))}
            </div>
          )}
        </Section>

        {preview.companies.length > 0 && (
          <Section
            title={`Target companies (${selectedCos}/${preview.companies.length})`}
            onSelectAll={() => onSelectAll("companies")}
            onUnselectAll={() => onUnselectAll("companies")}
            showBulk
          >
            <div style={{ maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
              {preview.companies.map((row) => (
                <CheckRow
                  key={row.id}
                  checked={row.selected}
                  onChange={(v) => onToggle("companies", row.id, v)}
                  label={row.data.name}
                />
              ))}
            </div>
          </Section>
        )}

        {preview.contacts.length > 0 && (
          <Section
            title={`Inbox contacts (${selectedContacts}/${preview.contacts.length})`}
            onSelectAll={() => onSelectAll("contacts")}
            onUnselectAll={() => onUnselectAll("contacts")}
            showBulk
          >
            <div style={{ maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
              {preview.contacts.map((row) => (
                <CheckRow
                  key={row.id}
                  checked={row.selected}
                  onChange={(v) => onToggle("contacts", row.id, v)}
                  label={`${row.data.name ?? row.data.email}${row.data.company ? ` · ${row.data.company}` : ""}`}
                />
              ))}
            </div>
          </Section>
        )}

        {preview.referenceDocuments.length > 0 && (
          <Section title="Reference documents (stored only)">
            {preview.referenceDocuments.map((doc) => (
              <p key={doc.id} style={{ fontFamily: fontSans, fontSize: 13, margin: "0 0 6px", color: color.stone }}>
                {doc.filename} — {doc.reason}
              </p>
            ))}
          </Section>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <ScoutSecondaryBtn onClick={onClose} disabled={applying}>
            Cancel
          </ScoutSecondaryBtn>
          <ScoutPrimaryBtn onClick={onApply} disabled={applying}>
            {applying ? "Applying…" : "Apply selected"}
          </ScoutPrimaryBtn>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  onSelectAll,
  onUnselectAll,
  showBulk = false,
}: {
  title: string;
  children: React.ReactNode;
  onSelectAll?: () => void;
  onUnselectAll?: () => void;
  showBulk?: boolean;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <p
          style={{
            fontFamily: fontSans,
            fontSize: 12,
            fontWeight: 600,
            color: color.muted,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            margin: 0,
          }}
        >
          {title}
        </p>
        {showBulk && onSelectAll && onUnselectAll ? (
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <BulkLink onClick={onSelectAll}>Select all</BulkLink>
            <BulkLink onClick={onUnselectAll}>Unselect all</BulkLink>
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function BulkToggle({
  label,
  onSelectAll,
  onUnselectAll,
}: {
  label: string;
  onSelectAll: () => void;
  onUnselectAll: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        margin: "12px 0 6px",
      }}
    >
      <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.stone, margin: 0 }}>{label}</p>
      <div style={{ display: "flex", gap: 10 }}>
        <BulkLink onClick={onSelectAll}>Select all</BulkLink>
        <BulkLink onClick={onUnselectAll}>Unselect all</BulkLink>
      </div>
    </div>
  );
}

function BulkLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: fontSans,
        fontSize: 11,
        color: color.forest,
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textDecoration: "underline",
      }}
    >
      {children}
    </button>
  );
}

function JobCheckRow({
  checked,
  onChange,
  company,
  role,
  stage,
  url,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  company: string;
  role: string;
  stage: string;
  url: string | null;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        fontFamily: fontSans,
        fontSize: 13,
        marginBottom: 8,
        cursor: "pointer",
      }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2 }} />
      <span style={{ minWidth: 0 }}>
        <span>
          {company} — {role} ({stage.toLowerCase()})
        </span>
        {url ? (
          <span
            style={{
              display: "block",
              fontSize: 11,
              color: color.muted,
              marginTop: 2,
              wordBreak: "break-all",
            }}
            title={url}
          >
            {truncateImportJobUrl(url)}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        fontFamily: fontSans,
        fontSize: 13,
        marginBottom: 6,
        cursor: "pointer",
      }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2 }} />
      <span>{label}</span>
    </label>
  );
}

export function AdminClientImportPanel({ clientUserId }: { clientUserId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<ClientImportPreview | null>(null);
  const [applyResume, setApplyResume] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const onFiles = useCallback((list: FileList | null) => {
    if (!list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    setError(null);
    setSuccess(null);
  }, []);

  async function handleParse() {
    if (!files.length) {
      setError("Choose at least one file (.xlsx export from Google Sheets, Word docs, resume).");
      return;
    }
    setParsing(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      const res = await fetch(`/api/admin/clients/${clientUserId}/import/parse`, {
        method: "POST",
        body: form,
      });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Parse failed"));
      setPreview(data.preview as ClientImportPreview);
      setApplyResume(false);
      setShowReview(true);
    } catch (e) {
      setError(formatApiErrorMessage(e, "Parse failed"));
    } finally {
      setParsing(false);
    }
  }

  async function handleApply() {
    if (!preview) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientUserId}/import/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview, applyResume }),
      });
      const data = (await readResponseJson(res)) as ClientImportApplyResult & { error?: string };
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Apply failed"));

      const parts = [
        data.profileUpdated ? "profile updated" : null,
        data.roles?.targetSelected || data.roles?.deprioritizedSelected
          ? `roles ${data.roles.targetSelected} target, ${data.roles.deprioritizedSelected} deprioritized`
          : null,
        data.jobs.added || data.jobs.updated
          ? `jobs ${data.jobs.added} added, ${data.jobs.updated} updated`
          : null,
        data.jobs.descriptionsEnriched
          ? `${data.jobs.descriptionsEnriched} job descriptions filled from posting links`
          : null,
        data.companies.added || data.companies.updated
          ? `companies ${data.companies.added} added, ${data.companies.updated} updated`
          : null,
        data.contacts.added || data.contacts.updated
          ? `contacts ${data.contacts.added} added, ${data.contacts.updated} updated`
          : null,
        data.referenceDocumentsStored ? `${data.referenceDocumentsStored} reference docs stored` : null,
      ].filter(Boolean);

      const errNote =
        data.errors?.length > 0
          ? ` Some rows failed (${data.errors.slice(0, 3).join("; ")}${data.errors.length > 3 ? "…" : ""}).`
          : "";

      setSuccess(parts.length ? `Import complete: ${parts.join("; ")}.${errNote}` : `Import complete.${errNote}`);
      setShowReview(false);
      setPreview(null);
      setFiles([]);
    } catch (e) {
      setError(formatApiErrorMessage(e, "Apply failed"));
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <ScoutBox padding={20} style={{ marginBottom: 20 }}>
        <p
          style={{
            fontFamily: fontSans,
            fontSize: 13,
            fontWeight: 600,
            color: color.muted,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: "0 0 8px",
          }}
        >
          Import client packet
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: color.forest, textTransform: "none" }}>
            Admin only
          </span>
        </p>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 12px", lineHeight: 1.55 }}>
          Download the Google Sheet as <strong>.xlsx</strong>, then upload it with strategy Word docs and resume. Parses
          job tracker, contacts, target companies, and roles. Review everything before apply — no auto-updates.
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          style={{ display: "none" }}
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {files.length > 0 && (
          <ul style={{ fontFamily: fontSans, fontSize: 13, margin: "0 0 12px", paddingLeft: 18, color: color.stone }}>
            {files.map((f) => (
              <li key={`${f.name}-${f.size}`}>{f.name}</li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <ScoutSecondaryBtn type="button" onClick={() => inputRef.current?.click()} disabled={parsing}>
            Choose files
          </ScoutSecondaryBtn>
          <ScoutPrimaryBtn type="button" onClick={handleParse} disabled={parsing || !files.length}>
            {parsing ? "Parsing…" : "Parse & review"}
          </ScoutPrimaryBtn>
          {files.length > 0 && (
            <ScoutSecondaryBtn type="button" onClick={() => setFiles([])} disabled={parsing}>
              Clear
            </ScoutSecondaryBtn>
          )}
        </div>

        {error && (
          <p style={{ fontFamily: fontSans, fontSize: 13, color: "#b04040", margin: "12px 0 0" }}>
            {error}
          </p>
        )}
        {success && (
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.forest, margin: "12px 0 0" }}>
            {success}
          </p>
        )}
      </ScoutBox>

      {showReview && preview && (
        <ImportReviewModal
          preview={preview}
          applyResume={applyResume}
          onApplyResumeChange={setApplyResume}
          onToggle={(bucket, id, selected) => setPreview((p) => (p ? toggleRow(p, bucket, id, selected) : p))}
          onToggleRole={(kind, id, selected) => setPreview((p) => (p ? toggleProfileRole(p, kind, id, selected) : p))}
          onSelectAll={(bucket) => setPreview((p) => (p ? setBucketSelection(p, bucket, true) : p))}
          onUnselectAll={(bucket) => setPreview((p) => (p ? setBucketSelection(p, bucket, false) : p))}
          onSelectAllRoles={(kind) => setPreview((p) => (p ? setProfileRoleSelection(p, kind, true) : p))}
          onUnselectAllRoles={(kind) => setPreview((p) => (p ? setProfileRoleSelection(p, kind, false) : p))}
          onClose={() => setShowReview(false)}
          onApply={handleApply}
          applying={applying}
        />
      )}
    </>
  );
}
