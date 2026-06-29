"use client";

import Link from "next/link";
import type { ClientImportApplyResult } from "@/lib/client-import/types";
import { buildImportVerifyLinks } from "@/lib/client-import/import-summary";
import { ScoutModal } from "@/components/scout/scout-modal";
import { ScoutDisplayTitle, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

function AuditList({
  title,
  added,
  skipped,
  emptyLabel,
}: {
  title: string;
  added: string[];
  skipped: string[];
  emptyLabel?: string;
}) {
  if (!added.length && !skipped.length) {
    if (!emptyLabel) return null;
    return (
      <AuditSection title={title}>
        <p style={muted}>{emptyLabel}</p>
      </AuditSection>
    );
  }

  return (
    <AuditSection title={title}>
      {added.length > 0 && (
        <>
          <p style={subLabel}>Added ({added.length})</p>
          <ul style={list}>
            {added.map((item) => (
              <li key={`add-${item}`}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {skipped.length > 0 && (
        <>
          <p style={{ ...subLabel, marginTop: added.length ? 10 : 0 }}>Skipped — already on profile ({skipped.length})</p>
          <ul style={{ ...list, color: color.muted }}>
            {skipped.map((item) => (
              <li key={`skip-${item}`}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </AuditSection>
  );
}

function AuditSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={sectionTitle}>{title}</p>
      {children}
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontFamily: fontSans,
  fontSize: 12,
  fontWeight: 600,
  color: color.muted,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  margin: "0 0 8px",
};

const subLabel: React.CSSProperties = {
  fontFamily: fontSans,
  fontSize: 12,
  fontWeight: 600,
  color: color.stone,
  margin: "0 0 4px",
};

const list: React.CSSProperties = {
  fontFamily: fontSans,
  fontSize: 13,
  color: color.ink,
  margin: "0 0 0 18px",
  padding: 0,
  lineHeight: 1.5,
};

const muted: React.CSSProperties = {
  fontFamily: fontSans,
  fontSize: 13,
  color: color.muted,
  margin: 0,
  lineHeight: 1.5,
};

export function ImportSummaryModal({
  open,
  result,
  clientUserId,
  onClose,
}: {
  open: boolean;
  result: ClientImportApplyResult;
  clientUserId?: string;
  onClose: () => void;
}) {
  const { audit } = result;
  const verifyLinks = buildImportVerifyLinks(clientUserId);
  const hasErrors = result.errors.length > 0;
  const hasChanges =
    result.profileUpdated ||
    result.jobs.added + result.jobs.updated > 0 ||
    result.companies.added + result.companies.updated > 0 ||
    result.contacts.added + result.contacts.updated > 0 ||
    result.applicationQa.added > 0;

  return (
    <ScoutModal open={open} onClose={onClose} maxWidth={680} bruddle ariaLabelledBy="import-summary-title">
      <ScoutDisplayTitle id="import-summary-title" size={22} style={{ margin: "0 0 8px" }}>
        Import summary
      </ScoutDisplayTitle>
      <p style={{ ...muted, marginBottom: 16 }}>
        {hasChanges
          ? "Import finished. Review what changed below, then spot-check in the client profile."
          : "Import finished — nothing new was written (rows may have been skipped or already matched)."}
      </p>

      <div style={{ maxHeight: "52vh", overflowY: "auto", paddingRight: 4, marginBottom: 16 }}>
        <AuditList
          title="Target roles"
          added={audit.targetRoles.added}
          skipped={audit.targetRoles.skipped}
        />
        <AuditList
          title="Deprioritized roles"
          added={audit.deprioritizedRoles.added}
          skipped={audit.deprioritizedRoles.skipped}
        />
        <AuditList
          title="Keywords to use"
          added={audit.prioritizedCategories.added}
          skipped={audit.prioritizedCategories.skipped}
        />
        <AuditList
          title="Keywords to avoid"
          added={audit.deprioritizedCategories.added}
          skipped={audit.deprioritizedCategories.skipped}
        />

        {(audit.applicationQa.added.length > 0 || audit.applicationQa.skipped.length > 0) && (
          <AuditSection title="Login credentials">
            {audit.applicationQa.added.length > 0 && (
              <>
                <p style={subLabel}>Saved ({audit.applicationQa.added.length})</p>
                <ul style={list}>
                  {audit.applicationQa.added.map((item) => (
                    <li key={`qa-${item.question}`}>{item.question}</li>
                  ))}
                </ul>
              </>
            )}
            {audit.applicationQa.skipped.length > 0 && (
              <>
                <p style={{ ...subLabel, marginTop: audit.applicationQa.added.length ? 10 : 0 }}>
                  Skipped ({audit.applicationQa.skipped.length})
                </p>
                <ul style={{ ...list, color: color.muted }}>
                  {audit.applicationQa.skipped.map((item) => (
                    <li key={`qa-skip-${item.question}`}>
                      {item.question} — {item.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </AuditSection>
        )}

        {(audit.jobs.added.length > 0 || audit.jobs.updated.length > 0 || audit.jobs.skipped.length > 0) && (
          <AuditSection title="Pipeline jobs">
            {audit.jobs.added.length > 0 && (
              <>
                <p style={subLabel}>Added ({audit.jobs.added.length})</p>
                <ul style={list}>
                  {audit.jobs.added.map((j) => (
                    <li key={`j-add-${j.company}-${j.role}`}>
                      {j.company} — {j.role}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {audit.jobs.updated.length > 0 && (
              <>
                <p style={{ ...subLabel, marginTop: 10 }}>Updated ({audit.jobs.updated.length})</p>
                <ul style={list}>
                  {audit.jobs.updated.map((j) => (
                    <li key={`j-up-${j.company}-${j.role}`}>
                      {j.company} — {j.role}
                      {j.fields?.length ? ` (${j.fields.join(", ")})` : ""}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {audit.jobs.skipped.length > 0 && (
              <>
                <p style={{ ...subLabel, marginTop: 10 }}>Unchanged ({audit.jobs.skipped.length})</p>
                <ul style={{ ...list, color: color.muted }}>
                  {audit.jobs.skipped.slice(0, 12).map((j) => (
                    <li key={`j-skip-${j.company}-${j.role}`}>
                      {j.company} — {j.role}
                    </li>
                  ))}
                  {audit.jobs.skipped.length > 12 && <li>…and {audit.jobs.skipped.length - 12} more</li>}
                </ul>
              </>
            )}
          </AuditSection>
        )}

        {(result.companies.added > 0 || result.companies.updated > 0 || result.companies.skipped > 0) && (
          <AuditSection title="Target companies">
            <p style={muted}>
              {result.companies.added} added · {result.companies.updated} updated · {result.companies.skipped} unchanged
            </p>
          </AuditSection>
        )}

        {(result.contacts.added > 0 || result.contacts.updated > 0) && (
          <AuditSection title="Contacts">
            <p style={muted}>
              {result.contacts.added} added · {result.contacts.updated} updated
            </p>
          </AuditSection>
        )}

        {audit.searchDuration.set && audit.searchDuration.value && (
          <AuditSection title="Search activity">
            <p style={muted}>Set to: {audit.searchDuration.value}</p>
          </AuditSection>
        )}

        {audit.avoidNotes.appended && audit.avoidNotes.preview && (
          <AuditSection title="Strategy notes">
            <p style={muted}>Appended to career motivation: {audit.avoidNotes.preview.slice(0, 160)}…</p>
          </AuditSection>
        )}

        {audit.resume.applied && (
          <AuditSection title="Resume">
            <p style={muted}>Applied{audit.resume.filename ? `: ${audit.resume.filename}` : ""}</p>
          </AuditSection>
        )}

        {result.referenceDocumentsStored > 0 && (
          <AuditSection title="Reference documents">
            <p style={muted}>{result.referenceDocumentsStored} file(s) stored (not applied to profile fields).</p>
          </AuditSection>
        )}

        {result.jobs.descriptionsEnriched > 0 && (
          <AuditSection title="Job descriptions">
            <p style={muted}>{result.jobs.descriptionsEnriched} posting description(s) filled from links.</p>
          </AuditSection>
        )}

        {hasErrors && (
          <div style={{ padding: 12, background: surface.inset, border: border.lineStrong, marginBottom: 8 }}>
            <p style={{ ...subLabel, color: "#b04040", marginBottom: 6 }}>Some rows failed</p>
            <ul style={{ ...list, color: "#b04040" }}>
              {result.errors.slice(0, 6).map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <AuditSection title="How to verify">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {verifyLinks.map((link) => (
            <div key={link.href}>
              <Link
                href={link.href}
                style={{
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  fontWeight: 600,
                  color: color.forest,
                  textDecoration: "underline",
                }}
              >
                {link.label}
              </Link>
              <p style={{ ...muted, fontSize: 12, marginTop: 2 }}>{link.hint}</p>
            </div>
          ))}
        </div>
      </AuditSection>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <ScoutPrimaryBtn onClick={onClose}>Done</ScoutPrimaryBtn>
      </div>
    </ScoutModal>
  );
}
