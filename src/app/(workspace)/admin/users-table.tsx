"use client";

import { useState } from "react";
import { UserRole, SubscriptionStatus } from "@prisma/client";
import { UserDrawer, DrawerUser } from "./user-drawer";

export type UserRow = DrawerUser;

const ROLE_STYLES: Record<UserRole, string> = {
  USER: "bg-stone-100 text-stone-600 border-stone-200",
  COACH: "bg-blue-50 text-blue-700 border-blue-200",
  RECRUITER: "bg-purple-50 text-purple-700 border-purple-200",
  ADMIN: "bg-amber-50 text-amber-700 border-amber-200",
};

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

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const ROLE_FILTERS: (UserRole | "ALL")[] = ["ALL", "USER", "COACH", "RECRUITER", "ADMIN"];
const SUB_FILTERS = ["ALL", "FREE", "PAID", "PAST_DUE"] as const;
type SubFilter = (typeof SUB_FILTERS)[number];

export function UsersTable({ users: initialUsers, canEdit }: { users: UserRow[]; canEdit: boolean }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");
  const [subFilter, setSubFilter] = useState<SubFilter>("ALL");
  const [sort, setSort] = useState<"date" | "jobs">("date");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

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

  function handleRoleUpdate(id: string, role: UserRole) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    setSelectedUser((prev) => (prev?.id === id ? { ...prev, role } : prev));
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {/* Controls */}
        <div className="px-6 py-4 border-b border-stone-100 space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-stone-300 placeholder:text-stone-400"
            />
            <div className="flex items-center gap-1 text-xs text-stone-400 font-mono shrink-0">
              <span>Sort:</span>
              {(["date", "jobs"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`px-2 py-1 rounded ${sort === s ? "bg-stone-100 text-stone-700" : "hover:bg-stone-50"}`}
                >
                  {s === "date" ? "newest" : "most jobs"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Role filter */}
            <div className="flex items-center gap-1">
              {ROLE_FILTERS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-2 py-0.5 rounded border text-xs font-mono transition-colors ${
                    roleFilter === r
                      ? r === "ALL"
                        ? "bg-stone-800 text-white border-stone-800"
                        : ROLE_STYLES[r as UserRole]
                      : "border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-500"
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
                  className={`px-2 py-0.5 rounded border text-xs font-mono transition-colors ${
                    subFilter === s
                      ? "bg-stone-800 text-white border-stone-800"
                      : "border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-500"
                  }`}
                >
                  {s.toLowerCase().replace("_", " ")}
                </button>
              ))}
            </div>

            <span className="ml-auto text-xs text-stone-400 font-mono">{filtered.length} users</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-6 py-3 text-xs text-stone-400 font-mono uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-3 text-xs text-stone-400 font-mono uppercase tracking-wider">Role</th>
                <th className="text-left px-6 py-3 text-xs text-stone-400 font-mono uppercase tracking-wider">Joined</th>
                <th className="text-left px-6 py-3 text-xs text-stone-400 font-mono uppercase tracking-wider">Plan</th>
                <th className="text-right px-6 py-3 text-xs text-stone-400 font-mono uppercase tracking-wider">AI / mo</th>
                <th className="text-right px-6 py-3 text-xs text-stone-400 font-mono uppercase tracking-wider">Jobs</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-stone-400 text-sm">
                    No users found
                  </td>
                </tr>
              )}
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className="border-b border-stone-50 last:border-0 hover:bg-stone-50/80 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3">
                    <div className="font-medium text-stone-800">{user.name ?? "—"}</div>
                    <div className="text-xs text-stone-400 font-mono">{user.email}</div>
                    {user.profile?.headline && (
                      <div className="text-xs text-stone-400 italic truncate max-w-[220px]">{user.profile.headline}</div>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-block text-xs font-mono px-2 py-0.5 rounded border ${ROLE_STYLES[user.role]}`}>
                      {user.role.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-stone-500 text-xs font-mono whitespace-nowrap">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-6 py-3">
                    {user.subscription ? (
                      <span className={`inline-block text-xs font-mono px-2 py-0.5 rounded border ${STATUS_STYLES[user.subscription.status]}`}>
                        {user.subscription.status.toLowerCase()}
                      </span>
                    ) : (
                      <span className="text-xs text-stone-300 font-mono">free</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-stone-500 text-xs">
                    {user.subscription ? (
                      <span className="text-stone-300">∞</span>
                    ) : (
                      <span className={(user.monthlyUsage[0]?.count ?? 0) >= 10 ? "text-red-500 font-semibold" : ""}>
                        {user.monthlyUsage[0]?.count ?? 0}/10
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-stone-700">{user._count.jobs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
