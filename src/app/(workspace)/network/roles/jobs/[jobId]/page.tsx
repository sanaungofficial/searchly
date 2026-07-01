import { redirect } from "next/navigation";
import { networkingNetworkJobPath } from "@/lib/workspace-urls";

type Props = { params: Promise<{ jobId: string }> };

export default async function LegacyNetworkRoleJobPage({ params }: Props) {
  const { jobId } = await params;
  redirect(networkingNetworkJobPath(decodeURIComponent(jobId)));
}
