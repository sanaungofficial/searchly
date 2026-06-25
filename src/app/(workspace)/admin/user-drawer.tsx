"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { clearClientSessionCaches, setActingUserScope } from "@/lib/client-session";
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

type AiDetail = {
  totalCalls: number;
  totalCostUsd: number;
  totalTokensIn: number;
  totalTokensOut: number;
  byFeature: { feature: string; calls: number; costUsd: number }[];
};

const ROLE_OPTIONS: UserRole[] = ["USER", "COACH", "RECRUITER", "ADMIN"];

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  ACTIVE: "bg-[rgba(26,58,47,0.08)] text-[#1A3A2F] border-[rgba(26,58,47,0.2)]",
  TRIALING: "bg-blue-50 text-blue-700 border-blue-200",
  PAST_DUE: "bg-amber-50 text-amber-700 border-amber-200",
  CANCELED: "bg-[var(--scout-inset)] text-[var(--scout-muted)] border-[rgba(17,17,17,0.14)]",
  UNPAID: "bg-red-50 text-red-700 border-red-200",
  INCOMPLETE: "bg-orange-50 text-orange-700 border-orange-200",
  INCOMPLETE_EXPIRED: "bg-[var(--scout-inset)] text-[var(--scout-muted)] border-[rgba(17,17,17,0.14)]",
  PAUSED: "bg-[var(--scout-inset)] text-[var(--scout-muted)] border-[rgba(17,17,17,0.14)]",
};

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-[rgba(17,17,17,0.06)] last:border-0">
      <span className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-[#52493F] leading-relaxed">{value}</span>
    </div>
  );
}

