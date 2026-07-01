import { redirect } from "next/navigation";
import { networkJobUrl } from "@/lib/workspace-urls";

type Props = { params: Promise<{ jobId: string }> };

export default async function LegacyNetworkRoleJobPage({ params }: Props) {
  const { jobId } = await params;
  redirect(networkJobUrl(decodeURIComponent(jobId)));
}
