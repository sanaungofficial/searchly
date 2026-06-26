import type { VectorMatchedJob } from "@/lib/vector-matched-job";

/** Sample jobs for admin email preview when no live matches exist yet. */
export function sampleDigestPreviewJobs(): VectorMatchedJob[] {
  return [
    {
      title: "Business Analyst",
      companyName: "Contact Government Services, LLC",
      location: "Remote · United States",
      url: null,
      department: null,
      matchScore: 85,
      matchLabel: "Strong",
      matchReasons: [
        "You're a good fit because your background aligns with SQL, Tableau, and stakeholder reporting.",
        "This is a Mid-level role that matches your career targets.",
      ],
      matchedSkills: ["SQL", "Tableau", "Excel"],
      gapSkills: ["Power BI"],
      vectorRank: 1,
      rankTier: 2,
      isTrackedCompany: false,
    },
    {
      title: "Senior Product Analyst",
      companyName: "Stripe",
      location: "San Francisco, CA",
      url: null,
      department: null,
      matchScore: 78,
      matchLabel: "Strong",
      matchReasons: [
        "Strong keyword overlap with product analytics, experimentation, and SQL.",
        "Your experience level aligns with a senior IC analytics track.",
      ],
      matchedSkills: ["SQL", "Python", "A/B testing"],
      gapSkills: [],
      vectorRank: 2,
      rankTier: 2,
    },
    {
      title: "Data Analyst",
      companyName: "Anthropic",
      location: "Remote",
      url: null,
      department: null,
      matchScore: 72,
      matchLabel: "Good",
      matchReasons: [
        "You're a good fit because your background aligns with Python, dashboards, and cross-functional analysis.",
      ],
      matchedSkills: ["Python", "Looker"],
      gapSkills: ["dbt"],
      vectorRank: 3,
      rankTier: 3,
      isTrackedCompany: true,
    },
  ];
}
