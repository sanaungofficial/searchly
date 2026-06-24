import type { HirebaseCompanyProfile } from "@/lib/hirebase";
import type { CompanyEnrichmentCache } from "@/lib/hirebase-company-sync";

export type HirebaseCompanyProfileResponse = {
  configured: boolean;
  profile: HirebaseCompanyProfile | null;
  enrichment: CompanyEnrichmentCache | null;
  error?: string;
};
