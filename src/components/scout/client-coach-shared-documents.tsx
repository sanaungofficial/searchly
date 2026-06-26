"use client";

import { useEffect, useState } from "react";
import type { CoachSharedDocumentView } from "@/lib/coach-shared-documents";
import { ScoutBox } from "@/components/scout/scout-box";
import { border, color, fontMono, fontSans, surface } from "@/lib/typography";

export function ClientCoachSharedDocuments({
  coachProfileId,
  coachName,
  compact = false,
}: {
  coachProfileId?: string;
  coachName?: string;
  compact?: boolean;
}) {
  const [documents, setDocuments] = useState<CoachSharedDocumentView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = coachProfileId ? `?coachProfileId=${encodeURIComponent(coachProfileId)}` : "";
    fetch(`/api/coaching/shared-documents${q}`)
      .then((r) => (r.ok ? r.json() : { documents: [] }))
      .then((d) => setDocuments(d.documents ?? []))
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [coachProfileId]);

  if (loading) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: compact ? "12px 0 0" : "0" }}>
        Loading shared documents…
      </p>
    );
  }

  if (documents.length === 0) return null;

  return (
    <div style={{ marginTop: compact ? 14 : 0 }}>
      {!compact && (
        <p
          style={{
            fontFamily: fontMono,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: color.muted,
            margin: "0 0 10px",
          }}
        >
          {coachName ? `Documents from ${coachName}` : "Shared by your coaches"}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {documents.map((doc) => (
          <div
            key={doc.id}
            style={{
              padding: compact ? "10px 12px" : "12px 14px",
              border: border.line,
              background: surface.inset,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: color.ink }}>
                  {doc.name}
                </p>
                <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: 0 }}>
                  {doc.typeLabel}
                  {!coachProfileId && ` · ${doc.coachName}`}
                  {" · "}
                  {new Date(doc.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  {doc.uploadedByName ? ` · from ${doc.uploadedByName}` : ""}
                </p>
                {doc.notes && (
                  <p style={{ fontFamily: fontSans, fontSize: 12, color: color.stone, margin: "6px 0 0", fontStyle: "italic" }}>
                    {doc.notes}
                  </p>
                )}
              </div>
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: fontSans,
                  fontSize: 12,
                  fontWeight: 600,
                  color: color.forest,
                  textDecoration: "none",
                  flexShrink: 0,
                }}
              >
                Open →
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClientCoachSharedDocumentsSection({ isMobile = false }: { isMobile?: boolean }) {
  const [documents, setDocuments] = useState<CoachSharedDocumentView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/coaching/shared-documents")
      .then((r) => (r.ok ? r.json() : { documents: [] }))
      .then((d) => setDocuments(d.documents ?? []))
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: "16px 0 0" }}>
        Loading shared documents…
      </p>
    );
  }

  if (documents.length === 0) return null;

  const byCoach = new Map<string, CoachSharedDocumentView[]>();
  for (const doc of documents) {
    const list = byCoach.get(doc.coachProfileId) ?? [];
    list.push(doc);
    byCoach.set(doc.coachProfileId, list);
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <p
        style={{
          fontFamily: fontMono,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: color.muted,
          margin: "0 0 12px",
        }}
      >
        Documents from your coaches
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from(byCoach.entries()).map(([coachId, docs]) => (
          <ScoutBox key={coachId} padding={isMobile ? 14 : 18}>
            <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, margin: "0 0 12px", color: color.ink }}>
              {docs[0]?.coachName ?? "Coach"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    padding: "10px 12px",
                    border: border.line,
                    background: surface.inset,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>{doc.name}</p>
                    <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: 0 }}>
                      {doc.typeLabel}
                      {" · "}
                      {new Date(doc.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      {doc.uploadedByName ? ` · shared by ${doc.uploadedByName}` : ""}
                    </p>
                    {doc.notes && (
                      <p style={{ fontFamily: fontSans, fontSize: 12, color: color.stone, margin: "6px 0 0", fontStyle: "italic" }}>
                        {doc.notes}
                      </p>
                    )}
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.forest, flexShrink: 0 }}
                  >
                    Open →
                  </a>
                </div>
              ))}
            </div>
          </ScoutBox>
        ))}
      </div>
    </div>
  );
}
