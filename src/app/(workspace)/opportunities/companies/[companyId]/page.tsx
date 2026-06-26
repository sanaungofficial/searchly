import { redirect } from "next/navigation";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  redirect(`/profile/target-companies/${encodeURIComponent(companyId)}`);
}
