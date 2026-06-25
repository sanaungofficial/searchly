import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { buildResumeDocx } from "@/lib/resume-docx";
import { buildResumePdf } from "@/lib/resume-pdf";
import { emptyParsedResumeData, normalizeParsedResumeData } from "@/lib/resume-parse";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format") || "docx";

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const asset = await prisma.userAsset.findFirst({ where: { id, userId: dbUser.id, type: "RESUME" } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = normalizeParsedResumeData(asset.parsedData) ?? emptyParsedResumeData();
  if (!parsed.name && dbUser.name) parsed.name = dbUser.name;

  if (format === "docx") {
    const { buffer, filename } = await buildResumeDocx(parsed, `${asset.name || "resume"}.docx`);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === "pdf") {
    const { buffer, filename } = await buildResumePdf(parsed, `${asset.name || "resume"}.pdf`);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
}