export function UserDrawer({
  user,
  canEdit,
  onClose,
  onRoleUpdate,
}: {
  user: DrawerUser;
  canEdit: boolean;
  onClose: () => void;
  onRoleUpdate: (id: string, role: UserRole) => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [aiDetail, setAiDetail] = useState<AiDetail | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setRole(user.role);
    setAiDetail(null);
    setAiLoading(true);
    fetch(`/api/admin/users/${user.id}`)
      .then((r) => r.json())
      .then((data) => setAiDetail(data.aiSummary ?? null))
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, [user.id, user.role]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const isDirty = role !== user.role;
  const aiThisMonth = user.monthlyUsage[0]?.count ?? 0;

  async function viewAsClient() {
    setImpersonating(true);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) throw new Error("Failed");
      const body = await res.json().catch(() => ({})) as { user?: { id?: string } };
      onClose();
      clearClientSessionCaches();
      if (body.user?.id) setActingUserScope(body.user.id);
      window.location.href = "/profile";
    } catch {
      setImpersonating(false);
    }
  }

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

  const drawer = (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/25 z-[100]" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-[var(--scout-page)] border-l border-[rgba(17,17,17,0.14)] z-[101] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[rgba(17,17,17,0.14)] bg-[var(--scout-surface)]/60 backdrop-blur-sm sticky top-0 z-10">
          <div className="min-w-0 flex-1 pr-4">
            <p
              className="font-semibold text-[#1A1A1A] text-lg leading-tight truncate"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {user.name ?? "Unnamed User"}
            </p>
            <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] mt-1 truncate">{user.email}</p>
            {user.profile?.headline && (
              <p className="text-xs text-[var(--scout-muted)] mt-1 italic">{user.profile.headline}</p>
            )}
            {user.role === "USER" && (
              <button
                onClick={viewAsClient}
                disabled={impersonating}
                className="mt-3 text-xs font-semibold px-3 py-1.5 bg-[#1A3A2F] text-[#E8D5A3] border-0 rounded-none disabled:opacity-60"
              >
                {impersonating ? "Opening…" : "View as client"}
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--scout-muted)] hover:text-[#52493F] text-lg leading-none shrink-0 mt-0.5 w-7 h-7 flex items-center justify-center rounded-none hover:bg-[var(--scout-inset)]"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 flex-1">
          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[var(--scout-surface)] rounded-none border border-[rgba(17,17,17,0.14)] px-4 py-3 text-center">
              <p
                className="text-2xl font-semibold text-[#1A1A1A]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {user._count.jobs}
              </p>
              <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] mt-0.5">jobs</p>
            </div>
            <div className="bg-[var(--scout-surface)] rounded-none border border-[rgba(17,17,17,0.14)] px-4 py-3 text-center">
              <p
                className="text-2xl font-semibold text-[#1A1A1A]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {aiThisMonth}
              </p>
              <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] mt-0.5">AI / mo</p>
            </div>
            <div className="bg-[var(--scout-surface)] rounded-none border border-[rgba(17,17,17,0.14)] px-4 py-3 text-center flex flex-col items-center justify-center gap-1">
              {user.subscription ? (
                <span
                  className={`text-xs font-[family-name:var(--font-mono-ui)] px-2 py-0.5 rounded-none border ${STATUS_STYLES[user.subscription.status]}`}
                >
                  {user.subscription.status.toLowerCase()}
                </span>
              ) : (
                <span className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)]">free</span>
              )}
              <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)]">plan</p>
            </div>
          </div>

          {/* Role */}
          <div className="bg-[var(--scout-surface)] rounded-none border border-[rgba(17,17,17,0.14)] p-4">
            <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] uppercase tracking-wider mb-3">Role</p>
            {canEdit ? (
              <div className="flex items-center gap-2">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="flex-1 text-sm bg-[var(--scout-inset)] border border-[rgba(17,17,17,0.14)] rounded-none px-3 py-2 outline-none focus:ring-1 focus:ring-stone-300 font-[family-name:var(--font-mono-ui)]"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {isDirty && (
                  <button
                    onClick={handleRoleSave}
                    disabled={saving}
                    className="text-xs bg-[#1A3A2F] text-[#E8D5A3] px-4 py-2 rounded-none hover:opacity-90 disabled:opacity-50 font-[family-name:var(--font-mono-ui)] whitespace-nowrap"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                )}
                {saved && (
                  <span className="text-xs text-[#1A3A2F] font-[family-name:var(--font-mono-ui)]">Saved</span>
                )}
              </div>
            ) : (
              <span className="text-sm font-[family-name:var(--font-mono-ui)] text-[#52493F]">{user.role}</span>
            )}
          </div>

          {/* Account */}
          <div className="bg-[var(--scout-surface)] rounded-none border border-[rgba(17,17,17,0.14)] p-4">
            <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] uppercase tracking-wider mb-3">Account</p>
            <Row label="Joined" value={fmt(user.createdAt)} />
            <Row label="Attribution" value={user.profile?.attribution} />
            {user.subscription?.stripeCurrentPeriodEnd && (
              <Row label="Renews" value={fmt(user.subscription.stripeCurrentPeriodEnd)} />
            )}
            <Row label="Resume" value={user.profile?.resumeUrl ? "Uploaded ✓" : undefined} />
            {user.profile?.linkedinUrl && (
              <div className="flex items-start gap-3 py-1.5 border-b border-[rgba(17,17,17,0.06)] last:border-0">
                <span className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] w-28 shrink-0 pt-0.5">LinkedIn</span>
                <a
                  href={user.profile.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline font-[family-name:var(--font-mono-ui)] truncate"
                >
                  {user.profile.linkedinUrl.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "@")}
                </a>
              </div>
            )}
          </div>

          {/* Profile */}
          {user.profile && (
            <div className="bg-[var(--scout-surface)] rounded-none border border-[rgba(17,17,17,0.14)] p-4">
              <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] uppercase tracking-wider mb-3">Profile</p>
              <Row label="Status" value={user.profile.employmentStatus} />
              <Row label="Current comp" value={user.profile.currentSalary} />
              <Row label="Target comp" value={user.profile.targetSalary} />
              <Row label="Timeline" value={user.profile.jobTimeline} />
              {user.profile.targetRoles.length > 0 && (
                <div className="flex items-start gap-3 py-1.5 border-b border-[rgba(17,17,17,0.06)]">
                  <span className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] w-28 shrink-0 pt-0.5">Target roles</span>
                  <div className="flex flex-wrap gap-1">
                    {user.profile.targetRoles.map((r) => (
                      <span key={r} className="text-xs bg-[var(--scout-inset)] text-[#52493F] px-2 py-0.5 rounded-none font-[family-name:var(--font-mono-ui)]">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {user.profile.careerMotivation && (
                <div className="py-1.5">
                  <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] mb-1">Motivation</p>
                  <p className="text-xs text-[#52493F] leading-relaxed">{user.profile.careerMotivation}</p>
                </div>
              )}
              {user.profile.summary && (
                <div className="py-1.5 border-t border-[rgba(17,17,17,0.06)]">
                  <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] mb-1">Summary</p>
                  <p className="text-xs text-[#52493F] leading-relaxed line-clamp-5">{user.profile.summary}</p>
                </div>
              )}
            </div>
          )}

          {/* Recent jobs */}
          {user.jobs.length > 0 && (
            <div className="bg-[var(--scout-surface)] rounded-none border border-[rgba(17,17,17,0.14)] p-4">
              <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] uppercase tracking-wider mb-3">
                Jobs
                {user._count.jobs > user.jobs.length
                  ? ` (showing ${user.jobs.length} of ${user._count.jobs})`
                  : ` (${user._count.jobs})`}
              </p>
              <div>
                {user.jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between py-2 border-b border-[rgba(17,17,17,0.06)] last:border-0"
                  >
                    <div>
                      <p className="text-xs font-medium text-[#52493F]">{job.company}</p>
                      <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)]">{job.role}</p>
                    </div>
                    <span className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] bg-[var(--scout-inset)] px-2 py-0.5 rounded-none border border-[rgba(17,17,17,0.08)]">
                      {job.stage.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Usage */}
          <div className="bg-[var(--scout-surface)] rounded-none border border-[rgba(17,17,17,0.14)] p-4">
            <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] uppercase tracking-wider mb-3">AI Usage (lifetime)</p>
            {aiLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-3.5 bg-[var(--scout-inset)] rounded-none animate-pulse" />
                ))}
              </div>
            ) : aiDetail && aiDetail.totalCalls > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[var(--scout-inset)] rounded-none p-3 text-center">
                    <p
                      className="text-xl font-semibold text-[#1A1A1A]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {aiDetail.totalCalls}
                    </p>
                    <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] mt-0.5">total calls</p>
                  </div>
                  <div className="bg-[var(--scout-inset)] rounded-none p-3 text-center">
                    <p
                      className="text-xl font-semibold text-[#1A1A1A]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      ${aiDetail.totalCostUsd.toFixed(3)}
                    </p>
                    <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] mt-0.5">lifetime cost</p>
                  </div>
                </div>
                {aiDetail.byFeature.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] mb-2">By feature</p>
                    <div className="space-y-0">
                      {[...aiDetail.byFeature]
                        .sort((a, b) => b.calls - a.calls)
                        .map((f) => (
                          <div
                            key={f.feature}
                            className="flex items-center justify-between py-1.5 border-b border-[rgba(17,17,17,0.06)] last:border-0"
                          >
                            <span className="text-xs text-[#52493F] font-[family-name:var(--font-mono-ui)]">
                              {f.feature.toLowerCase().replace(/_/g, " ")}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-[var(--scout-muted)]">{f.calls}×</span>
                              <span className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] w-14 text-right">
                                ${f.costUsd.toFixed(3)}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)]">No AI usage yet</p>
            )}
          </div>

          {!canEdit && (
            <p className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] text-center pb-2">
              View only · contact super admin to make changes
            </p>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(drawer, document.body);
}
