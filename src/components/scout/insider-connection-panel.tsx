"use client";

import { useEffect, useMemo, useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import type { ParsedResumeData } from "@/lib/resume-parse";
import { fontSans, color, surface, border, displayTitleStyle } from "@/lib/typography";
import { ScoutBox } from "./scout-box";

const sans = fontSans;
const line = border.line;
const mint = "#1A3A2F";

type ConnectionBucket = "beyond" | "previous_company" | "school";

const BUCKET_META: Record<
  ConnectionBucket,
  { label: string; headerBg: string; headerColor: string; accent: string }
> = {
  beyond: {
    label: "Beyond Your Network",
    headerBg: "rgba(74,139,106,0.14)",
    headerColor: "#2A4A3A",
    accent: mint,
  },
  previous_company: {
    label: "From Your Previous Company",
    headerBg: "rgba(91,127,166,0.14)",
    headerColor: "#2A3A4A",
    accent: "#5B7FA6",
  },
  school: {
    label: "From Your School",
    headerBg: "rgba(139,92,166,0.14)",
    headerColor: "#3A2A4A",
    accent: "#8B5CA6",
  },
};

function IconPeople() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="7" r="3" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M3 19c0-2.5 2.5-4 6-4s6 1.5 6 4M14 19c0-1.8 1.6-3 4-3" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

function ConnectionCard({
  bucket,
  emptyTitle,
  emptyHint,
  footerHint,
}: {
  bucket: ConnectionBucket;
  emptyTitle: string;
  emptyHint: string;
  footerHint?: string;
}) {
  const meta = BUCKET_META[bucket];

  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        background: surface.card,
        border: line,
        borderRadius: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          background: meta.headerBg,
          fontFamily: sans,
          fontSize: 13,
          fontWeight: 700,
          color: meta.headerColor,
        }}
      >
        {meta.label}
      </div>
      <div style={{ padding: "16px 14px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: "#1A1A1A", margin: "0 0 6px", lineHeight: 1.4 }}>
          {emptyTitle}
        </p>
        <p style={{ fontFamily: sans, fontSize: 13, color: "#8A8278", margin: 0, lineHeight: 1.5 }}>{emptyHint}</p>
        {footerHint && (
          <p style={{ fontFamily: sans, fontSize: 12, color: meta.accent, margin: "10px 0 0", fontWeight: 600 }}>{footerHint}</p>
        )}
      </div>
    </div>
  );
}

