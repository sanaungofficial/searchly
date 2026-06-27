import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import {
  listInboxContacts,
  parseContactListFilters,
  parseContactSortField,
} from "@/lib/inbox-crm/list-contacts";

export async function GET(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const page = Number(sp.get("page") ?? "1");
  const pageSize = Number(sp.get("pageSize") ?? "25");
  const sort = parseContactSortField(sp.get("sort"));
  const sortDir = sp.get("sortDir") === "asc" ? "asc" : "desc";
  const q = sp.get("q")?.trim() || undefined;
  const filters = parseContactListFilters(sp.get("filters"));

  const result = await listInboxContacts({
    userId: dbUser.id,
    q,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
    sort,
    sortDir,
    filters,
  });

  return NextResponse.json(result);
}
