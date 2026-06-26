import { redirect } from "next/navigation";

/** Legacy route — ops tools live under /expert/ops and inbox tabs. */
export default async function DashboardOpsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  if (section === "clients") redirect("/expert/ops?section=clients");
  if (section === "bookings") redirect("/expert/inbox");
  if (section === "live") redirect("/expert/inbox?section=live");
  redirect("/expert/inbox");
}
