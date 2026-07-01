import { describe, expect, it } from "vitest";
import {
  mergePipelineTagsIntoNotes,
  mergeTagLibraries,
  normalizePipelineTags,
  parsePipelineTagsFromNotes,
  summarizePipelineTags,
} from "./pipeline-tags";

describe("pipeline tags", () => {
  it("normalizes and dedupes tags case-insensitively", () => {
    expect(normalizePipelineTags([" Remote ", "remote", "Priority"])).toEqual(["Remote", "Priority"]);
  });

  it("merges tags into notes JSON without dropping existing meta", () => {
    const notes = JSON.stringify({ company: "Acme", location: "NYC" });
    const merged = mergePipelineTagsIntoNotes(notes, ["Warm intro", "Priority"]);
    const parsed = JSON.parse(merged) as { location?: string; pipelineTags?: string[] };
    expect(parsed.location).toBe("NYC");
    expect(parsed.pipelineTags).toEqual(["Warm intro", "Priority"]);
  });

  it("parses pipeline tags from notes", () => {
    const notes = JSON.stringify({ pipelineTags: ["Referral", "referral"] });
    expect(parsePipelineTagsFromNotes(notes)).toEqual(["Referral"]);
  });

  it("summarizes library and job usage", () => {
    const summary = summarizePipelineTags(
      [{ label: "Dream company", color: "purple", variant: "light" }],
      [["Dream company", "Referral"], ["Referral"]],
    );
    expect(summary).toEqual([
      {
        label: "Dream company",
        color: "purple",
        variant: "light",
        jobCount: 1,
        inLibrary: true,
      },
      {
        label: "Referral",
        color: "purple",
        variant: "light",
        jobCount: 2,
        inLibrary: false,
      },
    ]);
  });

  it("merges tag libraries with stable sort", () => {
    expect(
      mergeTagLibraries(
        [{ label: "Zeta", color: "purple", variant: "light" }],
        [["Alpha"], ["Beta", "alpha"]],
      ),
    ).toEqual([
      { label: "Alpha", color: "purple", variant: "light" },
      { label: "Beta", color: "purple", variant: "light" },
      { label: "Zeta", color: "purple", variant: "light" },
    ]);
  });
});
