import type { ParsedResumeData, ResumeSectionId } from "@/lib/resume-parse";

/** Non-AI draft when a section is empty or AI is unavailable. */
export function fallbackSectionSuggestion(
  sectionId: ResumeSectionId,
  parsed: ParsedResumeData,
  targetRoles: string,
): string {
  const name = parsed.name?.trim() || "Professional";
  const roleHint = targetRoles !== "your target roles" ? targetRoles : "your next role";
  const topSkills = [
    ...parsed.skills,
    ...parsed.skillGroups.flatMap((g) => g.skills),
    ...parsed.tools,
  ]
    .filter(Boolean)
    .slice(0, 4);
  const skillHint = topSkills.length ? topSkills.join(", ") : "relevant technical and leadership skills";
  const latest = parsed.workExperience[0];
  const latestRole = latest?.title?.trim() || "experienced professional";
  const latestCo = latest?.company?.trim();

  switch (sectionId) {
    case "summary":
      return [
        `${name} is a ${latestRole}${latestCo ? ` with experience at ${latestCo}` : ""} targeting ${roleHint}.`,
        `Brings ${skillHint} and a track record of delivering measurable results in cross-functional environments.`,
        `Seeking to apply this background in a high-impact ${roleHint.split(",")[0]?.trim() || "role"}.`,
      ].join(" ");
    case "skills":
      return topSkills.length
        ? topSkills.join(", ")
        : "Leadership, Stakeholder Management, Strategy, Communication, Data Analysis";
    case "experience":
      if (latest) {
        return [
          `• Led key initiatives as ${latest.title}${latestCo ? ` at ${latestCo}` : ""}, improving team outcomes and delivery quality`,
          "• Partnered with cross-functional stakeholders to define priorities and execute against measurable goals",
          "• Drove process improvements that increased efficiency and visibility for leadership",
        ].join("\n");
      }
      return "• Describe a measurable accomplishment from your most recent role\n• Highlight scope, tools, and business impact\n• Quantify results where possible (%, $, time saved)";
    case "education":
      return parsed.education[0]?.degree?.trim() || "Degree, Institution, Year";
    case "certifications":
      return parsed.certifications.map((c) => c.name).filter(Boolean).join(", ") || "Certification Name, Issuing Organization";
    default:
      return "";
  }
}
