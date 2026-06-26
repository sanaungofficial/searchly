import type { SVGProps } from "react";

/* All workspace icons share a 15×15 viewBox to match the sidebar */

/* Opportunities — target / bullseye */
export function OpportunitiesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" {...props}>
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7.5" cy="7.5" r="2" fill="currentColor" />
    </svg>
  );
}

/* Inbox — envelope */
export function InboxIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" {...props}>
      <rect x="1.5" y="3.5" width="12" height="8.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 4.5L7.5 8.5L13.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/* Profile — person */
export function ProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" {...props}>
      <circle cx="7.5" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 13.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/* Live — play circle */
export function LiveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" {...props}>
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <polygon points="6,5 11,7.5 6,10" fill="currentColor" />
    </svg>
  );
}

/* Coaching — speech bubble */
export function CoachingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" {...props}>
      <path
        d="M2 4.5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H8l-3 2.5V10.5H4a2 2 0 01-2-2v-4z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Network — connected dots */
export function NetworkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" {...props}>
      <circle cx="7.5" cy="7.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="2.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="2.5" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12.5" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M4 4l2.5 3M11 4l-2.5 3M4 11l2.5-3M11 11l-2.5-3"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}

/* Bell — notifications */
export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props}>
      <path
        d="M8 2a5 5 0 00-5 5v2.5L2 11h12l-1-1.5V7a5 5 0 00-5-5zM6.5 13a1.5 1.5 0 003 0"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Arrow left — back to onboarding */
export function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" {...props}>
      <path
        d="M9.5 6H2.5M5 3L2.5 6 5 9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Upload — CSV upload button */
export function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" {...props}>
      <path d="M5 7V1.5M5 1.5L2.5 4M5 1.5L7.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 7v1.5a1 1 0 001 1h5a1 1 0 001-1V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/* Plus — add */
export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" {...props}>
      <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/* Refresh — signals */
export function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" {...props}>
      <path
        d="M9 5.5a3.5 3.5 0 11-1-2.5M9 1v2.5H6.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Dashboard — 2×2 grid */
export function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" {...props}>
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="8.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/* Eye — data sources / transparency */
export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" {...props}>
      <path
        d="M1.5 7.5C2.8 4.6 5.2 2.5 7.5 2.5s4.7 2.1 6 5c-1.3 2.9-3.7 5-6 5s-4.7-2.1-6-5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="7.5" r="1.8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/* Sparkle — Searchly signature */
export function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" {...props}>
      <path
        d="M5 0.5l1.2 3.3L9.5 5 6.2 6.2 5 9.5 3.8 6.2 0.5 5l3.3-1.2L5 0.5z"
        fill="currentColor"
      />
    </svg>
  );
}
