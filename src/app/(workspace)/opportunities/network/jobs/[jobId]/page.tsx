import { redirect } from "next/navigation";
import { networkJobUrl } from "@/lib/workspace-urls";

export default function LegacyOpportunitiesNetworkJobPage({
  params,
}: {
  params: { jobId: string };
}) {
  redirect(networkJobUrl(params.jobId));
}
