import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { loadContactCard } from "@/lib/inbox-crm/link-job";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const card = await loadContactCard(dbUser.id, id, { timelineLimit: 60 });
  if (!card) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  return NextResponse.json(card);
}
