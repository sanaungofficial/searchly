/** Reference catalog of Sumble MCP tools for admin — no live MCP server in app. */

export type SumbleMcpTool = {
  name: string;
  endpoint: string;
  method: string;
  description: string;
  creditNotes: string;
  kimchiStatus: "live" | "partial" | "planned";
};

export const SUMBLE_MCP_TOOLS: SumbleMcpTool[] = [
  {
    name: "organizations_lookup",
    endpoint: "POST /v6/organizations",
    method: "POST",
    description: "Match companies by domain, name, or slug. Returns org profile + role metrics.",
    creditNotes: "~1–8 credits per org depending on attributes.",
    kimchiStatus: "live",
  },
  {
    name: "organization_signals",
    endpoint: "GET /v6/organizations/{id}/signals",
    method: "GET",
    description: "Recent intent signals for one organization.",
    creditNotes: "1 credit per signal returned.",
    kimchiStatus: "live",
  },
  {
    name: "signals_search",
    endpoint: "POST /v6/signals",
    method: "POST",
    description: "Global signals feed filtered by job function, org list, or org IDs.",
    creditNotes: "1 credit per signal returned.",
    kimchiStatus: "live",
  },
  {
    name: "jobs_search",
    endpoint: "POST /v6/jobs",
    method: "POST",
    description: "Search or enrich job postings. Supports related_people for hiring managers.",
    creditNotes: "1 base + 1 per paid attribute + 1 per related person.",
    kimchiStatus: "live",
  },
  {
    name: "people_search",
    endpoint: "POST /v6/people",
    method: "POST",
    description: "Find people at orgs or match LinkedIn URLs. Email/phone reveal in list mode.",
    creditNotes: "Email reveal: 10 credits first time. Phone: 80 credits.",
    kimchiStatus: "live",
  },
  {
    name: "teams_search",
    endpoint: "POST /v6/teams",
    method: "POST",
    description: "Teams extracted from org job postings with tech stacks.",
    creditNotes: "1 base + attributes + related people.",
    kimchiStatus: "live",
  },
  {
    name: "intelligence_brief",
    endpoint: "GET /v6/organizations/{id}/intelligence-brief",
    method: "GET",
    description: "AI account brief — async, may return 202 while generating.",
    creditNotes: "50 credits when complete. 202 retries are free.",
    kimchiStatus: "live",
  },
  {
    name: "title_lookup",
    endpoint: "POST /v6/jobs/title-lookup",
    method: "POST",
    description: "Map raw job titles to canonical Sumble job function + level.",
    creditNotes: "1 credit per batch lookup.",
    kimchiStatus: "live",
  },
  {
    name: "technologies_lookup",
    endpoint: "POST /v6/technologies/lookup",
    method: "POST",
    description: "Resolve profile skills to canonical technology slugs (batch, 1 credit per 100 matched).",
    creditNotes: "1 credit per 100 matched technologies.",
    kimchiStatus: "live",
  },
  {
    name: "organizations_by_technology",
    endpoint: "POST /v6/organizations (filter by technology)",
    method: "POST",
    description: "Find companies using the user's resolved technology stack.",
    creditNotes: "~5 credits per company returned (attributes + entity metrics).",
    kimchiStatus: "live",
  },
  {
    name: "organizations_tech_enrich",
    endpoint: "POST /v6/organizations (match + technology entities)",
    method: "POST",
    description: "Enrich one company with which of the user's technologies it uses.",
    creditNotes: "~5 credits per technology with job/people signal.",
    kimchiStatus: "live",
  },
  {
    name: "technologies_find",
    endpoint: "POST /v6/technologies/find",
    method: "POST",
    description: "Search technology catalog by name.",
    creditNotes: "1 credit when matches found.",
    kimchiStatus: "live",
  },
  {
    name: "projects_lookup",
    endpoint: "POST /v6/projects/lookup",
    method: "POST",
    description: "Resolve project names to canonical slugs.",
    creditNotes: "Per matched project.",
    kimchiStatus: "partial",
  },
  {
    name: "organization_lists",
    endpoint: "GET/POST /v6/organization-lists",
    method: "GET/POST",
    description: "Create and manage saved org lists. Sync Kimchi watchlist.",
    creditNotes: "List: 1 cr/list. Create/add: free.",
    kimchiStatus: "live",
  },
  {
    name: "contact_lists",
    endpoint: "/v6/contact-lists",
    method: "GET/POST",
    description: "Saved people lists in Sumble.",
    creditNotes: "Similar to org lists.",
    kimchiStatus: "planned",
  },
  {
    name: "webhooks",
    endpoint: "Sumble webhooks",
    method: "POST",
    description: "Push notifications for new signals (future Kimchi integration).",
    creditNotes: "N/A",
    kimchiStatus: "planned",
  },
];
