/** CSS vars on :root — see globals.css (--workspace-top-offset, --workspace-nav-height, --workspace-stack-top). */

export const WORKSPACE_LAYOUT_SYNC_EVENT = "workspace-layout-sync";

/** Banner stack height only (impersonation / admin review). */
export function syncWorkspaceBannerOffset(bannerHeightPx: number) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--workspace-top-offset", `${bannerHeightPx}px`);
  const navH = parseInt(getComputedStyle(root).getPropertyValue("--workspace-nav-height") || "64", 10);
  root.style.setProperty("--workspace-stack-top", `${bannerHeightPx + navH}px`);
  window.dispatchEvent(new Event(WORKSPACE_LAYOUT_SYNC_EVENT));
}

/** Nav bar height — also updates stack top (banner + nav). */
export function syncWorkspaceNavHeight(navHeightPx: number) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--workspace-nav-height", `${navHeightPx}px`);
  const bannerOffset = parseInt(getComputedStyle(root).getPropertyValue("--workspace-top-offset") || "0", 10);
  root.style.setProperty("--workspace-stack-top", `${bannerOffset + navHeightPx}px`);
  window.dispatchEvent(new Event(WORKSPACE_LAYOUT_SYNC_EVENT));
}

export function readWorkspaceStackTopPx(fallbackNavPx: number): number {
  if (typeof document === "undefined") return fallbackNavPx;
  const parsed = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue("--workspace-stack-top"),
    10,
  );
  return Number.isNaN(parsed) || parsed <= 0 ? fallbackNavPx : parsed;
}
