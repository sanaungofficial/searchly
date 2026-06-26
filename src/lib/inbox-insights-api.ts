import type { ActivitySummary, InboxLens, PipelineJob } from "@/components/scout/inbox/inbox-types";

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

export async function fetchInboxInsights(lens: InboxLens = "job_search"): Promise<InboxInsightsPayload> {
  if (lens === "work") {
    const res = await fetch("/api/user/work-agent/check", { method: "POST" });
    const data = res.ok ? await res.json() : { activities: [], pendingCount: 0, followUps: [] };
    return {
      activities: (data.activities ?? []) as ActivitySummary[],
      pendingCount: data.pendingCount ?? 0,
      followUps: (data.followUps ?? []) as FollowUpSuggestion[],
      jobs: [],
    };
  }

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
