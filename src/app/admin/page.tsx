import { prisma } from "@/lib/prisma";
import { SubscriptionStatus } from "@prisma/client";
import { UsersTable } from "./users-table";

async function getAdminData() {
  const [users, jobs, subscriptions] = await Promise.all([
    prisma.user.findMany({
      include: {
        subscription: true,
        _count: { select: { jobs: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.job.findMany({ select: { stage: true, createdAt: true } }),
    prisma.subscription.findMany({ select: { status: true } }),
  ]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const newUsersThisWeek = users.filter((u) => new Date(u.createdAt) >= sevenDaysAgo).length;
  const newUsersThisMonth = users.filter((u) => new Date(u.createdAt) >= thirtyDaysAgo).length;

  const subCounts = {
    active: subscriptions.filter((s) => s.status === SubscriptionStatus.ACTIVE).length,
    trialing: subscriptions.filter((s) => s.status === SubscriptionStatus.TRIALING).length,
    canceled: subscriptions.filter((s) => s.status === SubscriptionStatus.CANCELED).length,
    pastDue: subscriptions.filter((s) => s.status === SubscriptionStatus.PAST_DUE).length,
  };

  const stageCounts = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.stage] = (acc[j.stage] ?? 0) + 1;
    return acc;
  }, {});

  const usersWithJobs = users.filter((u) => u._count.jobs > 0).length;
  const usersWithResume = await prisma.profile.count({ where: { resumeUrl: { not: null } } });
  const usersWithCoverLetter = await prisma.job.count({ where: { coverLetter: { not: null } } });
  const usersWithFitAnalysis = await prisma.job.count({ where: { fitAnalysis: { not: null } } });

  return {
    users,
    totalUsers: users.length,
    newUsersThisWeek,
    newUsersThisMonth,
    totalJobs: jobs.length,
    stageCounts,
    subCounts,
    usersWithJobs,
    usersWithResume,
    usersWithCoverLetter,
    usersWithFitAnalysis,
  };
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 px-6 py-5">
      <p className="text-xs text-stone-400 uppercase tracking-widest font-mono mb-1">{label}</p>
      <p className="text-3xl font-semibold text-stone-800" style={{ fontFamily: "var(--font-playfair)" }}>
        {value}
      </p>
      {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
    </div>
  );
}

const STAGE_LABELS: Record<string, string> = {
  SAVED: "Saved",
  APPLYING: "Applying",
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export default async function AdminPage() {
  const data = await getAdminData();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800 mb-1" style={{ fontFamily: "var(--font-playfair)" }}>
          Admin Dashboard
        </h1>
        <p className="text-sm text-stone-400">Super admin view — live data from production</p>
      </div>

      {/* Users */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-4">Users</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={data.totalUsers} />
          <StatCard label="New This Week" value={data.newUsersThisWeek} />
          <StatCard label="New This Month" value={data.newUsersThisMonth} />
          <StatCard label="With Jobs" value={data.usersWithJobs} sub={`${Math.round((data.usersWithJobs / Math.max(data.totalUsers, 1)) * 100)}% of users`} />
        </div>
      </section>

      {/* Subscriptions */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-4">Subscriptions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Active" value={data.subCounts.active} />
          <StatCard label="Trialing" value={data.subCounts.trialing} />
          <StatCard label="Past Due" value={data.subCounts.pastDue} />
          <StatCard label="Canceled" value={data.subCounts.canceled} />
        </div>
      </section>

      {/* Usage */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-4">Usage</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Jobs" value={data.totalJobs} />
          <StatCard label="Resumes Uploaded" value={data.usersWithResume} />
          <StatCard label="Cover Letters Generated" value={data.usersWithCoverLetter} />
          <StatCard label="Fit Analyses Run" value={data.usersWithFitAnalysis} />
        </div>
      </section>

      {/* Job stages */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-4">Jobs by Stage</h2>
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-6 py-3 text-xs text-stone-400 font-mono uppercase tracking-wider">Stage</th>
                <th className="text-right px-6 py-3 text-xs text-stone-400 font-mono uppercase tracking-wider">Count</th>
                <th className="text-right px-6 py-3 text-xs text-stone-400 font-mono uppercase tracking-wider">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(STAGE_LABELS).map(([key, label]) => {
                const count = data.stageCounts[key] ?? 0;
                const pct = data.totalJobs > 0 ? Math.round((count / data.totalJobs) * 100) : 0;
                return (
                  <tr key={key} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50">
                    <td className="px-6 py-3 text-stone-700">{label}</td>
                    <td className="px-6 py-3 text-right text-stone-700 font-mono">{count}</td>
                    <td className="px-6 py-3 text-right text-stone-400 font-mono">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Users table */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-4">All Users</h2>
        <UsersTable users={data.users} />
      </section>
    </div>
  );
}
