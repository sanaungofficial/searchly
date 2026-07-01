import { redirect } from "next/navigation";
import { NETWORKING_IN_NETWORK_PATH } from "@/lib/workspace-urls";

export default function NetworkRolesPage() {
  redirect(NETWORKING_IN_NETWORK_PATH);
}
