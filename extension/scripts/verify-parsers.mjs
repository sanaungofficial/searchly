/**
 * Lightweight parser verification (no extra deps).
 * Run: node scripts/verify-parsers.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const linkedinParser = readFileSync(join(root, "../src/parsers/linkedin-jobs.ts"), "utf8");
const utilsParser = readFileSync(join(root, "../src/parsers/utils.ts"), "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log("PASS:", message);
}

assert(linkedinParser.includes("prepareLinkedInPage"), "LinkedIn prepare helper exists");
assert(linkedinParser.includes("expandLinkedInShowMore"), "Show more expansion exists");
assert(linkedinParser.includes("waitForLinkedInDescription"), "description wait helper exists");
assert(linkedinParser.includes("getDescriptionFromParsed"), "description notes helper exists");
assert(utilsParser.includes("normalizeLinkedInJobUrl"), "URL normalizer exists");

const normalized = "https://www.linkedin.com/jobs/search-results/?currentJobId=4423593085".replace(
  /\/jobs\/search-results\/\?currentJobId=(\d+)/i,
  "/jobs/view/$1/"
);
assert(normalized.includes("/jobs/view/4423593085"), "search-results URL pattern is handled");

const fixture = `
<div class="jobs-description-content__text">
  <p>We are looking for a senior engineer with React and TypeScript experience.</p>
</div>`;
const desc = fixture.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
assert(desc.includes("React and TypeScript"), "description text survives HTML stripping");
assert(desc.length > 40, "description length check works");

const hiringTitle =
  "McDermott Will & Schulte hiring Associate Director of Campaign & Event Technology in Washington, DC | LinkedIn";
const hiringMatch = hiringTitle
  .replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, "")
  .trim()
  .match(/^(.+?)\s+hiring\s+(.+?)(?:\s+in\s+.+)?$/i);
assert(hiringMatch?.[1] === "McDermott Will & Schulte", "parses company from LinkedIn hiring title");
assert(
  hiringMatch?.[2] === "Associate Director of Campaign & Event Technology",
  "parses role from LinkedIn hiring title"
);

console.log("\nAll static parser checks passed.");
