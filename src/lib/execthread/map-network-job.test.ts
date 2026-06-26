import { describe, expect, it } from "vitest";
import { mapExecThreadNetworkJob } from "./map-network-job";
import { mapExecThreadListingContacts } from "./map-network-recruiter";
import type { ExecThreadListingRaw } from "./types";

describe("mapExecThreadNetworkJob", () => {
  it("uses named company even when confidential flag is set", () => {
    const job = {
      _id: "6a3c8f549e87a77a29d52924",
      title: "Vice President, U.S. Government Affairs",
      confidential: true,
      company: { name: "Intel Corporation", industry: "Semiconductors" },
    } as ExecThreadListingRaw;

    const mapped = mapExecThreadNetworkJob(job);
    expect(mapped.companyName).toBe("Intel Corporation");
  });

  it("parses string compensation from redeem payload", () => {
    const job = {
      _id: "abc",
      title: "VP",
      compensation: "USD $999-$999,999 (salary) per year",
    } as ExecThreadListingRaw;

    const mapped = mapExecThreadNetworkJob(job);
    expect(mapped._display.salaryLabel).toBe("USD $999-$999,999 (salary) per year");
  });

  it("maps apply URL and ET company branding fields", () => {
    const job = {
      _id: "abc",
      title: "VP",
      listingLinkUrl: {
        url: "https://intel.wd1.myworkdayjobs.com/example",
        hasApply: true,
      },
      company: {
        name: "Intel Corporation",
        logoUrl: "https://example.com/intel.jpg",
        url: "https://www.intel.com",
        description: "Thriving semiconductor chip maker specializing in optimized computing solutions",
      },
    } as ExecThreadListingRaw;

    const mapped = mapExecThreadNetworkJob(job);
    expect(mapped.applyUrl).toBe("https://intel.wd1.myworkdayjobs.com/example");
    expect(mapped.sourceUrl).toBe("https://intel.wd1.myworkdayjobs.com/example");
    expect(mapped._display.companyLogoUrl).toBe("https://example.com/intel.jpg");
    expect(mapped._display.companyWebsiteUrl).toBe("https://www.intel.com");
    expect(mapped._display.companySummary).toContain("semiconductor chip maker");
  });
});

describe("mapExecThreadListingContacts", () => {
  it("collects hiring manager from singular field and redeem bundle", () => {
    const job = {
      _id: "abc",
      hiringManager: {
        name: "Robin Colwell",
        title: "Senior Vice President of Global Government Affairs",
        linkedInUrl: "https://www.linkedin.com/in/example",
      },
      _kimchiExport: {
        redeem: {
          hiringManagers: [
            {
              name: "Robin Colwell",
              title: "Senior Vice President of Global Government Affairs",
              linkedinUrl: "https://www.linkedin.com/in/example",
            },
          ],
        },
      },
    } as ExecThreadListingRaw;

    const contacts = mapExecThreadListingContacts(job);
    expect(contacts.some((c) => c.name === "Robin Colwell")).toBe(true);
    expect(contacts[0]?.linkedInUrl).toBe("https://www.linkedin.com/in/example");
  });
});
