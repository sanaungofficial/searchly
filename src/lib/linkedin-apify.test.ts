import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapApifyLinkedInItem } from "./linkedin-apify";

const fixturePath = join(__dirname, "__fixtures__", "linkedin-harvestapi-sample.json");
const raw = JSON.parse(readFileSync(fixturePath, "utf8"));
const mapped = mapApifyLinkedInItem(raw);

if (!mapped) {
  console.error("FAIL: mapper returned null");
  process.exit(1);
}

const checks: Array<[string, boolean]> = [
  ["fullName", mapped.fullName === "Bill Gates"],
  ["headline", !!mapped.headline?.includes("Gates Foundation")],
  ["summary", !!mapped.summary?.includes("Microsoft")],
  ["location", mapped.location === "Seattle, Washington, United States"],
  ["profileUrl", mapped.profileUrl === "https://www.linkedin.com/in/williamhgates"],
  ["experience count", mapped.workExperience.length === 2],
  ["education count", mapped.education.length === 1],
  ["microsoft role", mapped.workExperience.some((e) => e.company === "Microsoft")],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nAll mapper checks passed.");
console.log(JSON.stringify(mapped, null, 2));
