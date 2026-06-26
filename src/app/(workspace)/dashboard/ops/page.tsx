import { redirect } from "next/navigation";

/** Legacy route — ops tools live under Inbox (Live) and Clients. */
export default async function DashboardOpsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  if (section === "clients") redirect("/dashboard/clients");
  if (section === "bookings") redirect("/dashboard/inbox");
  if (section === "live") redirect("/dashboard/inbox?section=live");
  redirect("/dashboard/inbox");
}
