import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { findLiveSessionByRouteId, listSessionRegistrations } from "@/lib/live-session-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const row = await findLiveSessionByRouteId(id);
  if (!row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const registrations = await listSessionRegistrations(row.id);

  const header = ["Name", "Email", "Registered At", "Joined At"];
  const lines = [
    header.join(","),
    ...registrations.map((r) =>
      [
        csvEscape(r.user.name ?? ""),
        csvEscape(r.user.email),
        r.createdAt.toISOString(),
        r.joinedAt?.toISOString() ?? "",
      ].join(","),
    ),
  ];

  const filename = `live-session-${row.legacyNumericId ?? row.id.slice(0, 8)}-rsvps.csv`;

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
