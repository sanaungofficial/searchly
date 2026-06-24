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
  const onLinkedInJobs =
    /linkedin\.com/i.test(window.location.hostname) &&
    /\/jobs\//i.test(window.location.href);

  if (onLinkedInJobs) {
    const linkedIn = parseLinkedInJobs();
    if (linkedIn && isUsableJob(linkedIn)) return linkedIn;
    if (linkedIn) return linkedIn;
  }

  for (const parser of [parseGreenhouse, parseLever, parseAshby, parseLinkedInJobs] as const) {
    const result = parser();
    if (isUsableJob(result)) return result;
  }
  return parseGeneric();
}

export function parseCurrentPage(): ParsedJob {
  return runParsers();
}

export async function parseCurrentPageAsync(): Promise<ParsedJob> {
  if (/linkedin\.com/i.test(window.location.hostname)) {
    await prepareLinkedInPage();
  }
  return runParsers();
}
