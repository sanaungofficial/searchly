"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import type { ParsedResumeData } from "@/lib/resume-parse";
import type { JobInsiderConnectionsBundle, InsiderConnectionPerson } from "@/lib/sumble-job-contacts-service";
import { SUMBLE_ESTIMATED_COSTS } from "@/lib/sumble-credits";
import { SumbleLoadPrompt } from "@/components/scout/market-analytics-ui";
import { fontSans, color, surface, border, displayTitleStyle } from "@/lib/typography";
import { ScoutBox, ScoutSecondaryBtn } from "./scout-box";

const sans = fontSans;
const line = border.line;
const mint = "#1A3A2F";

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

function PersonRow({ person }: { person: InsiderConnectionPerson }) {
  return (
    <li style={{ padding: "8px 0", borderBottom: line }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8 }}>
        {person.linkedinUrl ? (
          <a
            href={person.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: color.forest, textDecoration: "none" }}
          >
            {person.name} ↗
          </a>
        ) : person.sumbleUrl ? (
          <a
            href={person.sumbleUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: color.forest, textDecoration: "none" }}
          >
            {person.name} ↗
          </a>
        ) : (
          <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>{person.name}</span>
        )}
        {person.jobLevel && (
          <span style={{ fontFamily: sans, fontSize: 12, color: color.muted }}>{person.jobLevel}</span>
        )}
      </div>
      {person.jobTitle && (
        <p style={{ fontFamily: sans, fontSize: 13, color: color.muted, margin: "4px 0 0", lineHeight: 1.4 }}>
          {person.jobTitle}
        </p>
      )}
    </li>
  );
}

function PeopleList({
  title,
  people,
  emptyHint,
}: {
  title: string;
  people: InsiderConnectionPerson[];
  emptyHint: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        background: surface.card,
        border: line,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "10px 14px", background: "rgba(74,139,106,0.14)", fontFamily: sans, fontSize: 13, fontWeight: 700, color: "#2A4A3A" }}>
        {title}
      </div>
      <div style={{ padding: "12px 14px", flex: 1 }}>
        {people.length ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{people.map((p) => <PersonRow key={`${p.personId}-${p.name}`} person={p} />)}</ul>
        ) : (
          <p style={{ fontFamily: sans, fontSize: 13, color: "#8A8278", margin: 0, lineHeight: 1.5 }}>{emptyHint}</p>
        )}
      </div>
    </div>
  );
}

