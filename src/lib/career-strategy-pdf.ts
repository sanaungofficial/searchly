import type { CareerStrategyDocument } from "@/lib/career-strategy";

export type StrategyPdfParams = {
  candidateName: string;
  headline?: string | null;
  preparedAt: string;
  targetPlacementWindow?: string | null;
  keyParameters: Array<{ label: string; value: string }>;
  trackedCompanies: Array<{ name: string; priority?: string | null; notes?: string | null }>;
  targetRoles: string[];
  document: CareerStrategyDocument;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function para(text: string): string {
  if (!text.trim()) return "";
  return `<p>${esc(text).replace(/\n/g, "<br/>")}</p>`;
}

function section(title: string, body: string): string {
  if (!body.trim()) return "";
  return `<section><h2>${esc(title)}</h2>${body}</section>`;
}

export function buildStrategyPdfHtml(params: StrategyPdfParams): string {
  const { candidateName, headline, preparedAt, targetPlacementWindow, keyParameters, trackedCompanies, targetRoles, document: d } = params;

  const paramsHtml = keyParameters
    .filter((p) => p.value.trim())
    .map((p) => `<tr><td><strong>${esc(p.label)}</strong></td><td>${esc(p.value)}</td></tr>`)
    .join("");

  const readinessHtml = d.placementReadiness.categories
    .map(
      (c) =>
        `<tr><td>${esc(c.category)}</td><td>${esc(c.score)}</td><td>${esc(c.assessment)}</td></tr>`,
    )
    .join("");

  const anglesHtml = d.positioningStrategy.angles
    .map((a) => `<h4>${esc(a.title)}</h4><p><em>${esc(a.whenToUse)}</em></p>${para(a.description)}`)
    .join("");

  const tiersHtml = d.targetRolesStrategy.tiers
    .map((t) => {
      const roles = t.roles
        .map(
          (r) =>
            `<tr><td>${esc(r.title)}</td><td>${esc(r.typicalEmployer ?? "")}</td><td>${esc(r.whyItFits)}</td></tr>`,
        )
        .join("");
      return `<h3>${esc(t.tier)}${t.allocationPercent ? ` (~${t.allocationPercent}%)` : ""}</h3><table><thead><tr><th>Title</th><th>Employer</th><th>Why it fits</th></tr></thead><tbody>${roles}</tbody></table>`;
    })
    .join("");

  const companiesHtml = trackedCompanies.length
    ? `<table><thead><tr><th>Company</th><th>Priority</th><th>Notes</th></tr></thead><tbody>${trackedCompanies
        .map(
          (c) =>
            `<tr><td>${esc(c.name)}</td><td>${esc(c.priority ?? "")}</td><td>${esc(c.notes ?? "")}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : "<p><em>No companies on watchlist — add targets in Opportunities → Companies.</em></p>";

  const channelHtml = d.searchExecutionStrategy.channelMix
    .map(
      (c) =>
        `<tr><td>${esc(c.channel)}</td><td>${c.effortPercent}%</td><td>${esc(c.weeklyTarget)}</td><td>${esc(c.keyActions)}</td></tr>`,
    )
    .join("");

  const phasesHtml = d.actionPlan.phases
    .map((p) => `<h4>${esc(p.label)}</h4><ul>${p.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`)
    .join("");

  const diffHtml = d.competitiveDifferentiators
    .map(
      (x) =>
        `<tr><td>${esc(x.differentiator)}</td><td>${esc(x.howToArticulate)}</td></tr>`,
    )
    .join("");

  const risksHtml = d.risksAndMitigations
    .map(
      (r) =>
        `<tr><td>${esc(r.risk)}</td><td>${esc(r.impact)}</td><td>${esc(r.mitigation)}</td></tr>`,
    )
    .join("");

  const salaryHtml = (d.salaryMarketContext?.benchmarks ?? [])
    .map((b) => `<tr><td>${esc(b.roleType)}</td><td>${esc(b.range)}</td><td>${esc(b.notes ?? "")}</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Career Strategy — ${esc(candidateName)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 820px; margin: 40px auto; padding: 0 24px; line-height: 1.55; font-size: 11pt; }
  h1 { font-size: 22pt; margin-bottom: 4px; letter-spacing: -0.02em; }
  .subtitle { color: #555; font-size: 11pt; margin-bottom: 32px; }
  h2 { font-size: 13pt; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #ccc; padding-bottom: 6px; margin-top: 28px; }
  h3 { font-size: 12pt; margin-top: 18px; }
  h4 { font-size: 11pt; margin: 14px 0 6px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
  th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f5f5f0; font-weight: 600; }
  ul { margin: 8px 0; padding-left: 20px; }
  li { margin-bottom: 4px; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #ccc; font-size: 9pt; color: #666; }
  @media print { body { margin: 0; } }
</style>
</head><body>
<h1>JOB SEARCH STRATEGY</h1>
<p class="subtitle"><strong>${esc(candidateName)}</strong>${headline ? `<br/>${esc(headline)}` : ""}<br/>Prepared ${esc(preparedAt)}${targetPlacementWindow ? ` &nbsp;|&nbsp; Target Placement Window: ${esc(targetPlacementWindow)}` : ""}</p>

${section("Executive Summary", para(d.executiveSummary))}

${section("Key Candidate Parameters", paramsHtml ? `<table><tbody>${paramsHtml}</tbody></table>` : "")}

${section(
  "Target Roles (Profile)",
  targetRoles.length ? `<ul>${targetRoles.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : "<p><em>Not set in profile.</em></p>",
)}

${section(
  "Placement Readiness Assessment",
  (readinessHtml ? `<table><thead><tr><th>Category</th><th>Score</th><th>Assessment</th></tr></thead><tbody>${readinessHtml}</tbody></table>` : "") +
    para(`${d.placementReadiness.overallReadiness}${d.placementReadiness.overallAssessment ? " — " + d.placementReadiness.overallAssessment : ""}`),
)}

${section(
  "Positioning Strategy",
  para(d.positioningStrategy.coreDirective) +
    (d.positioningStrategy.positioningStatement ? `<blockquote>${esc(d.positioningStrategy.positioningStatement)}</blockquote>` : "") +
    anglesHtml,
)}

${section("Target Roles & Titles", para(d.targetRolesStrategy.intro) + tiersHtml)}

${section("Target Companies (Watchlist)", companiesHtml)}

${section(
  "Search Execution Strategy",
  para(d.searchExecutionStrategy.intro) +
    (channelHtml
      ? `<table><thead><tr><th>Channel</th><th>Effort</th><th>Weekly target</th><th>Key actions</th></tr></thead><tbody>${channelHtml}</tbody></table>`
      : "") +
    (d.searchExecutionStrategy.addressingSearchGap
      ? `<h3>${esc(d.searchExecutionStrategy.addressingSearchGap.title)}</h3>${para(d.searchExecutionStrategy.addressingSearchGap.narrative)}`
      : ""),
)}

${section("90-Day Action Plan", phasesHtml)}

${section(
  "Competitive Differentiators",
  diffHtml
    ? `<table><thead><tr><th>Differentiator</th><th>How to articulate</th></tr></thead><tbody>${diffHtml}</tbody></table>`
    : "",
)}

${salaryHtml ? section("Salary & Market Context", para(d.salaryMarketContext?.intro ?? "") + `<table><thead><tr><th>Role type</th><th>Range</th><th>Notes</th></tr></thead><tbody>${salaryHtml}</tbody></table>`) : ""}

${section(
  "Risks & Mitigations",
  risksHtml
    ? `<table><thead><tr><th>Risk</th><th>Impact</th><th>Mitigation</th></tr></thead><tbody>${risksHtml}</tbody></table>`
    : "",
)}

${section(
  "The Path Forward",
  para(d.pathForward.summary) +
    (d.pathForward.keyChanges.length
      ? `<ol>${d.pathForward.keyChanges.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>`
      : "") +
    para(d.pathForward.closing),
)}

<div class="footer">Confidential &nbsp;|&nbsp; Prepared with Kimchi &nbsp;|&nbsp; ${esc(preparedAt)}</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
}

export function openStrategyPdf(params: StrategyPdfParams): void {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(buildStrategyPdfHtml(params));
  win.document.close();
}
