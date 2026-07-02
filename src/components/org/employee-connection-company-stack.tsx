"use client";

import { useEffect, useState } from "react";
import { CompanyLogo } from "@/components/scout/company-logo";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import type { OrgConnectionCompanyPreview } from "@/lib/org-network-match";
import { color, fontMono, fontSans, type as T } from "@/lib/typography";

const VISIBLE_COUNT = 4;

function companyTooltip(company: OrgConnectionCompanyPreview): string {
  const countLabel = `${company.contactCount} connection${company.contactCount === 1 ? "" : "s"}`;
  return `${company.companyName} · ${countLabel}`;
}

function CompanyStackCircle({
  company,
  size,
  index,
  overlap,
  total,
}: {
  company: OrgConnectionCompanyPreview;
  size: number;
  index: number;
  overlap: number;
  total: number;
}) {
  return (
    <span
      title={companyTooltip(company)}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        border: "2px solid var(--scout-surface-card, #fff)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: index === 0 ? 0 : -overlap,
        position: "relative",
        zIndex: total - index,
        flexShrink: 0,
        overflow: "hidden",
        background: "var(--scout-surface-card, #fff)",
      }}
    >
      <CompanyLogo
        name={company.companyName}
        website={company.website}
        logoUrl={company.logoUrl}
        size={size - 4}
        borderRadius={999}
      />
    </span>
  );
}

export function EmployeeConnectionCompanyStack({
  orgId,
  userId,
  targetCompanyCount,
  compact = false,
}: {
  orgId: string;
  userId: string;
  targetCompanyCount?: number;
  compact?: boolean;
}) {
  const [companies, setCompanies] = useState<OrgConnectionCompanyPreview[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/org/${orgId}/employees/${userId}/connection-companies/preview?limit=5`,
        );
        if (!res.ok) {
          if (!cancelled) {
            setCompanies([]);
            setTotalCount(0);
          }
          return;
        }
        const data = (await res.json()) as {
          companies?: OrgConnectionCompanyPreview[];
          totalCount?: number;
          targetCount?: number;
        };
        if (!cancelled) {
          setCompanies(data.companies ?? []);
          setTotalCount(data.totalCount ?? data.companies?.length ?? 0);
          setTargetCount(data.targetCount ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          setCompanies([]);
          setTotalCount(0);
          void formatApiErrorMessage(e, "Could not load connection preview.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, userId]);

  const effectiveTargetCount = targetCompanyCount ?? targetCount ?? null;

  if (effectiveTargetCount === 0) {
    return (
      <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }} title="Add target employers first">
        No targets
      </span>
    );
  }

  if (loading) {
    return (
      <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>…</span>
    );
  }

  if (companies.length === 0) {
    return (
      <span
        style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}
        title="No pooled contacts match target companies yet"
      >
        No matches
      </span>
    );
  }

  const size = compact ? 24 : 28;
  const overlap = compact ? 8 : 10;
  const visible = companies.slice(0, VISIBLE_COUNT);

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {visible.map((company, index) => (
          <CompanyStackCircle
            key={company.targetCompanyId}
            company={company}
            size={size}
            index={index}
            overlap={overlap}
            total={visible.length}
          />
        ))}
      </div>
      {totalCount > VISIBLE_COUNT && (
        <span
          style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}
          title={`${totalCount - VISIBLE_COUNT} more companies with connections`}
        >
          +{totalCount - VISIBLE_COUNT}
        </span>
      )}
    </div>
  );
}
