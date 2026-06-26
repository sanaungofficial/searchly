import { ctaButton, emailShell, escapeHtml, appBaseUrl } from "@/lib/comms/email-shell";
import { sendKimchiEmail } from "@/lib/comms/send-email";
import { digestUnsubscribeUrl } from "@/lib/digest-unsubscribe";
import { getFollowUpSuggestions, type FollowUpSuggestion } from "@/lib/job-follow-up-suggestions";
import { prisma } from "@/lib/prisma";
import { JobStage } from "@prisma/client";

const MAX_PIPELINE_JOBS = 5;

function stageLabel(stage: JobStage): string {
  switch (stage) {
    case JobStage.APPLYING:
      return "Applying";
    case JobStage.APPLIED:
      return "Applied";
    case JobStage.SCREENING:
      return "Screening";
    default:
      return stage;
  }
}

export async function sendPipelineFollowUpEmail(input: {
  email: string;
  name: string | null;
  userId: string;
  suggestions: FollowUpSuggestion[];
}): Promise<boolean> {
  if (!input.suggestions.length) return false;

  const firstName = input.name?.split(" ")[0] ?? "there";
  const rows = input.suggestions
    .slice(0, MAX_PIPELINE_JOBS)
    .map(
      (s) => `<tr><td style="padding:14px 0;border-bottom:1px solid #E5DDD0;">
        <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1C3A2F;">${escapeHtml(s.role)}</p>
        <p style="margin:0 0 6px;font-size:13px;color:#6B6258;">${escapeHtml(s.company)} · ${escapeHtml(stageLabel(s.stage))}</p>
        <p style="margin:0;font-size:13px;color:#52493F;line-height:1.55;">No update in ${s.daysQuiet} day${s.daysQuiet === 1 ? "" : "s"} — a brief follow-up may help.</p>
      </td></tr>`,
    )
    .join("");

  const subject =
    input.suggestions.length === 1
      ? `Follow up on ${input.suggestions[0].role} at ${input.suggestions[0].company}?`
      : `${input.suggestions.length} applications may need a follow-up`;

  const html = emailShell({
    subtitle: "Pipeline check-in",
    title: `Time to nudge, ${firstName}?`,
    bodyHtml: `<p style="margin:0 0 20px;font-size:15px;color:#52493F;line-height:1.7;">
        These roles in your pipeline have gone quiet. A short check-in can keep momentum going.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      ${ctaButton(`${appBaseUrl()}/opportunities/pipeline`, "Open pipeline →")}`,
    footerHtml: `<p style="margin:0 0 8px;font-size:12px;color:#6B6258;line-height:1.6;">
        Pipeline follow-ups are sent when a role has had no activity for 7+ days.
      </p>
      <p style="margin:0;font-size:12px;color:#6B6258;line-height:1.6;">
        <a href="${digestUnsubscribeUrl(input.userId)}" style="color:#2A6B4A;text-decoration:underline;">Unsubscribe from job emails</a>
      </p>`,
  });

  const result = await sendKimchiEmail({
    to: input.email,
    subject,
    html,
    template: "pipeline_followup",
  });
  return result.sent;
}

export type PipelineFollowUpCronSummary = {
  usersConsidered: number;
  emailsSent: number;
  jobsNotified: number;
  errors: string[];
};

export async function runPipelineFollowUpCron(): Promise<PipelineFollowUpCronSummary> {
  const summary: PipelineFollowUpCronSummary = {
    usersConsidered: 0,
    emailsSent: 0,
    jobsNotified: 0,
    errors: [],
  };

  const users = await prisma.user.findMany({
    where: {
      digestSettings: { pipelineEmailEnabled: true, dailyEmailEnabled: true },
      jobs: {
        some: {
          stage: { in: [JobStage.APPLIED, JobStage.APPLYING, JobStage.SCREENING] },
          pipelineFollowUpSentAt: null,
        },
      },
    },
    include: { digestSettings: true },
    take: 100,
  });

  for (const user of users) {
    summary.usersConsidered += 1;
    try {
      const allSuggestions = await getFollowUpSuggestions(user.id, 20);
      const pending = [];
      for (const s of allSuggestions) {
        const job = await prisma.job.findUnique({
          where: { id: s.jobId },
          select: { pipelineFollowUpSentAt: true },
        });
        if (!job || job.pipelineFollowUpSentAt) continue;
        pending.push(s);
      }

      if (!pending.length) continue;

      const batch = pending.slice(0, MAX_PIPELINE_JOBS);
      const sent = await sendPipelineFollowUpEmail({
        email: user.email,
        name: user.name,
        userId: user.id,
        suggestions: batch,
      });

      if (sent) {
        summary.emailsSent += 1;
        summary.jobsNotified += batch.length;
        await prisma.job.updateMany({
          where: { id: { in: batch.map((b) => b.jobId) } },
          data: { pipelineFollowUpSentAt: new Date() },
        });
      }
    } catch (err) {
      summary.errors.push(`${user.email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return summary;
}
