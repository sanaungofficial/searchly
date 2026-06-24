export type CatalogCompany = {
  slug: string;
  name: string;
  website?: string;
  careersUrl?: string;
  type?: string;
};

export function normalizeCompanySlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Curated dream-company catalog for autosuggest (P1). */
export const COMPANY_CATALOG: CatalogCompany[] = [
  { slug: "stripe", name: "Stripe", website: "https://stripe.com", careersUrl: "https://stripe.com/jobs", type: "Fintech" },
  { slug: "google", name: "Google", website: "https://google.com", careersUrl: "https://careers.google.com/jobs", type: "Technology" },
  { slug: "meta", name: "Meta", website: "https://meta.com", careersUrl: "https://www.metacareers.com/jobs", type: "Technology" },
  { slug: "apple", name: "Apple", website: "https://apple.com", careersUrl: "https://jobs.apple.com", type: "Technology" },
  { slug: "amazon", name: "Amazon", website: "https://amazon.com", careersUrl: "https://www.amazon.jobs", type: "Technology / Retail" },
  { slug: "microsoft", name: "Microsoft", website: "https://microsoft.com", careersUrl: "https://careers.microsoft.com", type: "Technology" },
  { slug: "netflix", name: "Netflix", website: "https://netflix.com", careersUrl: "https://jobs.netflix.com", type: "Media / Technology" },
  { slug: "salesforce", name: "Salesforce", website: "https://salesforce.com", careersUrl: "https://careers.salesforce.com", type: "Enterprise Software" },
  { slug: "oracle", name: "Oracle", website: "https://oracle.com", careersUrl: "https://careers.oracle.com", type: "Enterprise Software" },
  { slug: "adobe", name: "Adobe", website: "https://adobe.com", careersUrl: "https://careers.adobe.com", type: "Software" },
  { slug: "nvidia", name: "NVIDIA", website: "https://nvidia.com", careersUrl: "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite", type: "Semiconductors" },
  { slug: "intel", name: "Intel", website: "https://intel.com", careersUrl: "https://jobs.intel.com", type: "Semiconductors" },
  { slug: "ibm", name: "IBM", website: "https://ibm.com", careersUrl: "https://www.ibm.com/careers", type: "Technology / Consulting" },
  { slug: "cisco", name: "Cisco", website: "https://cisco.com", careersUrl: "https://jobs.cisco.com", type: "Networking" },
  { slug: "palantir", name: "Palantir", website: "https://palantir.com", careersUrl: "https://www.palantir.com/careers", type: "Data / Defense Tech" },
  { slug: "databricks", name: "Databricks", website: "https://databricks.com", careersUrl: "https://www.databricks.com/company/careers", type: "Data / AI" },
  { slug: "snowflake", name: "Snowflake", website: "https://snowflake.com", careersUrl: "https://careers.snowflake.com", type: "Data / Cloud" },
  { slug: "mongodb", name: "MongoDB", website: "https://mongodb.com", careersUrl: "https://www.mongodb.com/careers", type: "Database" },
  { slug: "atlassian", name: "Atlassian", website: "https://atlassian.com", careersUrl: "https://www.atlassian.com/company/careers", type: "Software" },
  { slug: "servicenow", name: "ServiceNow", website: "https://servicenow.com", careersUrl: "https://careers.servicenow.com", type: "Enterprise Software" },
  { slug: "workday", name: "Workday", website: "https://workday.com", careersUrl: "https://www.workday.com/en-us/company/careers.html", type: "Enterprise Software" },
  { slug: "hubspot", name: "HubSpot", website: "https://hubspot.com", careersUrl: "https://www.hubspot.com/careers", type: "Marketing Software" },
  { slug: "shopify", name: "Shopify", website: "https://shopify.com", careersUrl: "https://www.shopify.com/careers", type: "E-commerce" },
  { slug: "square", name: "Block (Square)", website: "https://block.xyz", careersUrl: "https://block.xyz/careers", type: "Fintech" },
  { slug: "coinbase", name: "Coinbase", website: "https://coinbase.com", careersUrl: "https://www.coinbase.com/careers", type: "Crypto / Fintech" },
  { slug: "robinhood", name: "Robinhood", website: "https://robinhood.com", careersUrl: "https://careers.robinhood.com", type: "Fintech" },
  { slug: "plaid", name: "Plaid", website: "https://plaid.com", careersUrl: "https://plaid.com/careers", type: "Fintech" },
  { slug: "brex", name: "Brex", website: "https://brex.com", careersUrl: "https://www.brex.com/careers", type: "Fintech" },
  { slug: "figma", name: "Figma", website: "https://figma.com", careersUrl: "https://www.figma.com/careers", type: "Design Tools" },
  { slug: "notion", name: "Notion", website: "https://notion.so", careersUrl: "https://www.notion.so/careers", type: "Productivity" },
  { slug: "linear", name: "Linear", website: "https://linear.app", careersUrl: "https://linear.app/careers", type: "Developer Tools" },
  { slug: "vercel", name: "Vercel", website: "https://vercel.com", careersUrl: "https://vercel.com/careers", type: "Developer Infrastructure" },
  { slug: "github", name: "GitHub", website: "https://github.com", careersUrl: "https://github.com/careers", type: "Developer Tools" },
  { slug: "gitlab", name: "GitLab", website: "https://gitlab.com", careersUrl: "https://about.gitlab.com/jobs", type: "Developer Tools" },
  { slug: "datadog", name: "Datadog", website: "https://datadoghq.com", careersUrl: "https://careers.datadoghq.com", type: "Observability" },
  { slug: "cloudflare", name: "Cloudflare", website: "https://cloudflare.com", careersUrl: "https://www.cloudflare.com/careers", type: "Infrastructure" },
  { slug: "twilio", name: "Twilio", website: "https://twilio.com", careersUrl: "https://www.twilio.com/company/jobs", type: "Communications API" },
  { slug: "airbnb", name: "Airbnb", website: "https://airbnb.com", careersUrl: "https://careers.airbnb.com", type: "Travel / Marketplace" },
  { slug: "uber", name: "Uber", website: "https://uber.com", careersUrl: "https://www.uber.com/us/en/careers", type: "Mobility / Marketplace" },
  { slug: "lyft", name: "Lyft", website: "https://lyft.com", careersUrl: "https://www.lyft.com/careers", type: "Mobility" },
  { slug: "doordash", name: "DoorDash", website: "https://doordash.com", careersUrl: "https://careers.doordash.com", type: "Marketplace" },
  { slug: "instacart", name: "Instacart", website: "https://instacart.com", careersUrl: "https://instacart.careers", type: "Marketplace" },
  { slug: "spotify", name: "Spotify", website: "https://spotify.com", careersUrl: "https://www.lifeatspotify.com/jobs", type: "Media / Music" },
  { slug: "disney", name: "Disney", website: "https://disney.com", careersUrl: "https://jobs.disneycareers.com", type: "Media / Entertainment" },
  { slug: "comcast", name: "Comcast", website: "https://corporate.comcast.com", careersUrl: "https://jobs.comcast.com", type: "Media / Telecom" },
  { slug: "warner-bros-discovery", name: "Warner Bros. Discovery", website: "https://wbd.com", careersUrl: "https://careers.wbd.com", type: "Media" },
  { slug: "paramount", name: "Paramount", website: "https://paramount.com", careersUrl: "https://careers.paramount.com", type: "Media" },
  { slug: "nbcuniversal", name: "NBCUniversal", website: "https://nbcuniversal.com", careersUrl: "https://jobs.nbcunicareers.com", type: "Media" },
  { slug: "fox", name: "Fox Corporation", website: "https://foxcorporation.com", careersUrl: "https://www.foxcareers.com", type: "Media" },
  { slug: "deloitte", name: "Deloitte", website: "https://deloitte.com", careersUrl: "https://apply.deloitte.com", type: "Consulting" },
  { slug: "mckinsey", name: "McKinsey & Company", website: "https://mckinsey.com", careersUrl: "https://www.mckinsey.com/careers", type: "Consulting" },
  { slug: "bcg", name: "Boston Consulting Group", website: "https://bcg.com", careersUrl: "https://careers.bcg.com", type: "Consulting" },
  { slug: "bain", name: "Bain & Company", website: "https://bain.com", careersUrl: "https://www.bain.com/careers", type: "Consulting" },
  { slug: "accenture", name: "Accenture", website: "https://accenture.com", careersUrl: "https://www.accenture.com/us-en/careers", type: "Consulting / Technology" },
  { slug: "pwc", name: "PwC", website: "https://pwc.com", careersUrl: "https://www.pwc.com/gx/en/careers.html", type: "Professional Services" },
  { slug: "ey", name: "EY", website: "https://ey.com", careersUrl: "https://careers.ey.com", type: "Professional Services" },
  { slug: "kpmg", name: "KPMG", website: "https://kpmg.com", careersUrl: "https://www.kpmguscareers.com", type: "Professional Services" },
  { slug: "goldman-sachs", name: "Goldman Sachs", website: "https://goldmansachs.com", careersUrl: "https://www.goldmansachs.com/careers", type: "Investment Banking" },
  { slug: "jpmorgan", name: "JPMorgan Chase", website: "https://jpmorganchase.com", careersUrl: "https://careers.jpmorgan.com", type: "Financial Services" },
  { slug: "morgan-stanley", name: "Morgan Stanley", website: "https://morganstanley.com", careersUrl: "https://www.morganstanley.com/careers", type: "Financial Services" },
  { slug: "blackrock", name: "BlackRock", website: "https://blackrock.com", careersUrl: "https://careers.blackrock.com", type: "Asset Management" },
  { slug: "citadel", name: "Citadel", website: "https://citadel.com", careersUrl: "https://www.citadel.com/careers", type: "Hedge Fund" },
  { slug: "bridgewater", name: "Bridgewater Associates", website: "https://bridgewater.com", careersUrl: "https://www.bridgewater.com/working-at-bridgewater", type: "Asset Management" },
  { slug: "capital-one", name: "Capital One", website: "https://capitalone.com", careersUrl: "https://www.capitalonecareers.com", type: "Financial Services" },
  { slug: "american-express", name: "American Express", website: "https://americanexpress.com", careersUrl: "https://aexp.eightfold.ai/careers", type: "Financial Services" },
  { slug: "visa", name: "Visa", website: "https://visa.com", careersUrl: "https://careers.smartrecruiters.com/Visa", type: "Payments" },
  { slug: "mastercard", name: "Mastercard", website: "https://mastercard.com", careersUrl: "https://careers.mastercard.com", type: "Payments" },
  { slug: "pfizer", name: "Pfizer", website: "https://pfizer.com", careersUrl: "https://pfizer.wd1.myworkdayjobs.com/PfizerCareers", type: "Pharma" },
  { slug: "johnson-johnson", name: "Johnson & Johnson", website: "https://jnj.com", careersUrl: "https://jobs.jnj.com", type: "Healthcare" },
  { slug: "merck", name: "Merck", website: "https://merck.com", careersUrl: "https://jobs.merck.com", type: "Pharma" },
  { slug: "unitedhealth", name: "UnitedHealth Group", website: "https://unitedhealthgroup.com", careersUrl: "https://careers.unitedhealthgroup.com", type: "Healthcare" },
  { slug: "cvs-health", name: "CVS Health", website: "https://cvshealth.com", careersUrl: "https://jobs.cvshealth.com", type: "Healthcare / Retail" },
  { slug: "target", name: "Target", website: "https://target.com", careersUrl: "https://corporate.target.com/careers", type: "Retail" },
  { slug: "walmart", name: "Walmart", website: "https://walmart.com", careersUrl: "https://careers.walmart.com", type: "Retail" },
  { slug: "costco", name: "Costco", website: "https://costco.com", careersUrl: "https://www.costco.com/jobs.html", type: "Retail" },
  { slug: "nike", name: "Nike", website: "https://nike.com", careersUrl: "https://jobs.nike.com", type: "Consumer / Retail" },
  { slug: "procter-gamble", name: "Procter & Gamble", website: "https://pg.com", careersUrl: "https://www.pgcareers.com", type: "Consumer Goods" },
  { slug: "coca-cola", name: "The Coca-Cola Company", website: "https://coca-colacompany.com", careersUrl: "https://careers.coca-colacompany.com", type: "Consumer Goods" },
  { slug: "pepsico", name: "PepsiCo", website: "https://pepsico.com", careersUrl: "https://www.pepsicojobs.com", type: "Consumer Goods" },
  { slug: "general-motors", name: "General Motors", website: "https://gm.com", careersUrl: "https://search-careers.gm.com", type: "Automotive" },
  { slug: "ford", name: "Ford", website: "https://ford.com", careersUrl: "https://corporate.ford.com/careers.html", type: "Automotive" },
  { slug: "tesla", name: "Tesla", website: "https://tesla.com", careersUrl: "https://www.tesla.com/careers", type: "Automotive / Energy" },
  { slug: "boeing", name: "Boeing", website: "https://boeing.com", careersUrl: "https://jobs.boeing.com", type: "Aerospace" },
  { slug: "lockheed-martin", name: "Lockheed Martin", website: "https://lockheedmartin.com", careersUrl: "https://www.lockheedmartinjobs.com", type: "Defense / Aerospace" },
  { slug: "northrop-grumman", name: "Northrop Grumman", website: "https://northropgrumman.com", careersUrl: "https://jobs.northropgrumman.com", type: "Defense / Aerospace" },
  { slug: "aramark", name: "Aramark", website: "https://aramark.com", careersUrl: "https://careers.aramark.com", type: "Food / Facilities" },
];

