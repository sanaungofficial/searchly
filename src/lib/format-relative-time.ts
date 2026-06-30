/** Human-readable relative time, e.g. "2 hours ago", "3 days ago". */
export function formatRelativeTimeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return null;
    const diffMs = Date.now() - then;
    if (diffMs < 0) return "just now";

    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;

    const days = Math.floor(hours / 24);
    if (days === 0) return "today";
    if (days === 1) return "1 day ago";
    if (days < 30) return `${days} days ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`;

    const years = Math.floor(days / 365);
    return years === 1 ? "1 year ago" : `${years} years ago`;
  } catch {
    return null;
  }
}
