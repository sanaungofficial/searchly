"use client";

import { useState, useEffect } from "react";
import { UserRole, SubscriptionStatus } from "@prisma/client";
import { ScoutBox } from "@/components/scout/scout-box";
import { AdminAddUserModal } from "@/components/admin/admin-add-user-modal";
import { UserDrawer, DrawerUser } from "./user-drawer";

export type UserRow = DrawerUser;

const PAGE_SIZE = 25;

const ROLE_STYLES: Record<UserRole, string> = {
  USER: "bg-[var(--scout-inset)] text-[#52493F] border-[rgba(17,17,17,0.14)]",
  COACH: "bg-blue-50 text-blue-700 border-blue-200",
  ADMIN: "bg-amber-50 text-amber-700 border-amber-200",
};

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

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const ROLE_FILTERS: (UserRole | "ALL")[] = ["ALL", "USER", "COACH", "ADMIN"];
const SUB_FILTERS = ["ALL", "FREE", "PAID", "PAST_DUE"] as const;
type SubFilter = (typeof SUB_FILTERS)[number];

function InviteModal({
  onClose,
  onInvited,
  canAssignAdmin,
}: {
  onClose: () => void;
  onInvited: (user: UserRow, meta: { warnings: string[] }) => void;
  canAssignAdmin: boolean;
}) {
  return (
    <AdminAddUserModal
      onClose={onClose}
      onCreated={onInvited}
      canAssignAdmin={canAssignAdmin}
    />
  );
}

