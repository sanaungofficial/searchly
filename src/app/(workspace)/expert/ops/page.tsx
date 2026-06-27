import { redirect } from "next/navigation";

/** Legacy — ops split into Inbox, Clients, and Live Webinar. */
export default async function ExpertOpsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  if (section === "clients") redirect("/expert/clients");
  if (section === "bookings") redirect("/expert/inbox");
  if (section === "live") redirect("/expert/live");
  redirect("/expert/live");
}
