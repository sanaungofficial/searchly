import { redirect } from "next/navigation";
import { NETWORKING_IN_NETWORK_PATH } from "@/lib/workspace-urls";

export default function LegacyOpportunitiesNetworkPage() {
  redirect(NETWORKING_IN_NETWORK_PATH);
}
