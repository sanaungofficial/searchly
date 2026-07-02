/**
 * Workspace stacking order (low → high):
 * backdrop (220) → top nav (225) → drawer panel (230) → nested backdrop/drawer (235/236).
 * Nav must stay above backdrops so link clicks are never swallowed by transparent overlays.
 *
 * Drawer rule: panels start at `useWorkspaceStackTop()` (or --workspace-stack-top), never top: 0.
 * Backdrops should use `backdropBelowNav(topPx)` or ScoutDrawerBackdrop (defaults to --workspace-stack-top).
 */
export const DRAWER_BACKDROP_Z = 220;
export const TOP_NAV_Z = 225;
export const DRAWER_Z = 230;
/** Nested tool drawer above parent drawer (resume match, cover letter from job drawer). */
export const DRAWER_NESTED_BACKDROP_Z = 235;
export const DRAWER_NESTED_Z = 236;

/** Fixed backdrop that leaves the top nav strip clickable. */
export function backdropBelowNav(topPx: number) {
  return {
    position: "fixed" as const,
    top: topPx,
    left: 0,
    right: 0,
    bottom: 0,
  };
}
