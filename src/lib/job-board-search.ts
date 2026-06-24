export type JobBoardId = "linkedin" | "indeed" | "google";

export interface JobBoardLink {
  id: JobBoardId;
  label: string;
  url: string;
}

/** Pre-filled job search URLs for a target role title. */
export function buildJobBoardLinks(role: string): JobBoardLink[] {
  const q = role.trim();
  if (!q) return [];

  const encoded = encodeURIComponent(q);
  return [
    {
      id: "linkedin",
      label: "LinkedIn",
      url: `https://www.linkedin.com/jobs/search/?keywords=${encoded}`,
    },
    {
      id: "indeed",
      label: "Indeed",
      url: `https://www.indeed.com/jobs?q=${encoded}`,
    },
    {
      id: "google",
      label: "Google Jobs",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${q} jobs`)}&ibp=htl;jobs`,
    },
  ];
}
