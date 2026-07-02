import { describe, expect, it } from "vitest";
import { classifyCompanyMatch, formatConnectionOwnerLabel } from "@/lib/org-network-match";

describe("classifyCompanyMatch", () => {
  const appleTarget = { name: "Apple", website: "https://www.apple.com", key: "apple" };
  const appleIncTarget = { name: "Apple Inc.", website: null, key: "appleinc" };

  it("matches email domain to target website", () => {
    expect(
      classifyCompanyMatch({ email: "tim.cook@apple.com", company: "Apple" }, appleTarget),
    ).toBe("domain");
  });

  it("matches inferred company from email domain to target name", () => {
    expect(
      classifyCompanyMatch({ email: "tim.cook@apple.com", company: null }, appleIncTarget),
    ).toBe("domain");
  });

  it("matches exact company label", () => {
    expect(
      classifyCompanyMatch({ email: "person@gmail.com", company: "Apple" }, appleTarget),
    ).toBe("exact");
  });

  it("returns null for unrelated contacts", () => {
    expect(
      classifyCompanyMatch({ email: "person@gmail.com", company: "Google" }, appleTarget),
    ).toBeNull();
  });
});

describe("formatConnectionOwnerLabel", () => {
  it("labels viewer as You with email", () => {
    expect(
      formatConnectionOwnerLabel({
        userId: "u1",
        name: "Sam Test",
        email: "sam@test.com",
        memberFullName: "Sam Test",
        memberEmail: "sam@test.com",
        orgName: "Acme",
        isViewer: true,
      }),
    ).toBe("You · sam@test.com");
  });

  it("uses full name for other members", () => {
    expect(
      formatConnectionOwnerLabel({
        userId: "u2",
        name: "San Example",
        email: "san@example.com",
        memberFullName: "San Example",
        memberEmail: "san@example.com",
        orgName: "Acme",
        isViewer: false,
      }),
    ).toBe("San Example · san@example.com");
  });
});
