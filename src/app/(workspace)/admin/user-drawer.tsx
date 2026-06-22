"use client";

import { useState } from "react";
import { UserRole, SubscriptionStatus } from "@prisma/client";

export type DrawerUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: Date | string;
  subscription: {
    status: SubscriptionStatus;
    stripeCurrentPeriodEnd: Date | string | null;
  } | null;
  monthlyUsage: { count: number }[];
  profile: {
    headline: string | null;
    summary: string | null;
    linkedinUrl: string | null;
    targetRoles: string[];
    targetSalary: string | null;
    employmentStatus: string | null;
    currentSalary: string | null;
    careerMotivation: string | null;
    jobTimeline: string | null;
    attribution: string | null;
    resumeUrl: string | null;
  } | null;
  jobs: { id: string; company: string; role: string; stage: string }[];
  _count: { jobs: number };
};

const ROLE_OPTIONS: UserRole[] = ["USER", "COACH", "RECRUITER", "ADMIN"];

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  TRIALING: "bg-blue-50 text-blue-700 border-blue-200",
  PAST_DUE: "bg-amber-50 text-amber-700 border-amber-200",
  CANCELED: "bg-stone-100 text-stone-500 border-stone-200",
  UNPAID: "bg-red-50 text-red-700 border-red-200",
  INCOMPLETE: "bg-orange-50 text-orange-700 border-orange-200",
  INCOMPLETE_EXPIRED: "bg-stone-100 text-stone-500 border-stone-200",
  PAUSED: "bg-stone-100 text-stone-500 border-stone-200",
};

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-stone-50 last:border-0">
      <span className="text-xs text-stone-400 font-mono w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-stone-700 leading-relaxed">{value}</span>
    </div>
  );
}

export function UserDrawer({
  user,
  onClose,
  onRoleUpdate,
}: {
  user: DrawerUser;
  onClose: () => void;
  onRoleUpdate: (id: string, role: UserRole) => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty = role !== user.role;
  const aiThisMonth = user.monthlyUsage[0]?.count ?? 0;

  async function handleRoleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Failed");
      onRoleUpdate(user.id, role);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setRole(user.role);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-[#F2EDE3] border-l border-stone-200 z-50 overflow-y-auto shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-stone-200 bg-white/60 backdrop-blur-sm sticky top-0 z-10">
          <div>
            <p className="font-semibold text-stone-800 text-lg leading-tight" style={{ fontFamily: "var(--font-playfair)" }}>
              {user.name ?? "Unnamed User"}
            </p>
            <p className="text-xs text-stone-400 font-mono mt-1">{user.email}</p>
            {user.profile?.headline && (
              <p className="text-xs text-stone-500 mt-1 italic">{user.profile.headline}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 ml-4 text-lg leading-none mt-0.5"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 flex-1">
          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-stone-200 px-4 py-3 text-center">
              <p className="text-2xl font-semibold text-stone-800" style={{ fontFamily: "var(--font-playfair)" }}>
                {user._count.jobs}
              </p>
              <p className="text-xs text-stone-400 font-mono mt-0.5">jobs</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 px-4 py-3 text-center">
              <p className="text-2xl font-semibold text-stone-800" style={{ fontFamily: "var(--font-playfair)" }}>
                {aiThisMonth}
              </p>
              <p className="text-xs text-stone-400 font-mono mt-0.5">AI / mo</p>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 px-4 py-3 text-center flex flex-col items-center justify-center">
              {user.subscription ? (
                <span className={`text-xs font-mono px-2 py-0.5 rounded border ${STATUS_STYLES[user.subscription.status]}`}>
                  {user.subscription.status.toLowerCase()}
                </span>
              ) : (
                <span className="text-xs text-stone-400 font-mono">free</span>
              )}
              <p className="text-xs text-stone-400 font-mono mt-1">plan</p>
            </div>
          </div>

          {/* Role */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <p className="text-xs text-stone-400 font-mono uppercase tracking-wider mb-3">Role</p>
            <div className="flex items-center gap-2">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="flex-1 text-sm bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-stone-300 font-mono"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {isDirty && (
                <button
                  onClick={handleRoleSave}
                  disabled={saving}
                  className="text-xs bg-stone-800 text-white px-4 py-2 rounded-lg hover:bg-stone-700 disabled:opacity-50 font-mono whitespace-nowrap"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              )}
              {saved && <span className="text-xs text-emerald-600 font-mono">Saved</span>}
            </div>
          </div>

          {/* Account */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <p className="text-xs text-stone-400 font-mono uppercase tracking-wider mb-3">Account</p>
            <Row label="Joined" value={fmt(user.createdAt)} />
            <Row label="Attribution" value={user.profile?.attribution} />
            {user.subscription?.stripeCurrentPeriodEnd && (
              <Row label="Renews" value={fmt(user.subscription.stripeCurrentPeriodEnd)} />
            )}
            <Row label="Resume" value={user.profile?.resumeUrl ? "Uploaded" : undefined} />
            <Row label="LinkedIn" value={user.profile?.linkedinUrl?.replace("https://www.linkedin.com/in/", "@") ?? undefined} />
          </div>

          {/* Profile */}
          {user.profile && (
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <p className="text-xs text-stone-400 font-mono uppercase tracking-wider mb-3">Profile</p>
              <Row label="Status" value={user.profile.employmentStatus} />
              <Row label="Current comp" value={user.profile.currentSalary} />
              <Row label="Target comp" value={user.profile.targetSalary} />
              <Row label="Timeline" value={user.profile.jobTimeline} />
              {user.profile.targetRoles.length > 0 && (
                <div className="flex items-start gap-3 py-1.5 border-b border-stone-50">
                  <span className="text-xs text-stone-400 font-mono w-28 shrink-0 pt-0.5">Target roles</span>
                  <div className="flex flex-wrap gap-1">
                    {user.profile.targetRoles.map((r) => (
                      <span key={r} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-mono">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {user.profile.careerMotivation && (
                <div className="py-1.5">
                  <p className="text-xs text-stone-400 font-mono mb-1">Motivation</p>
                  <p className="text-xs text-stone-700 leading-relaxed">{user.profile.careerMotivation}</p>
                </div>
              )}
              {user.profile.summary && (
                <div className="py-1.5 border-t border-stone-50">
                  <p className="text-xs text-stone-400 font-mono mb-1">Summary</p>
                  <p className="text-xs text-stone-700 leading-relaxed line-clamp-5">{user.profile.summary}</p>
                </div>
              )}
            </div>
          )}

          {/* Recent jobs */}
          {user.jobs.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <p className="text-xs text-stone-400 font-mono uppercase tracking-wider mb-3">
                Jobs{user._count.jobs > user.jobs.length ? ` (showing ${user.jobs.length} of ${user._count.jobs})` : ` (${user._count.jobs})`}
              </p>
              <div className="space-y-0">
                {user.jobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-stone-700">{job.company}</p>
                      <p className="text-xs text-stone-400 font-mono">{job.role}</p>
                    </div>
                    <span className="text-xs text-stone-400 font-mono bg-stone-50 px-2 py-0.5 rounded border border-stone-100">
                      {job.stage.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
