export function normalizeOrgContactEmail(email: string | null | undefined): string | null {
  return email?.trim().toLowerCase() ?? null;
}

export function companyFromEmailDomain(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  const personal = new Set([
    "gmail.com",
    "googlemail.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "yahoo.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "proton.me",
    "protonmail.com",
    "aol.com",
  ]);
  if (personal.has(domain)) return null;
  const base = domain.split(".")[0] ?? domain;
  return base.charAt(0).toUpperCase() + base.slice(1);
}
