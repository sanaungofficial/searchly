/** Strip internal-only phrasing from titles before clients see them. */
export function sanitizeNetworkJobTitleForClient(title: string): string {
  let t = title.trim();
  if (!t) return "Untitled role";

  // Trailing internal metadata (fee, guarantee, "internal view", etc.)
  t = t.replace(
    /\s*[-–—|]\s*(?:internal\s*)?(?:view\s*)?(?:fee[s]?|guarantee|placement)[\s\S]*$/i,
    "",
  );
  t = t.replace(/\s*\([^)]*(?:fee|guarantee|internal\s*view|placement)[^)]*\)/gi, " ");
  t = t.replace(/\s{2,}/g, " ").trim();

  return t || "Untitled role";
}

const CLIENT_DESCRIPTION_DROP =
  /(?:placement\s+fee|flat\s+fee|\d+\s*%\s*(?:of\s+first[- ]year\s+)?(?:comp|fee)|guarantee\s+period|guarantee:\s*\d|\$[\d,]+\s*flat|top\s+echelon|execthread|big\s+biller)/i;

/** Remove recruiter-only lines from descriptions shown to clients. */
export function sanitizeNetworkJobDescriptionForClient(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;

  const paragraphs = text.split(/\n{2,}/);
  const kept = paragraphs
    .map((p) => p.trim())
    .filter((p) => p && !CLIENT_DESCRIPTION_DROP.test(p));

  const joined = kept.join("\n\n").trim();
  return joined || null;
}

/** Replace partner-specific compensation hints with neutral copy. */
export function sanitizeNetworkJobSalaryForClient(salary: string | null | undefined): string | null {
  if (!salary?.trim()) return null;
  if (/execthread|top\s+echelon|big\s+biller/i.test(salary)) {
    return "Compensation discussed with recruiter";
  }
  return salary.trim();
}
