import {
  parseAshby,
  parseGeneric,
  parseGreenhouse,
  parseLever,
  parseLinkedInJobs,
} from "../parsers/index";
import type { ParsedJob } from "../lib/types";

/** Run all parsers in priority order; generic is always the fallback. */
export function parseCurrentPage(): ParsedJob {
  const parsers = [
    parseGreenhouse,
    parseLever,
    parseAshby,
    parseLinkedInJobs,
  ] as const;

  for (const parser of parsers) {
    const result = parser();
    if (result?.company && result?.role) return result;
  }

  return parseGeneric();
}
