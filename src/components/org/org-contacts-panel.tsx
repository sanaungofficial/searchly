"use client";

import Link from "next/link";
import { OrgPooledContactsSection } from "@/components/admin/org-pooled-contacts-section";
import { OrgSettingsNav } from "@/components/org/org-settings-nav";
import { color, displayTitleStyle, fontSans, type as T } from "@/lib/typography";

export function OrgContactsPanel({ orgId }: { orgId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960 }}>
      <div>
        <Link
          href={`/org/${orgId}/dashboard`}
          style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "none" }}
        >
          ← Org dashboard
        </Link>
        <h1 style={{ ...displayTitleStyle(28), margin: "12px 0 8px" }}>Pooled contacts</h1>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
          Search your organization&apos;s pooled relationship graph by company or name.
        </p>
        <OrgSettingsNav orgId={orgId} active="contacts" />
      </div>

      <OrgPooledContactsSection orgId={orgId} apiBase={`/api/org/${orgId}`} />
    </div>
  );
}
