/**
 * One-time fix: promote imported jobs wrongly stored as SAVED when they have an application date.
 *
 * Usage:
 *   POSTGRES_PRISMA_URL=... npx tsx src/scripts/fix-saved-pipeline-stages.ts
 *   POSTGRES_PRISMA_URL=... npx tsx src/scripts/fix-saved-pipeline-stages.ts --user-id <cuid>
 *   POSTGRES_PRISMA_URL=... npx tsx src/scripts/fix-saved-pipeline-stages.ts --dry-run
 */
import { prisma } from "@/lib/prisma";

function parseArgs() {
  const args = process.argv.slice(2);
  let userId: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run") dryRun = true;
    else if ((a === "--user-id" || a === "--userId") && args[i + 1]) userId = args[++i];
  }

  return { userId, dryRun };
}

async function main() {
  const { userId, dryRun } = parseArgs();

  const where = {
    stage: "SAVED" as const,
    appliedAt: { not: null },
    ...(userId ? { userId } : {}),
  };

  const candidates = await prisma.job.findMany({
    where,
    select: { id: true, userId: true, company: true, role: true, appliedAt: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(
    dryRun ? "[dry-run] " : "",
    `Found ${candidates.length} job(s) with stage=SAVED and appliedAt set`,
    userId ? `for user ${userId}` : "across all users",
  );

  if (candidates.length === 0) return;

  if (dryRun) {
    for (const job of candidates.slice(0, 20)) {
      console.log(`  - ${job.company} · ${job.role} (${job.id}) applied ${job.appliedAt?.toISOString()}`);
    }
    if (candidates.length > 20) console.log(`  ... and ${candidates.length - 20} more`);
    return;
  }

  const result = await prisma.job.updateMany({
    where,
    data: { stage: "APPLIED" },
  });

  console.log(`Updated ${result.count} job(s) from SAVED → APPLIED`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
