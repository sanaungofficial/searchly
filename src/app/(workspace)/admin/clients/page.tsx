import { redirect } from "next/navigation";

/** Clients live under Expert dashboard — admins see all clients there. */
export default function AdminClientsPage() {
  redirect("/dashboard/ops?section=clients");
}
