import type { ActivitySummary, PipelineJob } from "@/components/scout/inbox/inbox-types";

export type FollowUpSuggestion = {
  jobId: string;
  company: string;
  role: string;
  stage: string;
  daysQuiet: number;
  suggestion: string;
  lastMessageId: string | null;
};

export type InboxInsightsPayload = {
  activities: ActivitySummary[];
  jobs: PipelineJob[];
  followUps: FollowUpSuggestion[];
  pendingCount: number;
};

export async function fetchInboxInsights(): Promise<InboxInsightsPayload> {
  const [actRes, jobsRes, followRes, summaryRes] = await Promise.all([
    fetch("/api/user/job-agent/activity?limit=50&status=PENDING_REVIEW"),
    fetch("/api/jobs"),
    fetch("/api/user/job-agent/follow-ups"),
    fetch("/api/user/job-agent/activity?summary=1"),
  ]);

  const actData = actRes.ok ? await actRes.json() : { activities: [] };
  const jobsData = jobsRes.ok ? await jobsRes.json() : [];
  const followData = followRes.ok ? await followRes.json() : { suggestions: [] };
  const summary = summaryRes.ok ? await summaryRes.json() : { pendingCount: 0 };
  const activities = (actData.activities ?? []) as ActivitySummary[];
  const pendingCount = summary.pendingCount ?? activities.length;

  return {
    activities,
    pendingCount,
    followUps: (followData.suggestions ?? []) as FollowUpSuggestion[],
    jobs: (Array.isArray(jobsData) ? jobsData : []).map((j: PipelineJob) => ({
      id: j.id,
      company: j.company,
      role: j.role,
      stage: j.stage,
    })),
  };
}
