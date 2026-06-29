import { describe, expect, it } from "vitest";
import { parseCoverLetter, coverLetterToPlainText } from "./cover-letter-format";

const SAMPLE = `June 29, 2026

Hiring Manager
Acme Corp

Dear Hiring Manager,

I led a cross-functional team that cut onboarding time by 40% while scaling support to three new regions.

At my last role I owned pipeline strategy end to end, partnering with product and sales to hit 120% of quota two years running.

I would welcome a conversation about how that experience maps to your Senior PM opening.

Sincerely,

Jane Smith`;

describe("parseCoverLetter", () => {
  it("splits a standard business letter into sections", () => {
    const s = parseCoverLetter(SAMPLE);
    expect(s.date).toBe("June 29, 2026");
    expect(s.recipientLines).toEqual(["Hiring Manager", "Acme Corp"]);
    expect(s.salutation).toBe("Dear Hiring Manager,");
    expect(s.bodyParagraphs).toHaveLength(3);
    expect(s.closing).toBe("Sincerely,");
    expect(s.signature).toBe("Jane Smith");
  });

  it("round-trips through plain text helper", () => {
    const s = parseCoverLetter(SAMPLE);
    expect(coverLetterToPlainText(s)).toBe(SAMPLE);
  });

  it("falls back to body-only when structure is missing", () => {
    const s = parseCoverLetter("One paragraph only.\n\nSecond paragraph.");
    expect(s.bodyParagraphs).toHaveLength(2);
    expect(s.salutation).toBeUndefined();
  });
});