export function UsersTable({ users: initialUsers, canEdit }: { users: UserRow[]; canEdit: boolean }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");
  const [subFilter, setSubFilter] = useState<SubFilter>("ALL");
  const [sort, setSort] = useState<"date" | "jobs">("date");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [page, setPage] = useState(1);
  const [showInvite, setShowInvite] = useState(false);
  const [createNotice, setCreateNotice] = useState<string | null>(null);

  const filtered = users
    .filter((u) => {
      const q = search.toLowerCase();
      if (q && !u.email.toLowerCase().includes(q) && !(u.name ?? "").toLowerCase().includes(q)) return false;
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (subFilter === "FREE" && u.subscription) return false;
      if (subFilter === "PAID" && u.subscription?.status !== "ACTIVE") return false;
      if (subFilter === "PAST_DUE" && u.subscription?.status !== "PAST_DUE") return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "jobs") return b._count.jobs - a._count.jobs;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, subFilter, sort]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleRoleUpdate(id: string, role: UserRole) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    setSelectedUser((prev) => (prev?.id === id ? { ...prev, role } : prev));
  }

  function handleInvited(newUser: UserRow, meta: { warnings: string[] }) {
    setUsers((prev) => {
      const exists = prev.find((u) => u.id === newUser.id);
      if (exists) {
        return prev.map((u) =>
          u.id === newUser.id
            ? {
                ...u,
                ...newUser,
                monthlyUsage: newUser.monthlyUsage ?? u.monthlyUsage,
                jobs: newUser.jobs ?? u.jobs,
                _count: newUser._count ?? u._count,
                subscription: newUser.subscription ?? u.subscription,
                profile: newUser.profile ?? u.profile,
              }
            : u,
        );
      }
      return [
        {
          ...newUser,
          monthlyUsage: newUser.monthlyUsage ?? [],
          jobs: newUser.jobs ?? [],
          _count: newUser._count ?? { jobs: 0 },
          subscription: newUser.subscription ?? null,
          profile: newUser.profile ?? null,
        },
        ...prev,
      ];
    });
    setCreateNotice(
      meta.warnings.length > 0 ? meta.warnings.join(" ") : "User account created.",
    );
  }

  return (
    <>
      {createNotice && (
        <div
          className="mb-4 text-sm leading-relaxed"
          style={{
            background: "rgba(26,58,47,0.06)",
            border: "var(--scout-border)",
            padding: "12px 16px",
            color: "#52493F",
          }}
        >
          {createNotice}
        </div>
      )}
      <ScoutBox padding={0} style={{ overflow: "hidden" }}>
        {/* Controls */}
        <div className="px-6 py-4 border-b border-[rgba(17,17,17,0.08)] space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-[var(--scout-inset)] border border-[rgba(17,17,17,0.14)] rounded-[var(--scout-radius)] px-3 py-2 outline-none focus:ring-1 focus:ring-stone-300 placeholder:text-[var(--scout-muted)]"
            />
            <div className="flex items-center gap-1 text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] shrink-0">
              <span>Sort:</span>
              {(["date", "jobs"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`px-2 py-1 rounded-[var(--scout-radius)] ${sort === s ? "bg-[var(--scout-inset)] text-[#52493F]" : "hover:bg-[var(--scout-inset)]"}`}
                >
                  {s === "date" ? "newest" : "most jobs"}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowInvite(true); setCreateNotice(null); }}
              className="shrink-0 text-xs bg-[#1A3A2F] text-[#E8D5A3] px-3 py-2 rounded-[var(--scout-radius)] hover:opacity-90 font-medium"
            >
              + Add user
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Role filter */}
            <div className="flex items-center gap-1">
              {ROLE_FILTERS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-2 py-0.5 rounded-[var(--scout-radius)] border text-xs font-[family-name:var(--font-mono-ui)] transition-colors ${
                    roleFilter === r
                      ? r === "ALL"
                        ? "bg-[#1A3A2F] text-[#E8D5A3] border-stone-800"
                        : ROLE_STYLES[r as UserRole]
                      : "border-[rgba(17,17,17,0.14)] text-[var(--scout-muted)] hover:border-stone-300 hover:text-[var(--scout-muted)]"
                  }`}
                >
                  {r.toLowerCase()}
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-stone-200 shrink-0" />

            {/* Subscription filter */}
            <div className="flex items-center gap-1">
              {SUB_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSubFilter(s)}
                  className={`px-2 py-0.5 rounded-[var(--scout-radius)] border text-xs font-[family-name:var(--font-mono-ui)] transition-colors ${
                    subFilter === s
                      ? "bg-[#1A3A2F] text-[#E8D5A3] border-stone-800"
                      : "border-[rgba(17,17,17,0.14)] text-[var(--scout-muted)] hover:border-stone-300 hover:text-[var(--scout-muted)]"
                  }`}
                >
                  {s.toLowerCase().replace("_", " ")}
                </button>
              ))}
            </div>

            <span className="ml-auto text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)]">{filtered.length} users</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(17,17,17,0.08)]">
                <th className="text-left px-6 py-3 text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-3 text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] uppercase tracking-wider">Role</th>
                <th className="text-left px-6 py-3 text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] uppercase tracking-wider">Joined</th>
                <th className="text-left px-6 py-3 text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] uppercase tracking-wider">Plan</th>
                <th className="text-right px-6 py-3 text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] uppercase tracking-wider">AI / mo</th>
                <th className="text-right px-6 py-3 text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] uppercase tracking-wider">Jobs</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-[var(--scout-muted)] text-sm">
                    No users found
                  </td>
                </tr>
              )}
              {paginated.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className="border-b border-[rgba(17,17,17,0.06)] last:border-0 hover:bg-[var(--scout-inset)]/80 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3">
                    <div className="font-medium text-[#1A1A1A]">{user.name ?? "—"}</div>
                    <div className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)]">{user.email}</div>
                    {user.profile?.headline && (
                      <div className="text-xs text-[var(--scout-muted)] italic truncate max-w-[220px]">{user.profile.headline}</div>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-block text-xs font-[family-name:var(--font-mono-ui)] px-2 py-0.5 rounded-[var(--scout-radius)] border ${ROLE_STYLES[user.role]}`}>
                      {user.role.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-[var(--scout-muted)] text-xs font-[family-name:var(--font-mono-ui)] whitespace-nowrap">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-6 py-3">
                    {user.subscription ? (
                      <span className={`inline-block text-xs font-[family-name:var(--font-mono-ui)] px-2 py-0.5 rounded-[var(--scout-radius)] border ${STATUS_STYLES[user.subscription.status]}`}>
                        {user.subscription.status.toLowerCase()}
                      </span>
                    ) : (
                      <span className="text-xs text-stone-300 font-[family-name:var(--font-mono-ui)]">free</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right font-[family-name:var(--font-mono-ui)] text-[var(--scout-muted)] text-xs">
                    {user.subscription ? (
                      <span className="text-stone-300">∞</span>
                    ) : (
                      <span className={(user.monthlyUsage[0]?.count ?? 0) >= 10 ? "text-red-500 font-semibold" : ""}>
                        {user.monthlyUsage[0]?.count ?? 0}/10
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right font-[family-name:var(--font-mono-ui)] text-[#52493F]">{user._count.jobs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-[rgba(17,17,17,0.08)] flex items-center justify-between">
            <span className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)]">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs px-3 py-1.5 rounded-[var(--scout-radius)] border border-[rgba(17,17,17,0.14)] text-[var(--scout-muted)] hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed font-[family-name:var(--font-mono-ui)]"
              >
                ← prev
              </button>
              <span className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] px-2">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="text-xs px-3 py-1.5 rounded-[var(--scout-radius)] border border-[rgba(17,17,17,0.14)] text-[var(--scout-muted)] hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed font-[family-name:var(--font-mono-ui)]"
              >
                next →
              </button>
            </div>
          </div>
        )}
      </ScoutBox>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={handleInvited}
          canAssignAdmin={canEdit}
        />
      )}

      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          canEdit={canEdit}
          onClose={() => setSelectedUser(null)}
          onRoleUpdate={handleRoleUpdate}
        />
      )}
    </>
  );
}
