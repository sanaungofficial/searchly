import type { SVGProps } from "react";

/* Upload icon — dashed circle with up arrow */
export function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" {...props}>
      <circle cx="17" cy="17" r="16" stroke="rgba(26,58,47,0.18)" strokeWidth="1.5" />
      <path d="M17 22V14" stroke="#1A3A2F" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 17l3-3 3 3" stroke="#1A3A2F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 23h10" stroke="#1A3A2F" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/* Filled check circle — green with gold check */
export function CheckCircleFilled(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...props}>
      <circle cx="9" cy="9" r="9" fill="#1A3A2F" />
      <path
        d="M5.5 9l2.5 2.5 4.5-4.5"
        stroke="#E8D5A3"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Small check circle — for job "ready" state */
export function CheckCircleSmall(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" {...props}>
      <circle cx="7.5" cy="7.5" r="7.5" fill="rgba(26,58,47,0.1)" />
      <path
        d="M5 7.5l2 2 3.5-3.5"
        stroke="#1A3A2F"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Small check circle — gold for resume pill */
export function CheckCircleTiny(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...props}>
      <circle cx="7" cy="7" r="7" fill="#1A3A2F" />
      <path
        d="M4 7l2 2 4-4"
        stroke="#E8D5A3"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* LinkedIn icon */
export function LinkedInIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" {...props}>
      <rect width="22" height="22" rx="4" fill="#0A66C2" />
      <path
        d="M5.5 9.5h3V17h-3V9.5zm1.5-5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm4 5h2.9v1.1h.04c.4-.76 1.38-1.55 2.84-1.55C19.2 9.05 19.5 11 19.5 13.4V17h-3v-3.15c0-.75-.01-1.72-1.05-1.72-1.05 0-1.2.82-1.2 1.66V17H11V9.5z"
        fill="white"
      />
    </svg>
  );
}

/* Arrow right — used in LinkedIn & job input buttons */
export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" {...props}>
      <path
        d="M5 11h12M13 7.5l4 3.5-4 3.5"
        stroke="#1A3A2F"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Arrow right — smaller version for job input */
export function ArrowRightSmall(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...props}>
      <path
        d="M4 10h12M12 7l3 3-3 3"
        stroke="#1A3A2F"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Clock icon — for job URL input */
export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" {...props}>
      <path
        d="M8.5 2.5a6 6 0 100 12 6 6 0 000-12z"
        stroke="rgba(74,69,64,0.35)"
        strokeWidth="1.2"
      />
      <path
        d="M8.5 5.5v3l2 2"
        stroke="rgba(74,69,64,0.35)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
