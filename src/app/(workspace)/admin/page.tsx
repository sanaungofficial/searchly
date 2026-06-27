import { prisma } from "@/lib/prisma";
import { SubscriptionStatus, UserRole } from "@prisma/client";
import { requireAdmin, isSuperAdmin } from "@/lib/auth";
import { UsersTable } from "./users-table";
import { TopEchelonSyncPanel } from "./top-echelon-sync-panel";
import { ExecThreadSyncPanel } from "./execthread-sync-panel";
import { AirtableCoachesSyncPanel } from "./airtable-coaches-sync-panel";
import { AdminJobMatchEmailPanel } from "@/components/admin/admin-job-match-email-panel";
import { AdminUsagePanel } from "@/components/admin/admin-usage-panel";
import { AdminLiveOverviewWidget } from "@/components/admin/admin-live-overview-widget";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel } from "@/components/scout/scout-box";
import { color, displayTitleStyle, fontMono, type as T } from "@/lib/typography";
import { adminSectionLabel } from "./admin-styles";

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
    <ScoutBox padding="20px 24px">
      <p style={{ fontSize: T.label, color: color.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: fontMono, margin: "0 0 8px" }}>
        {label}
      </p>
      <p style={{ ...displayTitleStyle(32), color: accent ?? color.forest, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: T.caption, color: color.muted, margin: "6px 0 0" }}>{sub}</p>}
    </ScoutBox>
  );
}

function pct(n: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

export default async function AdminPage() {
  const [data, currentAdmin] = await Promise.all([getAdminData(), requireAdmin()]);
  const canEdit = isSuperAdmin(currentAdmin?.email);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block" }} />
          <ScoutLabel>Operations</ScoutLabel>
        </div>
        <ScoutDisplayTitle size={36} style={{ marginBottom: 8 }}>Admin Dashboard</ScoutDisplayTitle>
        <p style={{ fontSize: T.bodySm, color: color.muted, margin: 0 }}>Live data · {data.totalUsers} registered users</p>
      </div>

      <AdminLiveOverviewWidget />

      <section>
        <h2 className={adminSectionLabel}>Growth</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Total Users" value={data.totalUsers} />
          <StatCard label="New This Week" value={data.newThisWeek} />
          <StatCard label="New This Month" value={data.newThisMonth} />
        </div>
      </section>

      {/* Role breakdown */}
      <section>
        <h2 className={adminSectionLabel}>Roles</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Users"
            value={data.roleCounts.USER}
            sub={pct(data.roleCounts.USER, data.totalUsers)}
          />
          <StatCard
            label="Experts"
            value={data.roleCounts.COACH}
            sub={pct(data.roleCounts.COACH, data.totalUsers)}
            accent="#2563eb"
          />
          <StatCard
            label="Admins"
            value={data.roleCounts.ADMIN}
            sub={pct(data.roleCounts.ADMIN, data.totalUsers)}
            accent="#b45309"
          />
        </div>
      </section>

      {/* Activation */}
      <section>
        <h2 className={adminSectionLabel}>Activation</h2>
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

      <section>
        <h2 className={adminSectionLabel}>Subscriptions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Active" value={data.subCounts.active} accent={color.forest} />
          <StatCard label="Trialing" value={data.subCounts.trialing} accent="#2563eb" />
          <StatCard label="Past Due" value={data.subCounts.pastDue} accent={data.subCounts.pastDue > 0 ? "#b45309" : undefined} />
          <StatCard label="Canceled" value={data.subCounts.canceled} />
        </div>
      </section>

      <AdminUsagePanel />

      <section>
        <h2 className={adminSectionLabel}>In-network requests</h2>
        <ScoutBox padding={20} style={{ marginBottom: 24 }}>
          <ScoutLabel>Intro & profile queue</ScoutLabel>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: T.bodySm, color: color.muted, margin: "10px 0 16px", lineHeight: 1.55, maxWidth: 640 }}>
            Client requests from In-Network Roles — warm introductions and Top Echelon profile sends.
          </p>
          <a href="/admin/network-requests" style={{ fontFamily: "var(--font-sans)", fontSize: T.caption, fontWeight: 600, color: color.forest }}>
            Open request queue →
          </a>
        </ScoutBox>
      </section>

      <section>
        <h2 className={adminSectionLabel}>Network catalog</h2>
        <ScoutBox padding={20} style={{ marginBottom: 24 }}>
          <ScoutLabel>Scraped listings browser</ScoutLabel>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: T.bodySm, color: color.muted, margin: "10px 0 16px", lineHeight: 1.55, maxWidth: 640 }}>
            Browse every ExecThread and Top Echelon job Kimchi has imported — same drawer as In-Network Roles, with admin-only details.
          </p>
          <a
            href="/admin/network-jobs"
            style={{ fontFamily: "var(--font-sans)", fontSize: T.caption, fontWeight: 600, color: color.forest }}
          >
            Open network catalog →
          </a>
        </ScoutBox>
      </section>

      <section>
        <h2 className={adminSectionLabel}>Integrations</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <AdminJobMatchEmailPanel />
          <AirtableCoachesSyncPanel />
          <TopEchelonSyncPanel />
          <ExecThreadSyncPanel />
        </div>
      </section>

      <section>
        <h2 className={adminSectionLabel}>All Users</h2>
        <UsersTable users={data.users} canEdit={canEdit} />
      </section>
    </div>
  );
}
