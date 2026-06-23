import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getDbUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findUnique({ where: { email: user.email! } });
}

// GET /api/jobs — list all jobs for current user
export async function GET() {
  const supabase = await createClient();
  const dbUser = await getDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await prisma.job.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(jobs);
}

// POST /api/jobs — create a new job, auto-run fit analysis if resume + description present
export async function POST(request: Request) {
  const supabase = await createClient();
  const dbUser = await getDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { company, role, url, notes, location, salary, description, requirements } = body;

  if (!company || !role) {
    return NextResponse.json({ error: "company and role are required" }, { status: 400 });
  }

  const job = await prisma.job.create({
    data: {
      userId: dbUser.id,
      company,
      role,
      url: url ?? null,
      stage: body.stage ?? "SAVED",
      notes: notes ?? null,
      location: location ?? null,
      salary: salary ?? null,
      description: description ?? null,
      requirements: requirements ?? [],
    },
  });

  // Auto-run fit analysis if we have both a description and the user's resume
  if (description && process.env.ANTHROPIC_API_KEY) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId: dbUser.id },
        select: { resumeText: true },
      });

      if (profile?.resumeText) {
        const { getPrompt, interpolate } = await import("@/lib/prompts");
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const fullContext = [
          description,
          requirements?.length ? `\n\nKey Requirements:\n${(requirements as string[]).join("\n")}` : "",
        ].join("");

        const template = await getPrompt("JOB_MATCH");
        const prompt = interpolate(template, {
          jobTitle: role,
          company,
          description: fullContext.slice(0, 4000),
          resumeSlice: profile.resumeText.slice(0, 4000),
        });

        const message = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });

        const text = message.content[0].type === "text" ? message.content[0].text : "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const matchData = JSON.parse(jsonMatch[0]);
          const updated = await prisma.job.update({
            where: { id: job.id },
            data: {
              fitScore: typeof matchData.score === "number" ? matchData.score : null,
              matchData,
            },
          });
          return NextResponse.json(updated, { status: 201 });
        }
      }
    } catch {
      // Analysis failed — return job without fit score
    }
  }

  return NextResponse.json(job, { status: 201 });
}
