import { describe, expect, it } from "vitest";
import type { KanbanCard } from "@/components/scout/workspace-data";
import {
  filterOutPipelineJobs,
  pipelineCardDedupeKey,
  pipelineJobDedupeKeys,
  vectorMatchedJobDedupeKey,
} from "./pipeline-job-dedupe";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";
import { splitRecommendedDisplayAndReserve } from "./recommended-jobs-ranking";

function sampleJob(overrides: Partial<VectorMatchedJob> = {}): VectorMatchedJob {
  return {
    title: "Software Engineer",
    companyName: "Acme Corp",
    url: "https://jobs.example.com/acme/se",
    matchScore: 80,
    matchLabel: "Strong",
    matchReasons: [],
    matchedSkills: [],
    gapSkills: [],
    vectorRank: 1,
    ...overrides,
  };
}

describe("pipeline-job-dedupe", () => {
  it("matches pipeline cards and recommended jobs with the same dedupe key", () => {
    const card = {
      id: 1,
      company: "Acme Corp",
      role: "Software Engineer",
      stage: "saved",
      fit: 80,
      jobRef: null,
      days: 0,
      initials: "AC",
      _url: "https://jobs.example.com/acme/se/",
    } as KanbanCard & { _url?: string };

    const job = sampleJob();
    expect(pipelineCardDedupeKey(card)).toBe(vectorMatchedJobDedupeKey(job));
    expect(pipelineJobDedupeKeys([card]).has(vectorMatchedJobDedupeKey(job))).toBe(true);
  });

  it("filters saved pipeline jobs out of recommended lists", () => {
    const savedKey = vectorMatchedJobDedupeKey(sampleJob());
    const jobs = [
      sampleJob(),
      sampleJob({ title: "Product Manager", companyName: "Beta Inc", url: "https://jobs.example.com/beta/pm" }),
    ];
    const filtered = filterOutPipelineJobs(jobs, new Set([savedKey]));
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toBe("Product Manager");
  });
});

describe("splitRecommendedDisplayAndReserve", () => {
  it("backfills from reserve when a saved job is excluded", () => {
    const jobs = [
      sampleJob({ matchScore: 90 }),
      sampleJob({ title: "Staff Engineer", url: "https://jobs.example.com/acme/staff", matchScore: 85 }),
      sampleJob({ title: "Backend Engineer", companyName: "Beta Inc", url: "https://jobs.example.com/beta/be", matchScore: 80 }),
      sampleJob({ title: "Frontend Engineer", companyName: "Gamma LLC", url: "https://jobs.example.com/gamma/fe", matchScore: 75 }),
    ];
    const savedKey = vectorMatchedJobDedupeKey(jobs[0]!);
    const split = splitRecommendedDisplayAndReserve(jobs, new Set([savedKey]), {
      displayCount: 2,
      reserveCount: 2,
    });
    expect(split.jobs).toHaveLength(2);
    expect(split.jobs.some((job) => vectorMatchedJobDedupeKey(job) === savedKey)).toBe(false);
    expect(split.reserveJobs.length).toBeGreaterThan(0);
    const visiblePool = [...split.jobs, ...split.reserveJobs];
    expect(visiblePool.some((job) => vectorMatchedJobDedupeKey(job) === savedKey)).toBe(false);
  });
});
