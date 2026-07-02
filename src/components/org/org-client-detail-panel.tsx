"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScoutBox, ScoutLabel } from "@/components/scout/scout-box";
import { OrgClientIntroMatchesPanel } from "@/components/admin/org-client-intro-matches-section";
import { OrgEmployeeTargetEmployersSection } from "@/components/org/org-employee-target-employers-section";
import { OrgSettingsNav } from "@/components/org/org-settings-nav";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { color, displayTitleStyle, fontMono, fontSans, type as T } from "@/lib/typography";

type ClientDetail = {
  client: {
    userId: string;
    email: string;
    name: string | null;
    headline: string | null;
    profileComplete: boolean;
    profileCompletenessPct: number;
  };
  trackedCompanies: Array<{ id: string; name: string; website: string | null }>;
  isOrgAdmin: boolean;
};

export function OrgClientDetailPanel({
  orgId,
  clientUserId,
}: {
  orgId: string;
  clientUserId: string;
}) {
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetCount, setTargetCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/${orgId}/clients/${clientUserId}`);
      const json = (await res.json()) as ClientDetail & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not load employee.");
      setDetail(json);
      setTargetCount(json.trackedCompanies.length);
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not load employee."));
    } finally {
      setLoading(false);
    }
  }, [orgId, clientUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>Loading employee…</p>
    );
  }

  if (error || !detail) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A" }}>
        {error ?? "Employee not found."}
      </p>
    );
  }

  const label = detail.client.name ?? detail.client.email;
  const apiBase = `/api/org/${orgId}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960 }}>
      <div>
        <Link
          href={`/org/${orgId}/dashboard`}
          style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "none" }}
        >
          ← Org dashboard
        </Link>
        <h1 style={{ ...displayTitleStyle(28), margin: "12px 0 8px" }}>{label}</h1>
        {detail.client.headline && (
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 8px" }}>
            {detail.client.headline}
          </p>
        )}
        <p style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, margin: 0 }}>
          {detail.client.email} · Profile {detail.client.profileCompletenessPct}%
          {detail.client.profileComplete ? " · Ready" : ""}
        </p>
        <OrgSettingsNav orgId={orgId} isOrgAdmin={detail.isOrgAdmin} />
      </div>

      <ScoutBox padding={20}>
        <OrgEmployeeTargetEmployersSection
          orgId={orgId}
          userId={clientUserId}
          readOnly={!detail.isOrgAdmin}
          onChange={setTargetCount}
        />
      </ScoutBox>

      <ScoutBox padding={20}>
        <ScoutLabel>Intro matches</ScoutLabel>
        {!detail.isOrgAdmin && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 0" }}>
            Read-only — org admins can find matches and track intros.
          </p>
        )}
        <OrgClientIntroMatchesPanel
          orgId={orgId}
          clientUserId={clientUserId}
          clientLabel={label}
          apiBase={apiBase}
          readOnly={!detail.isOrgAdmin}
          defaultExpanded
          targetCompanyCount={targetCount}
        />
      </ScoutBox>
    </div>
  );
}
