/**
 * Kimchi Opportunities filter → Hirebase API mapping (P0).
 *
 * | UI filter              | VectorSearchFilters field | Hirebase param           | Enforcement |
 * |------------------------|---------------------------|--------------------------|-------------|
 * | Job function (taxonomy)| jobCategories             | job_category / job_categories | API (neural lexical / search) |
 * | Custom job function    | customJobFunctions        | vector.query             | Semantic query only |
 * | Job type               | jobTypes                  | job_types                | API |
 * | Work model             | locationTypes             | location_types           | API (neural/search); client backup |
 * | Location country       | locations[].country       | geo_locations / locations | API + client backup |
 * | Location city/region   | locations[].city/region   | geo_locations / locations | API + client backup |
 * | Location radius        | locationRadiusMiles       | geofilter_params (search) | Client post-filter |
 * | All locations in US    | locations (country only)  | geo_locations            | API |
 * | Experience level       | experienceLevels          | experience               | API |
 * | Required experience    | yearsFrom / yearsTo       | yoe / years_from         | API |
 * | Date posted            | datePostedWithinDays      | days_ago / date_posted   | API |
 * | Industry (flat list)   | industries / subindustries| industry / sub_industry  | API + client backup |
 * | Company                | companyName               | company_name             | API |
 * | Visa / H1B             | visaSponsored             | visa / visa_sponsored    | API |
 * | Salary min             | salaryFrom                | salary.min / salary_from | API |
 * | Company stage          | companyTypes              | company_types            | API (Startup, Public Company, …) |
 * | Skills                 | keywords                  | keywords                 | API |
 * | Excluded title         | (searchPreferences)       | —                        | Client post-filter |
 * | Excluded industry      | (searchPreferences)       | —                        | Client post-filter |
 * | Excluded skill         | (searchPreferences)       | —                        | Client post-filter |
 * | Excluded company       | (searchPreferences)       | —                        | Client post-filter |
 * | Role type (IC/Manager) | (searchPreferences)       | —                        | Profile-only (future) |
 * | Exclude clearance/US/staffing | (searchPreferences) | hide_recruiting_agencies (partial) | Client post-filter |
 *
 * Search endpoints:
 * - Resume + filters: POST /v2/jobs/neural-search (vector.artifact_id + lexical) — primary
 * - Profile summary: POST /v2/jobs/neural-search (vector.query + lexical) or vsearch summary fallback
 * - Similar jobs: POST /v2/jobs/vsearch (search_type=job) — no lexical narrowing
 * - Role/title search: POST /v2/jobs/search
 * - Broad fallback: POST /v2/jobs/search (recent) or vsearch summary
 *
 * Fallback ladder (guarantee ≥15 roles): see opportunities-fallback-ladder.ts — relax one dimension
 * at a time (radius → work model → location → date → salary → YoE → experience → industry → …),
 * then broad recent search; user notice when relaxed or max available < 15.
 */

export const HIREBASE_UNSUPPORTED_FILTERS = [
  "Location radius — client-side post-filter only (geofilter on structured search only)",
  "Role type (IC / Manager) — profile preference only",
  "Excluded title / industry / skill / company — client post-filter only",
  "Exclude security clearance / US citizen only — client post-filter only",
] as const;

export const COMPANY_STAGE_TO_HIREBASE_TYPE: Record<string, string> = {
  Early: "Startup",
  Growth: "Privately Held",
  Late: "Privately Held",
  Public: "Public Company",
};
