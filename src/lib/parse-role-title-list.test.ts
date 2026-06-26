import { describe, expect, it } from "vitest";
import { mergeRoleTitleLists, parseRoleTitleList } from "./parse-role-title-list";

describe("parseRoleTitleList", () => {
  it("splits newline-separated roles", () => {
    expect(parseRoleTitleList("Account Executive\nProduct Manager\nSales Lead")).toEqual([
      "Account Executive",
      "Product Manager",
      "Sales Lead",
    ]);
  });

  it("preserves commas inside a single title on one line", () => {
    expect(parseRoleTitleList("Director, Product Management")).toEqual(["Director, Product Management"]);
    expect(parseRoleTitleList("Principal I, Product Management")).toEqual(["Principal I, Product Management"]);
  });

  it("splits comma-separated lists when segments are standalone titles", () => {
    expect(parseRoleTitleList("Account Executive, Product Manager, Sales Lead")).toEqual([
      "Account Executive",
      "Product Manager",
      "Sales Lead",
    ]);
  });

  it("splits semicolon-separated lists", () => {
    expect(parseRoleTitleList("Account Executive; Product Manager")).toEqual([
      "Account Executive",
      "Product Manager",
    ]);
  });

  it("strips bullet and numbered prefixes", () => {
    expect(
      parseRoleTitleList("- Account Executive\n• Product Manager\n2. Sales Lead"),
    ).toEqual(["Account Executive", "Product Manager", "Sales Lead"]);
  });

  it("dedupes case-insensitively", () => {
    expect(parseRoleTitleList("account executive\nAccount Executive")).toEqual(["account executive"]);
  });
});

describe("mergeRoleTitleLists", () => {
  it("appends only new titles", () => {
    const { merged, added } = mergeRoleTitleLists(["Product Manager"], ["Account Executive", "product manager"]);
    expect(merged).toEqual(["Product Manager", "Account Executive"]);
    expect(added).toEqual(["Account Executive"]);
  });
});
