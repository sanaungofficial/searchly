#!/usr/bin/env npx tsx
/**
 * Re-fetch full ExecThread export for specific stored network jobs.
 *
 * Usage:
 *   npx tsx src/scripts/refresh-execthread-jobs.ts 6a3c8f549e87a77a29d52924
 */

import { prisma } from "@/lib/prisma";
import { runExecThreadRefreshByExternalIds } from "@/lib/execthread/sync";
import { mapExecThreadNetworkJob } from "@/lib/execthread/map-network-job";
import type { ExecThreadListingRaw } from "@/lib/execthread/types";

async function main() {
  const externalIds = process.argv.slice(2).filter(Boolean);
  if (!externalIds.length) {
    console.error("Pass one or more ExecThread external IDs.");
    process.exit(1);
  }

  console.log(`Refreshing ${externalIds.length} ExecThread job(s)...`);
  const summary = await runExecThreadRefreshByExternalIds(externalIds);
  console.log(JSON.stringify(summary, null, 2));

  for (const externalId of externalIds) {
    const row = await prisma.networkJob.findFirst({
      where: { source: "EXECTHREAD", externalId },
      select: {
        externalId: true,
        companyName: true,
        sourceUrl: true,
        recruiterName: true,
        raw: true,
      },
    });

    if (!row) {
      console.warn(`No stored job for ${externalId}`);
      continue;
    }

    const mapped = mapExecThreadNetworkJob(row.raw as ExecThreadListingRaw);
    console.log(`\n${externalId}:`);
    console.log(`  companyName: ${row.companyName ?? mapped.companyName ?? "—"}`);
    console.log(`  applyUrl: ${mapped.applyUrl ?? "—"}`);
    console.log(`  salary: ${mapped._display.salaryLabel ?? "—"}`);
    console.log(`  companySummary: ${mapped._display.companySummary?.slice(0, 80) ?? "—"}`);
    console.log(`  contacts: ${mapped._display.contacts.map((c) => c.name).filter(Boolean).join(", ") || "—"}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
