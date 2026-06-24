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

/* Indeed icon */
export function IndeedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" {...props}>
      <rect width="22" height="22" rx="4" fill="#2557A7" />
      <path
        d="M7.2 16V6.2h2.4V16H7.2zm6.1-9.8c1.3 0 2.3 1 2.3 2.3s-1 2.3-2.3 2.3-2.3-1-2.3-2.3 1-2.3 2.3-2.3zm-1.2 9.8V9.4h2.4V16h-2.4z"
        fill="white"
      />
    </svg>
  );
}

/* Google icon — used for Google Jobs shortcut */
export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" {...props}>
      <rect width="22" height="22" rx="4" fill="#FFFFFF" stroke="rgba(26,58,47,0.12)" />
      <path d="M17.6 11.2c0-.7-.1-1.2-.2-1.7H11v3.1h3.7c-.2 1-.7 1.6-1.5 2.1v1.7h2.4c1.4-1.3 2.2-3.2 2.2-5.2z" fill="#4285F4" />
      <path d="M11 17.5c2 0 3.7-.7 4.9-1.8l-2.4-1.9c-.7.5-1.5.7-2.5.7-1.9 0-3.6-1.3-4.2-3.1H4.4v2c1.2 2.3 3.6 3.7 6.6 3.7z" fill="#34A853" />
      <path d="M6.8 9.4c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7V3.9H4.4C3.7 5.3 3.3 6.8 3.3 8.4s.4 3.1 1.1 4.5l2.4-1.9z" fill="#FBBC05" />
      <path d="M11 4.9c1.1 0 2.1.4 2.9 1.2l2.2-2.2C14.7 2.7 13 2 11 2 7.5 2 4.5 4.3 3.3 7.6l2.4 1.9C6.4 7.6 8.1 4.9 11 4.9z" fill="#EA4335" />
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
