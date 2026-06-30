import { describe, expect, it } from "vitest";
import { groupHirebaseJobCategories } from "@/lib/job-function-groups";

describe("groupHirebaseJobCategories", () => {
  it("groups engineering and product under software", () => {
    const groups = groupHirebaseJobCategories(["Engineering Jobs", "Product Jobs", "Sales Jobs"]);
    const software = groups.find((g) => g.id === "software");
    expect(software?.categories).toEqual(expect.arrayContaining(["Engineering Jobs", "Product Jobs"]));
    const sales = groups.find((g) => g.id === "sales");
    expect(sales?.categories).toContain("Sales Jobs");
  });
});
