import { redirect } from "next/navigation";

/** Clients live under Expert mode (/expert/clients) — admins see all clients there. */
export default function AdminClientsPage() {
  redirect("/expert/clients");
}
