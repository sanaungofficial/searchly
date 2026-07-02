"use client";

import { useEffect, useState } from "react";
import { ScoutPrimaryBtn, ScoutSecondaryBtn, ScoutBox, ScoutLabel } from "@/components/scout/scout-box";
import { CreateClientModal } from "@/components/admin/create-client-modal";
import { border, color, fontMono, fontSans, surface, type as T } from "@/lib/typography";
import { formatApiErrorMessage } from "@/lib/api-error-message";

type OrgClientRow = {
  assignmentId: string;
  userId: string;
  email: string;
  name: string | null;
  assignedAt: string;
  notes: string | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "var(--scout-border)",
  borderRadius: "var(--scout-radius)",
  fontFamily: fontSans,
  fontSize: T.bodySm,
  boxSizing: "border-box",
  background: surface.card,
  color: color.ink,
};

export function OrgClientAssignmentSection({ orgId }: { orgId: string }) {
  const [clients, setClients] = useState<OrgClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createNotice, setCreateNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/clients`);
      const data = (await res.json()) as { clients?: OrgClientRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load assigned clients.");
      setClients(data.clients ?? []);
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not load assigned clients."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [orgId]);

  async function assignClient(e: React.FormEvent) {
    e.preventDefault();
    const email = clientEmail.trim();
    if (!email) return;

    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, notes: notes.trim() || undefined }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not assign client.");
      setClientEmail("");
      setNotes("");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not assign client."));
    } finally {
      setAdding(false);
    }
  }

  async function removeClient(userId: string) {
    setRemovingUserId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/clients`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: userId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not remove client.");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not remove client."));
    } finally {
      setRemovingUserId(null);
    }
  }

  return (
    <ScoutBox padding={20}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <ScoutLabel>Assigned clients</ScoutLabel>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 0" }}>
            Create new client accounts or link existing ones to this organization.
          </p>
        </div>
        <ScoutPrimaryBtn
          onClick={() => { setShowCreate(true); setCreateNotice(null); }}
          style={{ minHeight: 40 }}
        >
          + Create client
        </ScoutPrimaryBtn>
      </div>

      {createNotice && (
        <div
          style={{
            background: "rgba(26,58,47,0.06)",
            border: "var(--scout-border)",
            padding: "12px 16px",
            marginTop: 16,
            fontSize: T.bodySm,
            color: color.stone,
            lineHeight: 1.5,
          }}
        >
          {createNotice}
        </div>
      )}

      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "12px 0 0" }}>{error}</p>
      )}

      <form
        onSubmit={(e) => void assignClient(e)}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 1fr) minmax(160px, 1fr) auto",
          gap: 12,
          marginTop: 16,
          marginBottom: 20,
          alignItems: "end",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Client email</span>
          <input
            style={inputStyle}
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="client@company.com"
            required
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Notes (optional)</span>
          <input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <ScoutPrimaryBtn type="submit" disabled={adding || !clientEmail.trim()}>
          {adding ? "Assigning…" : "Assign client"}
        </ScoutPrimaryBtn>
      </form>

      {loading ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Loading clients…</p>
      ) : clients.length === 0 ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
          No clients assigned yet — search by the client&apos;s Kimchi login email.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: T.bodySm }}>
            <thead>
              <tr style={{ textAlign: "left", color: color.muted, fontFamily: fontMono, fontSize: T.caption, textTransform: "uppercase" }}>
                <th style={{ padding: "10px 8px" }}>Client</th>
                <th style={{ padding: "10px 8px" }}>Assigned</th>
                <th style={{ padding: "10px 8px" }}>Notes</th>
                <th style={{ padding: "10px 8px" }} />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.assignmentId} style={{ borderTop: border.line }}>
                  <td style={{ padding: "12px 8px" }}>
                    <div style={{ color: color.ink, fontWeight: 600 }}>{client.name ?? client.email}</div>
                    <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>{client.email}</div>
                  </td>
                  <td style={{ padding: "12px 8px", color: color.muted }}>
                    {new Date(client.assignedAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "12px 8px", color: color.muted }}>{client.notes ?? "—"}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>
                    <ScoutSecondaryBtn
                      onClick={() => void removeClient(client.userId)}
                      disabled={removingUserId === client.userId}
                    >
                      {removingUserId === client.userId ? "Removing…" : "Remove"}
                    </ScoutSecondaryBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateClientModal
          apiUrl={`/api/admin/orgs/${orgId}/clients/provision`}
          title="Create client for org"
          description="Creates a new client account and assigns them to this organization. Resume, LinkedIn, and sign-in invite are optional."
          onClose={() => setShowCreate(false)}
          onCreated={(data) => {
            const assignment = data.assignment as OrgClientRow | undefined;
            const warnings = Array.isArray(data.warnings) ? (data.warnings as string[]) : [];
            if (assignment) {
              setClients((prev) => [assignment, ...prev.filter((c) => c.userId !== assignment.userId)]);
            } else {
              void load();
            }
            setCreateNotice(
              warnings.length > 0
                ? warnings.join(" ")
                : "Client created and assigned to this org.",
            );
          }}
        />
      )}
    </ScoutBox>
  );
}
