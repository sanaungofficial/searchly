/** DB enum values for in-network job feeds. */
export type NetworkJobSourceCode = "TOPECHELON" | "EXECTHREAD";

/** Public channel codes shown on listings and in filters (TE / ET). */
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
  "Roles recruiters are actively trying to fill — shared with Kimchi before they hit public job boards. Our network includes 1,000+ recruiting firms; we rank listings against your profile so the strongest fits rise to the top.";

export const NETWORK_JOB_CHANNEL_FILTER_OPTIONS = ["TE", "ET"] as const;

/** Admin-only link label to the partner listing. */
export function networkSourceListingLinkLabel(source: NetworkJobSourceCode): string {
  return `${networkSourceChannelCode(source)} listing ↗`;
}