export function InsiderConnectionPanel({ companyName }: { companyName: string }) {
  const { isPro, isAdmin, startCheckout, loading: subLoading } = useSubscription();
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [resumeContext, setResumeContext] = useState<ParsedResumeData | null>(null);
  const [resumeLoaded, setResumeLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { signal: AbortSignal.timeout(15000) });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.parsedData) {
          setResumeContext(data.parsedData as ParsedResumeData);
        }
      } catch {
        // optional context only
      } finally {
        if (!cancelled) setResumeLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const previousEmployers = useMemo(() => {
    const companies = resumeContext?.workExperience?.map((w) => w.company.trim()).filter(Boolean) ?? [];
    return [...new Set(companies)].slice(0, 2);
  }, [resumeContext]);

  const schools = useMemo(() => {
    const names = resumeContext?.education?.map((e) => e.school.trim()).filter(Boolean) ?? [];
    return [...new Set(names)].slice(0, 2);
  }, [resumeContext]);

  const hasResume = !!(
    resumeContext?.workExperience?.length || resumeContext?.education?.length
  );

  const emailCreditsLabel = isPro || isAdmin
    ? "Unlimited email reveals on Pro"
    : "Email reveals — upgrade to Pro";

  function handleFindEmail(e: React.FormEvent) {
    e.preventDefault();
    setLookupMessage(null);
    const url = linkedinUrl.trim();
    if (!url) {
      setLookupMessage("Paste a LinkedIn profile URL to look up a work email.");
      return;
    }
    if (!/^https?:\/\//i.test(url) || !url.includes("linkedin.com/in/")) {
      setLookupMessage("Use a LinkedIn profile URL like https://www.linkedin.com/in/username/");
      return;
    }
    if (!isPro && !isAdmin) {
      setLookupMessage("Work email lookup is a Pro feature. Upgrade to unlock reveals when contact data goes live.");
      startCheckout();
      return;
    }
    setLookupMessage(
      "Email lookup is coming soon — we will reveal work emails here once the Hirebase contact API is connected. No charge until then.",
    );
  }

  const previousHint = previousEmployers.length
    ? `We'll match people at ${companyName} who previously worked at ${previousEmployers.join(" or ")}.`
    : hasResume
      ? "Add work history to your resume to surface alumni at this company."
      : "Upload your resume to find people from your past employers.";

  const schoolHint = schools.length
    ? `We'll match people at ${companyName} from ${schools.join(" or ")}.`
    : hasResume
      ? "Add education to your resume to surface classmates at this company."
      : "Upload your resume to find people from your school.";

  return (
    <ScoutBox padding="20px 22px" style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: color.forest, display: "flex" }}>
            <IconPeople />
          </span>
          <h3 style={displayTitleStyle(18)}>
            Insider Connection @{companyName}
          </h3>
        </div>
        {!subLoading && (
          <span
            title="Work email reveals cost per lookup — included on Pro"
            style={{
              flexShrink: 0,
              padding: "5px 10px",
              borderRadius: 0,
              border: line,
              background: surface.inset,
              fontFamily: sans,
              fontSize: 12,
              fontWeight: 600,
              color: color.forest,
              whiteSpace: "nowrap",
            }}
          >
            {emailCreditsLabel}
          </span>
        )}
      </div>

      <p style={{ fontFamily: sans, fontSize: 14, color: "#5C534A", lineHeight: 1.6, margin: "0 0 18px" }}>
        Discover valuable connections within the company who might provide insights and potential referrals.{" "}
        <strong style={{ fontWeight: 600 }}>Get 3× more responses when you reach out via email instead of LinkedIn.</strong>
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <ConnectionCard
          bucket="beyond"
          emptyTitle="Connections coming soon"
          emptyHint={`People at ${companyName} outside your direct network will appear here once contact discovery is enabled.`}
        />
        <ConnectionCard
          bucket="previous_company"
          emptyTitle={resumeLoaded && !hasResume ? "Add your resume" : "No matches yet"}
          emptyHint={previousHint}
          footerHint={previousEmployers.length ? `Previously @${previousEmployers[0]}` : undefined}
        />
        <ConnectionCard
          bucket="school"
          emptyTitle={schools.length ? "No school matches yet" : "Find more connections"}
          emptyHint={schoolHint}
          footerHint={schools.length ? schools[0] : undefined}
        />
      </div>

      <div>
        <p style={displayTitleStyle(15, { margin: "0 0 10px" })}>Find Any Email</p>
        <form onSubmit={handleFindEmail} style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <input
            type="url"
            value={linkedinUrl}
            onChange={(e) => {
              setLinkedinUrl(e.target.value);
              if (lookupMessage) setLookupMessage(null);
            }}
            placeholder="Paste any LinkedIn profile URL (e.g., https://www.linkedin.com/in/xxxxx/) to find work emails instantly."
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: sans,
              fontSize: 14,
              color: color.ink,
              background: surface.inset,
              border: line,
              borderRadius: 0,
              padding: "12px 14px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            aria-label="Find email"
            style={{
              width: 46,
              flexShrink: 0,
              background: color.forest,
              color: color.gold,
              border: line,
              borderRadius: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconSearch />
          </button>
        </form>
        {lookupMessage && (
          <p style={{ fontFamily: sans, fontSize: 13, color: color.stone, margin: "10px 0 0", lineHeight: 1.5 }}>{lookupMessage}</p>
        )}
      </div>
    </ScoutBox>
  );
}
