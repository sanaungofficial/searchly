import { describe, expect, it } from "vitest";
import {
  buildSuggestDropdownRows,
  hasExactSuggestionMatch,
  normalizeCustomLabel,
} from "./suggest-input";

describe("normalizeCustomLabel", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeCustomLabel("  supply chain   engineer  ")).toBe("supply chain engineer");
  });

  it("rejects too-short or too-long labels", () => {
    expect(normalizeCustomLabel("a")).toBeNull();
    expect(normalizeCustomLabel("x".repeat(81))).toBeNull();
  });
});

describe("hasExactSuggestionMatch", () => {
  it("matches case-insensitively", () => {
    expect(hasExactSuggestionMatch("Software Engineer", ["software engineer"])).toBe(true);
    expect(hasExactSuggestionMatch("Software Engineer", ["Engineering Manager"])).toBe(false);
  });
});

describe("buildSuggestDropdownRows", () => {
  it("prepends create row when query is not an exact match", () => {
    const rows = buildSuggestDropdownRows("supply chain senior engineer for life", [
      "Engineering Manager",
      "Senior Account Executive",
    ]);

    expect(rows[0]).toEqual({
      kind: "create",
      value: "supply chain senior engineer for life",
      label: 'Create "supply chain senior engineer for life"',
    });
    expect(rows.slice(1).map((r) => r.value)).toEqual([
      "Engineering Manager",
      "Senior Account Executive",
    ]);
  });

  it("omits create row on exact match", () => {
    const rows = buildSuggestDropdownRows("Engineering Manager", ["Engineering Manager"]);
    expect(rows).toEqual([{ kind: "option", value: "Engineering Manager" }]);
  });
});