/** First 50 curated catalog companies — Hirebase company-data pilot. */
export const TOP_50_CATALOG: CatalogCompany[] = COMPANY_CATALOG.slice(0, 50);

const CATALOG_BY_SLUG = new Map(COMPANY_CATALOG.map((c) => [c.slug, c]));

/** Max dream companies picked during onboarding. */
export const ONBOARDING_MAX_TARGET_COMPANIES = 5;

/** Quick-pick chips on onboarding company step. */
export const ONBOARDING_COMPANY_PICKS: CatalogCompany[] = [
  "stripe",
  "google",
  "hubspot",
  "salesforce",
  "microsoft",
  "oracle",
  "deloitte",
  "nike",
  "spotify",
  "airbnb",
  "shopify",
  "meta",
]
  .map((slug) => CATALOG_BY_SLUG.get(slug))
  .filter((c): c is CatalogCompany => !!c);

export function getCatalogCompany(slug: string): CatalogCompany | undefined {
  return CATALOG_BY_SLUG.get(slug);
}

export function searchCatalog(query: string, limit = 8): CatalogCompany[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMPANY_CATALOG.slice(0, limit);

  const scored = COMPANY_CATALOG.map((company) => {
    const name = company.name.toLowerCase();
    const slug = company.slug;
    let score = 0;
    if (name === q || slug === q) score = 100;
    else if (name.startsWith(q) || slug.startsWith(q)) score = 80;
    else if (name.includes(q) || slug.includes(q)) score = 60;
    else if (company.type?.toLowerCase().includes(q)) score = 30;
    return { company, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.company.name.localeCompare(b.company.name));

  return scored.slice(0, limit).map((item) => item.company);
}
