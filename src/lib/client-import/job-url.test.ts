import { describe, expect, it } from "vitest";
import { importJobDedupeKey, normalizeImportJobUrl } from "./job-url";

describe("normalizeImportJobUrl", () => {
  it("strips LinkedIn tracking params and keeps job id", () => {
    const a = normalizeImportJobUrl(
      "https://www.linkedin.com/jobs/view/4416964266/?trackingId=abc&ref=share",
    );
    const b = normalizeImportJobUrl("https://www.linkedin.com/jobs/view/4416964266/");
    expect(a).toBe("linkedin:job:4416964266");
    expect(b).toBe("linkedin:job:4416964266");
  });

  it("falls back to company+role when no url", () => {
    expect(importJobDedupeKey({ url: null, company: "Stripe", role: "Engineer" })).toBe(
      "stripe::engineer",
    );
  });
});
