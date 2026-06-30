import { describe, expect, it } from "vitest";
import { parseResumeDocument, plainTextToResumeSections } from "./tailored-resume-sections";

const SAMPLE = `SAN AUNG, MBA
McLean, VA | 555-123-4567 | san@example.com

PROFESSIONAL SUMMARY
Experienced marketing leader.

AREAS OF EMPHASIS
CRM: HubSpot, Salesforce

PROFESSIONAL EXPERIENCE
Acme | Jan 2020 - Present
Director of Marketing
• Led team of 10

EDUCATION & CERTIFICATIONS
MBA, UVA, 2010

CERTIFICATION
PMP, 2015`;

describe("plainTextToResumeSections", () => {
  it("splits Jobright-style resume into all sections", () => {
    const titles = plainTextToResumeSections(SAMPLE).map((s) => s.title);
    expect(titles).toContain("Professional Summary");
    expect(titles).toContain("Areas of Emphasis");
    expect(titles).toContain("Professional Experience");
    expect(titles).not.toContain("Additional");
  });

  it("handles Title Case headers", () => {
    const text = `Jane Doe\ncity | email\n\nProfessional Summary\nText.\n\nAreas of Emphasis\nCRM: SQL\n\nProfessional Experience\nCo | 2020 - Present\nRole\n\nEducation & Certifications\nBS MIT 2015`;
    expect(parseResumeDocument(text).sections.map((s) => s.title)).toEqual([
      "Personal Info", "Professional Summary", "Areas of Emphasis", "Professional Experience", "Education & Certifications",
    ]);
  });
});
