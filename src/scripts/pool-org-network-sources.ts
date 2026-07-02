/**
 * Backfill: set all OrgNetworkSource rows to POOLED and sync InboxContact into org graphs.
 *
 * Usage: npx tsx src/scripts/pool-org-network-sources.ts
 */
import {
  migrateAllOrgNetworkSourcesToPooled,
  syncAllOrgMemberInboxContacts,
} from "@/lib/org-contact-graph/sync-inbox-contacts";

async function main() {
  const pooled = await migrateAllOrgNetworkSourcesToPooled();
  console.log(`Updated ${pooled.updated} network source(s) to POOLED`);

  const synced = await syncAllOrgMemberInboxContacts();
  console.log(
    `Synced inbox contacts for ${synced.members} member(s): ${synced.synced} contact edge(s), ${synced.failed} failed`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
