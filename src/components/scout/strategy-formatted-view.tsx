"use client";

import type { CareerStrategyDocument } from "@/lib/career-strategy";

const serif = "Georgia, 'Times New Roman', serif";

const thStyle: React.CSSProperties = {
  background: "#f5f5f0",
  fontWeight: 600,
  padding: "8px 10px",
  textAlign: "left",
  border: "1px solid #ddd",
  fontSize: 12,
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #ddd",
  verticalAlign: "top",
  fontSize: 12,
};

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <section style={{ marginTop: 28 }}>
      <h2
        style={{
          fontFamily: serif,
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          borderBottom: "1px solid #ccc",
          paddingBottom: 6,
          margin: "0 0 12px",
          color: "#1a1a1a",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function DocPara({ text }: { text: string }) {
  if (!text?.trim()) return null;
  return (
    <p style={{ fontFamily: serif, fontSize: 14, lineHeight: 1.55, margin: "0 0 12px", color: "#1a1a1a" }}>
      {text}
    </p>
  );
}

export type StrategyFormattedViewProps = {
  candidateName: string;
  headline?: string | null;
  preparedAt: string;
  targetPlacementWindow?: string | null;
  keyParameters?: Array<{ label: string; value: string }>;
  trackedCompanies?: Array<{ name: string; priority?: string | null; notes?: string | null }>;
  targetRoles?: string[];
  document: CareerStrategyDocument;
  isMobile?: boolean;
};

export function StrategyFormattedView({
  candidateName,
  headline,
  preparedAt,
  targetPlacementWindow,
  keyParameters = [],
  trackedCompanies = [],
  targetRoles = [],
  document: d,
  isMobile,
}: StrategyFormattedViewProps) {
  const params = keyParameters.filter((p) => p.value?.trim());
  const pad = isMobile ? "20px 16px" : "32px 28px";

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        padding: pad,
        maxWidth: 820,
        margin: "0 auto",
        boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
      }}
    >
      <header style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: serif,
            fontSize: 22,
            letterSpacing: "-0.02em",
            margin: "0 0 4px",
            color: "#1a1a1a",
          }}
        >
          Job Search Strategy
        </h1>
        <p style={{ fontFamily: serif, fontSize: 13, color: "#555", margin: 0, lineHeight: 1.5 }}>
          <strong>{candidateName}</strong>
          {headline ? (
            <>
              <br />
              {headline}
            </>
          ) : null}
          <br />
          Prepared {preparedAt}
          {targetPlacementWindow ? ` · Target placement: ${targetPlacementWindow}` : ""}
        </p>
      </header>

      <DocSection title="Executive Summary">
        <DocPara text={d.executiveSummary} />
      </DocSection>

      {params.length > 0 && (
        <DocSection title="Search preferences">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {params.map((p) => (
                <tr key={p.label}>
                  <td style={{ ...tdStyle, fontWeight: 600, width: "38%" }}>{p.label}</td>
                  <td style={tdStyle}>{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocSection>
      )}

      {targetRoles.length > 0 && (
        <DocSection title="Target Roles">
          <ul style={{ fontFamily: serif, fontSize: 14, margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
            {targetRoles.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </DocSection>
      )}

      {(d.placementReadiness.categories.length > 0 || d.placementReadiness.overallReadiness) && (
        <DocSection title="Placement Readiness Assessment">
          {d.placementReadiness.categories.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>Assessment</th>
                </tr>
              </thead>
              <tbody>
                {d.placementReadiness.categories.map((c) => (
                  <tr key={c.category}>
                    <td style={tdStyle}>{c.category}</td>
                    <td style={tdStyle}>{c.score}</td>
                    <td style={tdStyle}>{c.assessment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <DocPara
            text={[d.placementReadiness.overallReadiness, d.placementReadiness.overallAssessment]
              .filter(Boolean)
              .join(" — ")}
          />
        </DocSection>
      )}

      <DocSection title="Positioning Strategy">
        <DocPara text={d.positioningStrategy.coreDirective} />
        {d.positioningStrategy.positioningStatement && (
          <blockquote
            style={{
              fontFamily: serif,
              fontSize: 14,
              fontStyle: "italic",
              borderLeft: "3px solid #1A3A2F",
              paddingLeft: 16,
              margin: "12px 0",
              color: "#333",
            }}
          >
            {d.positioningStrategy.positioningStatement}
          </blockquote>
        )}
        {d.positioningStrategy.angles.map((a) => (
          <div key={a.title} style={{ marginBottom: 14 }}>
            <p style={{ fontFamily: serif, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>{a.title}</p>
            <p style={{ fontFamily: serif, fontSize: 13, color: "#666", margin: "0 0 4px", fontStyle: "italic" }}>
              {a.whenToUse}
            </p>
            <DocPara text={a.description} />
          </div>
        ))}
      </DocSection>

      {(d.targetRolesStrategy.intro || d.targetRolesStrategy.tiers.length > 0) && (
        <DocSection title="Target Roles & Titles">
          <DocPara text={d.targetRolesStrategy.intro} />
          {d.targetRolesStrategy.tiers.map((t) => (
            <div key={t.tier} style={{ marginBottom: 16 }}>
              <h3 style={{ fontFamily: serif, fontSize: 13, margin: "0 0 8px" }}>
                {t.tier}
                {t.allocationPercent != null ? ` (~${t.allocationPercent}%)` : ""}
              </h3>
              {t.roles.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Title</th>
                      <th style={thStyle}>Typical employer</th>
                      <th style={thStyle}>Why it fits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.roles.map((r) => (
                      <tr key={r.title}>
                        <td style={tdStyle}>{r.title}</td>
                        <td style={tdStyle}>{r.typicalEmployer ?? "—"}</td>
                        <td style={tdStyle}>{r.whyItFits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </DocSection>
      )}

      <DocSection title="Target Companies (Watchlist)">
        {trackedCompanies.length === 0 ? (
          <p style={{ fontFamily: serif, fontSize: 13, color: "#666", fontStyle: "italic", margin: 0 }}>
            No companies on watchlist.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Priority</th>
                <th style={thStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {trackedCompanies.map((c) => (
                <tr key={c.name}>
                  <td style={tdStyle}>{c.name}</td>
                  <td style={tdStyle}>{c.priority ?? "—"}</td>
                  <td style={tdStyle}>{c.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DocSection>

      {(d.searchExecutionStrategy.intro || d.searchExecutionStrategy.channelMix.length > 0) && (
        <DocSection title="Search Execution Strategy">
          <DocPara text={d.searchExecutionStrategy.intro} />
          {d.searchExecutionStrategy.channelMix.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Channel</th>
                  <th style={thStyle}>Effort</th>
                  <th style={thStyle}>Weekly target</th>
                  <th style={thStyle}>Key actions</th>
                </tr>
              </thead>
              <tbody>
                {d.searchExecutionStrategy.channelMix.map((c) => (
                  <tr key={c.channel}>
                    <td style={tdStyle}>{c.channel}</td>
                    <td style={tdStyle}>{c.effortPercent}%</td>
                    <td style={tdStyle}>{c.weeklyTarget}</td>
                    <td style={tdStyle}>{c.keyActions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {d.searchExecutionStrategy.addressingSearchGap && (
            <>
              <h3 style={{ fontFamily: serif, fontSize: 13, margin: "16px 0 8px" }}>
                {d.searchExecutionStrategy.addressingSearchGap.title}
              </h3>
              <DocPara text={d.searchExecutionStrategy.addressingSearchGap.narrative} />
            </>
          )}
        </DocSection>
      )}

      {d.actionPlan.phases.length > 0 && (
        <DocSection title="90-Day Action Plan">
          {d.actionPlan.phases.map((p) => (
            <div key={p.label} style={{ marginBottom: 12 }}>
              <h4 style={{ fontFamily: serif, fontSize: 13, margin: "0 0 6px" }}>{p.label}</h4>
              <ul style={{ fontFamily: serif, fontSize: 14, margin: 0, paddingLeft: 20, lineHeight: 1.55 }}>
                {p.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </DocSection>
      )}

      {d.competitiveDifferentiators.length > 0 && (
        <DocSection title="Competitive Differentiators">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Differentiator</th>
                <th style={thStyle}>How to articulate</th>
              </tr>
            </thead>
            <tbody>
              {d.competitiveDifferentiators.map((x) => (
                <tr key={x.differentiator}>
                  <td style={tdStyle}>{x.differentiator}</td>
                  <td style={tdStyle}>{x.howToArticulate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocSection>
      )}

      {d.salaryMarketContext && (d.salaryMarketContext.benchmarks?.length ?? 0) > 0 && (
        <DocSection title="Salary & Market Context">
          <DocPara text={d.salaryMarketContext.intro} />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Role type</th>
                <th style={thStyle}>Range</th>
                <th style={thStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {d.salaryMarketContext.benchmarks.map((b) => (
                <tr key={b.roleType}>
                  <td style={tdStyle}>{b.roleType}</td>
                  <td style={tdStyle}>{b.range}</td>
                  <td style={tdStyle}>{b.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocSection>
      )}

      {d.risksAndMitigations.length > 0 && (
        <DocSection title="Risks & Mitigations">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Risk</th>
                <th style={thStyle}>Impact</th>
                <th style={thStyle}>Mitigation</th>
              </tr>
            </thead>
            <tbody>
              {d.risksAndMitigations.map((r) => (
                <tr key={r.risk}>
                  <td style={tdStyle}>{r.risk}</td>
                  <td style={tdStyle}>{r.impact}</td>
                  <td style={tdStyle}>{r.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocSection>
      )}

      <DocSection title="The Path Forward">
        <DocPara text={d.pathForward.summary} />
        {d.pathForward.keyChanges.length > 0 && (
          <ol style={{ fontFamily: serif, fontSize: 14, margin: "0 0 12px", paddingLeft: 20, lineHeight: 1.55 }}>
            {d.pathForward.keyChanges.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
        )}
        <DocPara text={d.pathForward.closing} />
      </DocSection>

      <footer
        style={{
          marginTop: 40,
          paddingTop: 16,
          borderTop: "1px solid #ccc",
          fontFamily: serif,
          fontSize: 11,
          color: "#666",
        }}
      >
        Confidential · Prepared with Kimchi · {preparedAt}
      </footer>
    </div>
  );
}
