/** DB enum values for in-network job feeds. */
export type NetworkJobSourceCode = "TOPECHELON" | "EXECTHREAD";

/** Short internal channel codes — visible to Kimchi staff only (admin/coach). */
export function networkSourceChannelCode(source: NetworkJobSourceCode): string {
  switch (source) {
    case "TOPECHELON":
      return "TE";
    case "EXECTHREAD":
      return "ET";
  }
}

/** Full partner name for admin detail blocks and sync panels. */
export function networkSourceAdminName(source: NetworkJobSourceCode): string {
  switch (source) {
    case "TOPECHELON":
      return "Top Echelon";
    case "EXECTHREAD":
      return "ExecThread";
  }
}

/** Client-safe badge — never names a partner network. */
export const NETWORK_JOB_CLIENT_BADGE = "Recruiter network";

/** Client-facing section blurb for In-Network Roles. */
export const NETWORK_JOB_CLIENT_INTRO =
  "Roles shared exclusively through Kimchi's recruiter network — not on public job boards. Same profile-based scoring as Open Roles.";

/** Admin-only link label to the partner listing. */
export function networkSourceListingLinkLabel(source: NetworkJobSourceCode): string {
  return `${networkSourceChannelCode(source)} listing ↗`;
}
