import {
  parseAshby,
  parseGeneric,
  parseGreenhouse,
  parseLever,
} from "../parsers/index";
import { parseLinkedInJobs, prepareLinkedInPage } from "../parsers/linkedin-jobs";
import type { ParsedJob } from "../lib/types";

function isUsableJob(result: ParsedJob | null): result is ParsedJob {
  if (!result?.company || !result?.role) return false;
  return !(result.company === "Unknown Company" && result.role === "Unknown Role");
}

function runParsers(): ParsedJob {
  const parsers = [
    parseGreenhouse,
    parseLever,
    parseAshby,
    parseLinkedInJobs,
  ] as const;

  for (const parser of parsers) {
    const result = parser();
    if (isUsableJob(result)) return result;
  }

  return parseGeneric();
}

/** Run all parsers in priority order; generic is always the fallback. */
export function parseCurrentPage(): ParsedJob {
  return runParsers();
}

/** Async parse — expands LinkedIn "Show more" and waits for lazy-loaded description. */
export async function parseCurrentPageAsync(): Promise<ParsedJob> {
  if (/linkedin\.com/i.test(window.location.hostname)) {
    await prepareLinkedInPage();
  }
  return runParsers();
}
