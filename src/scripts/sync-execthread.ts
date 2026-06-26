/**
 * CLI: sync ExecThread listings into Postgres.
 *
 *   EXECTHREAD_EMAIL=... EXECTHREAD_PASSWORD=... npm run sync:execthread
 *   npm run sync:execthread -- --limit 5 --force-login
 *   npm run sync:execthread -- --refresh-existing
 */
import { runExecThreadRefreshExisting, runExecThreadSync } from "@/lib/execthread/sync";

async function main() {
  const args = process.argv.slice(2);
  let limit = 5;
  let forceLogin = false;
  let refreshExisting = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) limit = Number.parseInt(args[++i], 10);
    if (args[i] === "--force-login") forceLogin = true;
    if (args[i] === "--refresh-existing") refreshExisting = true;
  }

  if (!process.env.EXECTHREAD_EMAIL || !process.env.EXECTHREAD_PASSWORD) {
    console.error("Missing EXECTHREAD_EMAIL / EXECTHREAD_PASSWORD");
    process.exit(1);
  }

  if (!process.env.POSTGRES_PRISMA_URL && !process.env.DATABASE_URL) {
    console.error("Missing POSTGRES_PRISMA_URL");
    process.exit(1);
  }

  const summary = refreshExisting
    ? await runExecThreadRefreshExisting({ forceLogin })
    : await runExecThreadSync({ limit, forceLogin });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
