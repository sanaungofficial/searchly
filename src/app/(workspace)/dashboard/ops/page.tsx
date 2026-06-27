import { redirect } from "next/navigation";

/** Legacy route — expert tools live under /expert/*. */
export default async function DashboardOpsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  if (section === "clients") redirect("/expert/clients");
  if (section === "bookings") redirect("/expert/inbox");
  if (section === "live") redirect("/expert/live");
  redirect("/expert/inbox");
}