export function InsiderConnectionPanel({
  companyName,
  jobTitle,
  website,
}: {
  companyName: string;
  jobTitle?: string;
  website?: string | null;
}) {
  const { isPro, isAdmin, startCheckout, loading: subLoading } = useSubscription();
  const [data, setData] = useState<JobInsiderConnectionsBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [requiresLoad, setRequiresLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [revealedEmail, setRevealedEmail] = useState<string | null>(null);

  const [resumeContext, setResumeContext] = useState<ParsedResumeData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile", { signal: AbortSignal.timeout(15000) });
        const body = await res.json().catch(() => null);
        if (!cancelled && res.ok && body?.parsedData) {
          setResumeContext(body.parsedData as ParsedResumeData);
        }
      } catch {
        // optional
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

  const load = useCallback(
    async (options?: { fetch?: boolean; refresh?: boolean }) => {
      const fetch = options?.fetch ?? false;
      const refresh = options?.refresh ?? false;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          company: companyName,
          title: jobTitle ?? "",
        });
        if (website?.trim()) params.set("website", website.trim());
        if (fetch) params.set("load", "1");
        if (refresh) params.set("refresh", "1");
        const res = await fetch(`/api/jobs/insider-connections?${params}`);
        const body = (await res.json()) as JobInsiderConnectionsBundle;
        setData(body);
        setRequiresLoad(body.requiresLoad ?? !body.hiringManagers.length);
        if (body.error && !body.hiringManagers.length && !body.orgPeople.length && !body.requiresLoad) {
          setError(body.error);
        } else {
          setError(body.error ?? null);
        }
      } catch {
        setError("Network error loading contacts.");
      } finally {
        setLoading(false);
      }
    },
    [companyName, jobTitle, website]
  );

  useEffect(() => {
    setData(null);
    setRequiresLoad(true);
    setError(null);
    void load({ fetch: false });
  }, [load]);

  async function handleFindEmail(e: React.FormEvent) {
    e.preventDefault();
    setLookupMessage(null);
    setRevealedEmail(null);
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
      setLookupMessage("Work email lookup is a Pro feature.");
      startCheckout();
      return;
    }

    setEmailLoading(true);
    try {
      const res = await fetch("/api/people/sumble-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl: url, load: true }),
      });
      const body = (await res.json()) as { email?: string; error?: string; person?: { attributes?: { name?: string } } };
      if (body.email) {
        setRevealedEmail(body.email);
        setLookupMessage(body.person?.attributes?.name ? `Found email for ${body.person.attributes.name}.` : "Email found.");
      } else {
        setLookupMessage(body.error ?? "No work email found for this profile.");
      }
    } catch {
      setLookupMessage("Network error — try again.");
    } finally {
      setEmailLoading(false);
    }
  }

  const emailCreditsLabel = isPro || isAdmin
    ? `Email reveal · ~${SUMBLE_ESTIMATED_COSTS.emailReveal} Sumble credits`
    : "Email reveals — Pro feature";

  if (requiresLoad && !data?.hiringManagers.length && !data?.orgPeople.length) {
    return (
      <ScoutBox padding="20px 22px" style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ color: color.forest, display: "flex" }}><IconPeople /></span>
          <h3 style={displayTitleStyle(18)}>Insider Connection @{companyName}</h3>
        </div>
        <SumbleLoadPrompt
          title="Hiring contacts"
          description={`Load likely hiring managers and key people at ${companyName} for "${jobTitle || "this role"}". Nothing loads automatically.`}
          estimatedCredits={data?.estimatedCredits ?? SUMBLE_ESTIMATED_COSTS.jobContacts}
          creditsRemaining={data?.creditsRemaining}
          loading={loading}
          onLoad={() => void load({ fetch: true })}
          loadLabel="Load contacts"
        />
      </ScoutBox>
    );
  }

  const hiring = data?.hiringManagers ?? [];
  const orgPeople = data?.orgPeople ?? [];

  return (
    <ScoutBox padding="20px 22px" style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: color.forest, display: "flex" }}><IconPeople /></span>
          <h3 style={displayTitleStyle(18)}>Insider Connection @{companyName}</h3>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {!subLoading && (
            <span style={{ padding: "5px 10px", border: line, background: surface.inset, fontFamily: sans, fontSize: 12, fontWeight: 600, color: color.forest }}>
              {emailCreditsLabel}
            </span>
          )}
          <ScoutSecondaryBtn onClick={() => void load({ fetch: true, refresh: true })} disabled={loading} style={{ minHeight: 36, padding: "6px 10px" }}>
            {loading ? "…" : "Refresh"}
          </ScoutSecondaryBtn>
        </div>
      </div>

      <p style={{ fontFamily: sans, fontSize: 14, color: "#5C534A", lineHeight: 1.6, margin: "0 0 18px" }}>
        Likely hiring managers and people at this company from Sumble.{" "}
        <strong style={{ fontWeight: 600 }}>Reach out via email for higher response rates.</strong>
      </p>

      {error && (
        <p style={{ fontFamily: sans, fontSize: 13, color: color.muted, margin: "0 0 14px" }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <PeopleList
          title="Likely hiring managers"
          people={hiring}
          emptyHint={jobTitle ? `No related people found for "${jobTitle}" yet.` : "Add a job title to improve matching."}
        />
        <PeopleList
          title="Key people at company"
          people={orgPeople}
          emptyHint="No people matched for your target roles yet."
        />
        <PeopleList
          title={previousEmployers.length ? "Alumni connections" : "Your network"}
          people={[]}
          emptyHint={
            previousEmployers.length
              ? `Alumni from ${previousEmployers.join(" / ")} — use email lookup below for specific LinkedIn profiles.`
              : schools.length
                ? `Classmates from ${schools.join(" / ")} — use email lookup for specific profiles.`
                : "Upload your resume to personalize connection hints."
          }
        />
      </div>

      {data?.sumbleJobUrl && (
        <p style={{ fontFamily: sans, fontSize: 12, color: color.muted, margin: "0 0 14px" }}>
          <a href={data.sumbleJobUrl} target="_blank" rel="noopener noreferrer" style={{ color: color.forest }}>
            View matched job on Sumble ↗
          </a>
          {data.creditsRemaining != null ? ` · ${data.creditsRemaining.toLocaleString()} credits left` : ""}
        </p>
      )}

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
            placeholder="Paste LinkedIn profile URL to reveal work email (~10 credits)"
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
            disabled={emailLoading}
            style={{
              width: 46,
              flexShrink: 0,
              background: color.forest,
              color: color.gold,
              border: line,
              borderRadius: 0,
              cursor: emailLoading ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: emailLoading ? 0.7 : 1,
            }}
          >
            <IconSearch />
          </button>
        </form>
        {revealedEmail && (
          <p style={{ fontFamily: sans, fontSize: 14, color: color.forest, fontWeight: 600, margin: "10px 0 0" }}>
            {revealedEmail}
          </p>
        )}
        {lookupMessage && (
          <p style={{ fontFamily: sans, fontSize: 13, color: color.stone, margin: "10px 0 0", lineHeight: 1.5 }}>{lookupMessage}</p>
        )}
      </div>
    </ScoutBox>
  );
}
