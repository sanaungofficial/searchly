/** Marketing site (landing) vs app subdomain routing. */

export function normalizeHost(host: string): string {
  return host.replace(/^www\./, "").split(":")[0]?.toLowerCase() ?? "";
}

/** App lives here today; passcode + auth redirect behavior applies. */
export function isAppHost(host: string): boolean {
  const h = normalizeHost(host);
  return h === "app.kimchi.so";
}

/** Public marketing site — kimchi.so apex (and local dev). */
export function isMarketingHost(host: string): boolean {
  const h = normalizeHost(host);
  if (h === "kimchi.so") return true;
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h.endsWith(".vercel.app")) return true;
  return false;
}
