import { redirect } from "next/navigation";

/** Clients live under Expert mode (/expert/ops) — admins see all clients there. */
export default function AdminClientsPage() {
  redirect("/expert/ops?section=clients");
}
