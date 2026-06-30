/**
 * Kimchi Opportunities filter → Hirebase API mapping reference.
 *
 * | UI filter              | VectorSearchFilters field | Hirebase param        | Notes |
 * |------------------------|---------------------------|-----------------------|-------|
 * | Job function (taxonomy)| jobCategories             | job_categories        | Hirebase category strings |
 * | Custom job function    | customJobFunctions        | vsearch query         | Merged into semantic vsearch query, not keywords |
 * | Job type               | jobTypes                  | job_types             | Full Time, Part Time, Contract, Internship |
 * | Work model             | locationTypes             | —                     | Client-side post-filter via job-listing-filters |
 * | Location country       | locations[].country       | locations             | |
 * | Location city/region   | locations[].city/region   | locations             | |
 * | Location radius        | locationRadiusMiles       | —                     | Client-side radius filter |
 * | All locations in US    | locations (country only)  | locations             | Clears city/region |
 * | Experience level       | experienceLevels          | experience            | Entry, Junior, Mid, Senior, Executive |
 * | Required experience    | yearsFrom / yearsTo       | years_from / years_to | |
 * | Date posted            | datePostedWithinDays      | date_posted           | Converted to ISO date |
 * | Industry               | industries                | industries            | |
 * | Sub-industry           | subindustries             | subindustries         | |
 * | Company                | companyName               | company_name          | |
 * | Visa / H1B             | visaSponsored             | visa_sponsored        | |
 * | Salary min             | salaryFrom                | salary_from           | |
 * | Salary max             | salaryTo                  | salary_to             | |
 * | Company size           | companySizeBuckets        | company_types         | |
 * | Job titles (search)    | jobTitles                 | job_titles            | Role search path |
 * | Keywords / skills      | keywords                  | keywords              | |
 * | Excluded title         | keywords (-prefix)        | keywords              | Stored in searchPreferences |
 *
 * Client-only (stored in searchPreferences, not sent to Hirebase):
 * - roleTypes (IC / Manager)
 * - companyStages (Early, Growth, Late, Public)
 * - excludeSecurityClearance, excludeUsCitizenOnly, excludeStaffingAgency
 * - excludedIndustries, excludedSkills, excludedCompanies (no negative filter API)
 */

export const HIREBASE_UNSUPPORTED_FILTERS = [
  "Work model (Remote / Hybrid / Onsite) — client-side post-filter only",
  "Location radius — client-side post-filter only",
  "Role type (IC / Manager) — profile preference only",
  "Company stage — profile preference only",
  "Excluded industries / skills / companies — profile preference only",
  "Exclude security clearance / US citizen only / staffing agency — profile preference only",
] as const;
