import { prisma } from "@/lib/prisma";
import { SubscriptionStatus, UserRole } from "@prisma/client";
import { UsersTable } from "./users-table";

async function getAdminData() {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [users, subscriptions] = await Promise.all([
    prisma.user.findMany({
      include: {
        subscription: { select: { status: true, stripeCurrentPeriodEnd: true } },
        monthlyUsage: { where: { month: currentMonth } },
        profile: {
          select: {
            headline: true,
            summary: true,
            linkedinUrl: true,
            targetRoles: true,
            targetSalary: true,
            employmentStatus: true,
            currentSalary: true,
            careerMotivation: true,
            jobTimeline: true,
            attribution: true,
            resumeUrl: true,
          },
        },
        jobs: {
          select: { id: true, company: true, role: true, stage: true },
          orderBy: { createdAt: "desc" },
          take: 8,
        },
        _count: { select: { jobs: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscription.findMany({ select: { status: true } }),
  ]);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const newThisWeek = users.filter((u) => new Date(u.createdAt) >= sevenDaysAgo).length;
  const newThisMonth = users.filter((u) => new Date(u.createdAt) >= thirtyDaysAgo).length;

  const roleCounts: Record<UserRole, number> = {
    USER: 0,
    COACH: 0,
    RECRUITER: 0,
    ADMIN: 0,
  };
  users.forEach((u) => roleCounts[u.role]++);

  const usersWithJobs = users.filter((u) => u._count.jobs > 0).length;
  const usersWithResume = users.filter((u) => u.profile?.resumeUrl != null).length;
  const usersWithAi = users.filter((u) => (u.monthlyUsage[0]?.count ?? 0) > 0).length;

  const subCounts = {
    active: subscriptions.filter((s) => s.status === SubscriptionStatus.ACTIVE).length,
    trialing: subscriptions.filter((s) => s.status === SubscriptionStatus.TRIALING).length,
    pastDue: subscriptions.filter((s) => s.status === SubscriptionStatus.PAST_DUE).length,
    canceled: subscriptions.filter((s) => s.status === SubscriptionStatus.CANCELED).length,
  };

  return {
    users,
    totalUsers: users.length,
    newThisWeek,
    newThisMonth,
    roleCounts,
    usersWithJobs,
    usersWithResume,
    usersWithAi,
    subCounts,
  };
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 px-6 py-5">
      <p className="text-xs text-stone-400 uppercase tracking-widest font-mono mb-1">{label}</p>
      <p
        className={`text-3xl font-semibold ${accent ?? "text-stone-800"}`}
        style={{ fontFamily: "var(--font-playfair)" }}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
    </div>
  );
}

function pct(n: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

export default async function AdminPage() {
  const data = await getAdminData();

  return (
    <div className="space-y-10">
      <div>
        <h1
          className="text-2xl font-semibold text-stone-800 mb-1"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Admin Dashboard
        </h1>
        <p className="text-sm text-stone-400">Live data · {data.totalUsers} registered users</p>
      </div>

      {/* Growth */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-4">Growth</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Total Users" value={data.totalUsers} />
          <StatCard label="New This Week" value={data.newThisWeek} />
          <StatCard label="New This Month" value={data.newThisMonth} />
        </div>
      </section>

      {/* Role breakdown */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-4">Roles</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Users"
            value={data.roleCounts.USER}
            sub={pct(data.roleCounts.USER, data.totalUsers)}
          />
          <StatCard
            label="Coaches"
            value={data.roleCounts.COACH}
            sub={pct(data.roleCounts.COACH, data.totalUsers)}
            accent="text-blue-700"
          />
          <StatCard
            label="Recruiters"
            value={data.roleCounts.RECRUITER}
            sub={pct(data.roleCounts.RECRUITER, data.totalUsers)}
            accent="text-purple-700"
          />
          <StatCard
            label="Admins"
            value={data.roleCounts.ADMIN}
            sub={pct(data.roleCounts.ADMIN, data.totalUsers)}
            accent="text-amber-700"
          />
        </div>
      </section>

      {/* Activation */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-4">Activation</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="Added a Job"
            value={data.usersWithJobs}
            sub={`${pct(data.usersWithJobs, data.totalUsers)} of users`}
          />
          <StatCard
            label="Uploaded Resume"
            value={data.usersWithResume}
            sub={`${pct(data.usersWithResume, data.totalUsers)} of users`}
          />
          <StatCard
            label="Used AI This Month"
            value={data.usersWithAi}
            sub={`${pct(data.usersWithAi, data.totalUsers)} of users`}
          />
        </div>
      </section>

      {/* Subscriptions */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-4">Subscriptions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Active"
            value={data.subCounts.active}
            accent="text-emerald-700"
          />
          <StatCard
            label="Trialing"
            value={data.subCounts.trialing}
            accent="text-blue-700"
          />
          <StatCard
            label="Past Due"
            value={data.subCounts.pastDue}
            accent={data.subCounts.pastDue > 0 ? "text-amber-600" : undefined}
          />
          <StatCard
            label="Canceled"
            value={data.subCounts.canceled}
          />
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
