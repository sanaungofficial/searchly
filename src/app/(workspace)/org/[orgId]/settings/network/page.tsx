import { OrgNetworkSettingsPanel } from "@/components/org/org-network-settings-panel";

export default async function OrgNetworkSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <OrgNetworkSettingsPanel orgId={orgId} />;
}
