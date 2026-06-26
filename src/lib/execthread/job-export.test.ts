import { describe, expect, it } from "vitest";
import { mergeExecThreadJobExport } from "./job-export";
import type { ExecThreadListingRaw } from "./types";

describe("mergeExecThreadJobExport", () => {
  it("keeps the longest jobDescription when a later layer is shorter", () => {
    const longText = "A".repeat(500);
    const shortText = "Brief teaser summary.";

    const searchRow = { _id: "abc123", title: "VP Strategy", summary: shortText } as ExecThreadListingRaw;
    const publicPreview = {
      _id: "abc123",
      title: "VP Strategy",
      jobDescription: longText,
    } as ExecThreadListingRaw;
    const memberListing = {
      _id: "abc123",
      title: "VP Strategy",
      jobDescription: shortText,
    } as ExecThreadListingRaw;

    const merged = mergeExecThreadJobExport({
      searchRow,
      publicPreview,
      listingDetail: null,
      memberJob: { listing: memberListing, listingPreview: memberListing },
      redeem: null,
    });

    expect(merged.jobDescription).toBe(longText);
    expect(merged.summary).toBe(shortText);
  });
});
