import { describe, expect, it } from "vitest";
import { formatReadbackForDisplay, readbackTextToThirdPerson } from "@/lib/readback-display";

describe("readbackTextToThirdPerson", () => {
  it("converts second person to third person using first name", () => {
    expect(
      readbackTextToThirdPerson(
        "You're a strategy leader with 8 years of experience.",
        "Britney Kalmbach",
      ),
    ).toBe("Britney is a strategy leader with 8 years of experience.");

    expect(
      readbackTextToThirdPerson(
        "Your resume emphasizes consulting wins, but lacks P&L detail.",
        "Britney Kalmbach",
      ),
    ).toBe("Britney's resume emphasizes consulting wins, but lacks P&L detail.");
  });
});

describe("formatReadbackForDisplay", () => {
  it("formats legacy cached readback payloads", () => {
    const formatted = formatReadbackForDisplay(
      {
        picture: "You're a product leader.",
        strengths: ["Strategy"],
        targetRoles: [{ role: "VP Product", fit: "Strong match" }],
        honestNote: "Your resume could use more metrics.",
      },
      "Britney Kalmbach",
    );

    expect(formatted.picture).toBe("Britney is a product leader.");
    expect(formatted.honestNote).toBe("Britney's resume could use more metrics.");
  });
});
