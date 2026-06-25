"use client";

import { useEffect, useMemo, useState } from "react";
import { companyLogoUrls, extractCompanyDomain } from "@/lib/company-domain";

const palette = ["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#10b981", "#0ea5e9", "#f43f5e", "#84cc16"];

function initialsFor(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export function CompanyLogo({
  name,
  website,
  careersUrl,
  enrichmentWebsiteUrl,
  logoUrl,
  size = 32,
  borderRadius,
  skipDomainLookup = false,
}: {
  name: string;
  website?: string | null;
  careersUrl?: string | null;
  enrichmentWebsiteUrl?: string | null;
  /** Direct logo URL (e.g. Hirebase company_logo) — tried before domain lookup */
  logoUrl?: string | null;
  size?: number;
  borderRadius?: number;
  /** When true, only use logoUrl — no Clearbit/favicon domain guessing (network recruiter cards). */
  skipDomainLookup?: boolean;
}) {
  const [stage, setStage] = useState<"primary" | "fallback" | "initials">("primary");
  const [directFailed, setDirectFailed] = useState(false);
  const domain = useMemo(
    () => extractCompanyDomain({ name, website, careersUrl, enrichmentWebsiteUrl }),
    [name, website, careersUrl, enrichmentWebsiteUrl]
  );
  const urls = domain ? companyLogoUrls(domain) : null;
  const br = borderRadius ?? (size <= 30 ? 6 : size <= 40 ? 7 : 10);
  const initials = initialsFor(name);
  const bg = colorFor(name);

  useEffect(() => {
    setStage("primary");
    setDirectFailed(false);
  }, [domain, logoUrl]);

  if (logoUrl?.trim() && !directFailed) {
    const br = borderRadius ?? (size <= 30 ? 6 : size <= 40 ? 7 : 10);
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: br,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <img
          src={logoUrl.trim()}
          alt=""
          width={size - 8}
          height={size - 8}
          style={{ objectFit: "contain" }}
          onError={() => setDirectFailed(true)}
        />
      </div>
    );
  }

  if (!skipDomainLookup && domain && urls && stage !== "initials") {
    const src = stage === "primary" ? urls.primary : urls.fallback;
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: br,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <img
          src={src}
          alt=""
          width={size - 8}
          height={size - 8}
          style={{ objectFit: "contain" }}
          onError={() => setStage((s) => (s === "primary" ? "fallback" : "initials"))}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: br,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: size <= 30 ? 10 : size <= 40 ? 12 : 14,
          fontWeight: 700,
          color: "#fff",
        }}
      >
        {initials}
      </span>
    </div>
  );
}
