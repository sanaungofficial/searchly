"use client";

import { useCallback, useEffect, useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import type {
  JobHiringTeam,
  JobInsiderConnectionsBundle,
  InsiderConnectionPerson,
  PersonNetworkExpandBundle,
} from "@/lib/sumble-job-contacts-service";
import { SUMBLE_ESTIMATED_COSTS } from "@/lib/sumble-credits";
import { SumbleLoadPrompt } from "@/components/scout/market-analytics-ui";
import { fontSans, fontMono, color, surface, border, displayTitleStyle } from "@/lib/typography";
import { ScoutBox, ScoutSecondaryBtn } from "./scout-box";

const sans = fontSans;
const line = border.line;

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

function CompactPersonLink({ person }: { person: InsiderConnectionPerson }) {
  const linkStyle = {
    fontFamily: sans,
    fontSize: 13,
    fontWeight: 600,
    color: color.forest,
    textDecoration: "none" as const,
  };
  if (person.linkedinUrl) {
    return (
      <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
        {person.name} ↗
      </a>
    );
  }
  if (person.sumbleUrl) {
    return (
      <a href={person.sumbleUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
        {person.name} ↗
      </a>
    );
  }
  return <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{person.name}</span>;
}

function PersonRow({ person }: { person: InsiderConnectionPerson }) {
  const [expandLoading, setExpandLoading] = useState(false);
  const [expandData, setExpandData] = useState<PersonNetworkExpandBundle | null>(null);
  const [expandOpen, setExpandOpen] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);

  const canExpand = person.personId != null;

  async function handleExpandNetwork() {
    if (!person.personId) return;

    if (expandData && !expandLoading) {
      setExpandOpen((open) => !open);
      return;
    }

    setExpandLoading(true);
    setExpandError(null);
    setExpandOpen(true);
    try {
      const res = await fetch(`/api/people/sumble-network?personId=${person.personId}&load=1`);
      const body = (await res.json()) as PersonNetworkExpandBundle;
      setExpandData(body);
      if (body.error && !body.managers.length && !body.peers.length) {
        setExpandError(body.error);
      }
    } catch {
      setExpandError("Network error loading related contacts.");
      setExpandOpen(false);
    } finally {
      setExpandLoading(false);
    }
  }

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
        {person.confidenceScore != null && (
          <span style={{ fontFamily: fontMono, fontSize: 11, color: color.mutedLight }}>
            {Math.round(person.confidenceScore * 100)}% match
          </span>
        )}
        {canExpand && (
          <button
            type="button"
            onClick={() => void handleExpandNetwork()}
            disabled={expandLoading}
            style={{
              fontFamily: sans,
              fontSize: 11,
              fontWeight: 600,
              color: color.forest,
              background: "rgba(74,139,106,0.1)",
              border: `1px solid rgba(74,139,106,0.35)`,
              padding: "2px 8px",
              cursor: expandLoading ? "wait" : "pointer",
              marginLeft: "auto",
            }}
          >
            {expandLoading ? "Loading…" : expandOpen ? "Hide network" : `Expand network · ~${SUMBLE_ESTIMATED_COSTS.personNetworkExpand}c`}
          </button>
        )}
      </div>
      {person.jobTitle && (
        <p style={{ fontFamily: sans, fontSize: 13, color: color.muted, margin: "4px 0 0", lineHeight: 1.4 }}>
          {person.jobTitle}
          {person.jobFunction ? ` · ${person.jobFunction}` : ""}
        </p>
      )}
      {expandOpen && expandData && (expandData.managers.length > 0 || expandData.peers.length > 0) && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            background: surface.inset,
            border: line,
          }}
        >
          {expandData.managers.length > 0 && (
            <div style={{ marginBottom: expandData.peers.length ? 10 : 0 }}>
              <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: "#2A4A3A", margin: "0 0 6px" }}>
                Likely managers
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {expandData.managers.map((p) => (
                  <li key={`mgr-${p.personId}-${p.name}`} style={{ marginBottom: 4 }}>
                    <CompactPersonLink person={p} />
                    {p.jobTitle && (
                      <span style={{ fontFamily: sans, fontSize: 12, color: color.muted }}> · {p.jobTitle}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {expandData.peers.length > 0 && (
            <div>
              <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: "#2A4A3A", margin: "0 0 6px" }}>
                Teammates & similar roles
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {expandData.peers.map((p) => (
                  <li key={`peer-${p.personId}-${p.name}`} style={{ marginBottom: 4 }}>
                    <CompactPersonLink person={p} />
                    {p.jobTitle && (
                      <span style={{ fontFamily: sans, fontSize: 12, color: color.muted }}> · {p.jobTitle}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {expandData.creditsUsed ? (
            <p style={{ fontFamily: fontMono, fontSize: 11, color: color.mutedLight, margin: "8px 0 0" }}>
              Used {expandData.creditsUsed} credits
              {expandData.creditsRemaining != null ? ` · ${expandData.creditsRemaining.toLocaleString()} left` : ""}
            </p>
          ) : null}
        </div>
      )}
      {expandError && (
        <p style={{ fontFamily: sans, fontSize: 12, color: color.muted, margin: "6px 0 0" }}>{expandError}</p>
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
        flex: "1 1 280px",
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
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {people.map((p) => (
              <PersonRow key={`${p.bucket}-${p.personId}-${p.name}`} person={p} />
            ))}
          </ul>
        ) : (
          <p style={{ fontFamily: sans, fontSize: 13, color: "#8A8278", margin: 0, lineHeight: 1.5 }}>{emptyHint}</p>
        )}
      </div>
    </div>
  );
}

function TeamSection({ team, companyName }: { team: JobHiringTeam; companyName: string }) {
  return (
    <ScoutBox padding="14px 16px" style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <p style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: color.ink, margin: 0 }}>
          {team.teamName} at {companyName}
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {team.jobsCount != null && (
            <span style={{ fontFamily: fontMono, fontSize: 12, color: color.muted }}>
              {team.jobsCount.toLocaleString()} open roles
            </span>
          )}
          {team.sumbleUrl && (
            <a
              href={team.sumbleUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: color.forest, textDecoration: "none" }}
            >
              Sumble ↗
            </a>
          )}
        </div>
      </div>
      {team.people.length ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {team.people.map((p) => (
            <PersonRow key={`team-${team.teamId}-${p.personId}-${p.name}`} person={p} />
          ))}
        </ul>
      ) : (
        <p style={{ fontFamily: sans, fontSize: 13, color: color.muted, margin: 0 }}>
          No team members returned yet — try refreshing or check Sumble for this org.
        </p>
      )}
    </ScoutBox>
  );
}

function hasContactData(data: JobInsiderConnectionsBundle | null): boolean {
  if (!data) return false;
  return (
    data.hiringManagers.length > 0 ||
    data.orgPeople.length > 0 ||
    data.hiringTeams.some((t) => t.people.length > 0)
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
        setRequiresLoad(body.requiresLoad ?? !hasContactData(body));
        if (body.error && !hasContactData(body) && !body.requiresLoad) {
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

  const roleLabel = data?.titleMapping?.jobFunction ?? null;
  const levelLabel = data?.titleMapping?.jobLevel ?? null;

  if (requiresLoad && !hasContactData(data)) {
    return (
      <ScoutBox padding="20px 22px" style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ color: color.forest, display: "flex" }}><IconPeople /></span>
          <h3 style={displayTitleStyle(18)}>Hiring team · {companyName}</h3>
        </div>
        <SumbleLoadPrompt
          title="Find the hiring team"
          description={
            jobTitle
              ? `Map "${jobTitle}" to a Sumble job function, then load hiring managers, teammates, and LinkedIn profiles at ${companyName}. One click — cached 24 hours.`
              : `Load hiring managers and team members at ${companyName}. Add a job title for better matching.`
          }
          estimatedCredits={data?.estimatedCredits ?? SUMBLE_ESTIMATED_COSTS.jobContacts}
          creditsRemaining={data?.creditsRemaining}
          loading={loading}
          onLoad={() => void load({ fetch: true })}
          loadLabel="Load hiring team"
        />
      </ScoutBox>
    );
  }

  const hiring = data?.hiringManagers ?? [];
  const orgPeople = data?.orgPeople ?? [];
  const teams = data?.hiringTeams ?? [];

  return (
    <ScoutBox padding="20px 22px" style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ color: color.forest, display: "flex" }}><IconPeople /></span>
            <h3 style={displayTitleStyle(18)}>Hiring team · {companyName}</h3>
          </div>
          {roleLabel && (
            <p style={{ fontFamily: sans, fontSize: 13, color: color.muted, margin: 0, lineHeight: 1.5 }}>
              Mapped from {jobTitle ? `"${jobTitle}"` : "this role"} →{" "}
              <strong style={{ color: color.forest, fontWeight: 600 }}>{roleLabel}</strong>
              {levelLabel ? ` · ${levelLabel}` : ""}
              {data?.titleMapping?.source === "sumble" ? " (Sumble title lookup)" : ""}
            </p>
          )}
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
        Found via Sumble from the job posting and org teams. Expand any contact to load their likely managers and teammates (~10 credits each, cached 24h). Use LinkedIn for outreach — email lookup below (~10 credits each).
      </p>

      {error && (
        <p style={{ fontFamily: sans, fontSize: 13, color: color.muted, margin: "0 0 14px" }}>{error}</p>
      )}

      {teams.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          {teams.map((team) => (
            <TeamSection key={`${team.teamId}-${team.teamName}`} team={team} companyName={companyName} />
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <PeopleList
          title="Likely hiring managers"
          people={hiring}
          emptyHint={jobTitle ? `No hiring managers linked to this posting yet.` : "Add a job title to match the posting."}
        />
        <PeopleList
          title={roleLabel ? `More ${roleLabel} at ${companyName}` : "People in this function"}
          people={orgPeople}
          emptyHint={roleLabel ? `No additional ${roleLabel} contacts returned.` : "No people matched for this function."}
        />
      </div>

      {data?.sumbleJobUrl && (
        <p style={{ fontFamily: sans, fontSize: 12, color: color.muted, margin: "0 0 14px" }}>
          <a href={data.sumbleJobUrl} target="_blank" rel="noopener noreferrer" style={{ color: color.forest }}>
            View matched job posting on Sumble ↗
          </a>
          {data.creditsUsed ? ` · Used ${data.creditsUsed} credits` : ""}
          {data.creditsRemaining != null ? ` · ${data.creditsRemaining.toLocaleString()} left` : ""}
        </p>
      )}

      <div>
        <p style={displayTitleStyle(15, { margin: "0 0 10px" })}>Find work email</p>
        <form onSubmit={handleFindEmail} style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <input
            type="url"
            value={linkedinUrl}
            onChange={(e) => {
              setLinkedinUrl(e.target.value);
              if (lookupMessage) setLookupMessage(null);
            }}
            placeholder="Paste a LinkedIn profile URL from above (~10 credits)"
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
