"use client";

import { useState, useEffect } from "react";
import { UserRole, SubscriptionStatus } from "@prisma/client";
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
}: {
  onClose: () => void;
  onInvited: (user: UserRow) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("USER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || null, role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to invite user");
      }
      const user = await res.json();
      onInvited(user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[100]" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4">
        <div className="bg-[var(--scout-surface)] rounded-none border border-[rgba(17,17,17,0.14)] shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-5">
            <h2
              className="text-base font-semibold text-[#1A1A1A]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Invite user
            </h2>
            <button
              onClick={onClose}
              className="text-[var(--scout-muted)] hover:text-[#52493F] w-7 h-7 flex items-center justify-center rounded-none hover:bg-[var(--scout-inset)] text-lg leading-none"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] mb-1.5">Email *</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full text-sm bg-[var(--scout-inset)] border border-[rgba(17,17,17,0.14)] rounded-none px-3 py-2 outline-none focus:ring-1 focus:ring-stone-300 placeholder:text-[var(--scout-muted)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] mb-1.5">Name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full text-sm bg-[var(--scout-inset)] border border-[rgba(17,17,17,0.14)] rounded-none px-3 py-2 outline-none focus:ring-1 focus:ring-stone-300 placeholder:text-[var(--scout-muted)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] mb-1.5">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full text-sm bg-[var(--scout-inset)] border border-[rgba(17,17,17,0.14)] rounded-none px-3 py-2 outline-none focus:ring-1 focus:ring-stone-300 font-[family-name:var(--font-mono-ui)]"
              >
                <option value="USER">user</option>
                <option value="COACH">coach</option>
                <option value="ADMIN">admin</option>
              </select>
            </div>
            {error && <p className="text-xs text-red-600 font-[family-name:var(--font-mono-ui)]">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-[var(--scout-muted)] px-4 py-2 rounded-none hover:bg-[var(--scout-inset)] border border-[rgba(17,17,17,0.14)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="text-sm bg-[#1A3A2F] text-[#E8D5A3] px-4 py-2 rounded-none hover:opacity-90 disabled:opacity-50 font-medium"
              >
                {loading ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
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

  function handleInvited(newUser: UserRow) {
    setUsers((prev) => {
      const exists = prev.find((u) => u.id === newUser.id);
      if (exists) return prev.map((u) => (u.id === newUser.id ? { ...u, ...newUser } : u));
      return [
        {
          ...newUser,
          monthlyUsage: [],
          jobs: [],
          _count: { jobs: 0 },
          subscription: null,
          profile: null,
        },
        ...prev,
      ];
    });
  }

  return (
    <>
      <div className="bg-[var(--scout-surface)] rounded-none border border-[rgba(17,17,17,0.14)] overflow-hidden">
        {/* Controls */}
        <div className="px-6 py-4 border-b border-[rgba(17,17,17,0.08)] space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-[var(--scout-inset)] border border-[rgba(17,17,17,0.14)] rounded-none px-3 py-2 outline-none focus:ring-1 focus:ring-stone-300 placeholder:text-[var(--scout-muted)]"
            />
            <div className="flex items-center gap-1 text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] shrink-0">
              <span>Sort:</span>
              {(["date", "jobs"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`px-2 py-1 rounded-none ${sort === s ? "bg-[var(--scout-inset)] text-[#52493F]" : "hover:bg-[var(--scout-inset)]"}`}
                >
                  {s === "date" ? "newest" : "most jobs"}
                </button>
              ))}
            </div>
            {canEdit && (
              <button
                onClick={() => setShowInvite(true)}
                className="shrink-0 text-xs bg-[#1A3A2F] text-[#E8D5A3] px-3 py-2 rounded-none hover:opacity-90 font-medium"
              >
                + Invite
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Role filter */}
            <div className="flex items-center gap-1">
              {ROLE_FILTERS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-2 py-0.5 rounded-none border text-xs font-[family-name:var(--font-mono-ui)] transition-colors ${
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
                  className={`px-2 py-0.5 rounded-none border text-xs font-[family-name:var(--font-mono-ui)] transition-colors ${
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
                    <span className={`inline-block text-xs font-[family-name:var(--font-mono-ui)] px-2 py-0.5 rounded-none border ${ROLE_STYLES[user.role]}`}>
                      {user.role.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-[var(--scout-muted)] text-xs font-[family-name:var(--font-mono-ui)] whitespace-nowrap">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-6 py-3">
                    {user.subscription ? (
                      <span className={`inline-block text-xs font-[family-name:var(--font-mono-ui)] px-2 py-0.5 rounded-none border ${STATUS_STYLES[user.subscription.status]}`}>
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
                className="text-xs px-3 py-1.5 rounded-none border border-[rgba(17,17,17,0.14)] text-[var(--scout-muted)] hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed font-[family-name:var(--font-mono-ui)]"
              >
                ← prev
              </button>
              <span className="text-xs text-[var(--scout-muted)] font-[family-name:var(--font-mono-ui)] px-2">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="text-xs px-3 py-1.5 rounded-none border border-[rgba(17,17,17,0.14)] text-[var(--scout-muted)] hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed font-[family-name:var(--font-mono-ui)]"
              >
                next →
              </button>
            </div>
          </div>
        )}
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={handleInvited}
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
