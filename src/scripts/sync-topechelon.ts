/**
 * CLI: sync Top Echelon network jobs into Postgres.
 *
 * Usage:
 *   POSTGRES_PRISMA_URL=... TOPECHELON_EMAIL=... TOPECHELON_PASSWORD=... npm run sync:topechelon
 *   npm run sync:topechelon -- --limit 10 --mfa 123456
 *   npm run sync:topechelon -- --full --mfa 123456
 */
import { runTopEchelonSync, TopEchelonMfaRequiredError } from "@/lib/topechelon/sync";

function parseArgs() {
  const args = process.argv.slice(2);
  let limit: number | undefined = 10;
  let mfaCode: string | undefined;
  let forceLogin = false;
  let fullCatalog = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--full" || a === "--full-catalog") fullCatalog = true;
    else if (a === "--limit" && args[i + 1]) limit = Math.min(50, Math.max(1, Number(args[++i])));
    else if ((a === "--mfa" || a === "--mfa-code") && args[i + 1]) mfaCode = args[++i];
    else if (a === "--force-login") forceLogin = true;
  }

  if (fullCatalog) limit = undefined;

  return { limit, mfaCode, forceLogin, fullCatalog };
}

async function main() {
  const { limit, mfaCode, forceLogin, fullCatalog } = parseArgs();

  if (!process.env.POSTGRES_PRISMA_URL && !process.env.DATABASE_URL) {
    console.error("Missing POSTGRES_PRISMA_URL (or DATABASE_URL)");
    process.exit(1);
  }

  if (!process.env.TOPECHELON_EMAIL || !process.env.TOPECHELON_PASSWORD) {
    console.error("Missing TOPECHELON_EMAIL / TOPECHELON_PASSWORD");
    process.exit(1);
  }

  try {
    const summary = await runTopEchelonSync({ limit, mfaCode, forceLogin, fullCatalog });
    console.log(JSON.stringify({ ok: true, summary }, null, 2));
  } catch (err) {
    if (err instanceof TopEchelonMfaRequiredError) {
      console.error(JSON.stringify({ ok: false, code: "MFA_REQUIRED", message: err.message }, null, 2));
      process.exit(428);
    }
    console.error(err);
    process.exit(1);
  }
}

main();
