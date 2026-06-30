import { redirect } from "next/navigation";
import { NETWORK_ROLES_PATH } from "@/lib/workspace-urls";

export default function LegacyOpportunitiesNetworkPage() {
  redirect(NETWORK_ROLES_PATH);
}
