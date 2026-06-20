"use client";

import { useState } from "react";
import { SubscriptionStatus } from "@prisma/client";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  subscription: { status: SubscriptionStatus; stripeCurrentPeriodEnd: Date } | null;
  _count: { jobs: number };
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

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function UsersTable({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"date" | "jobs">("date");

  const filtered = users
    .filter((u) => {
      const q = search.toLowerCase();
      return u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === "jobs") return b._count.jobs - a._count.jobs;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      {/* Controls */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-stone-100">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-stone-300 placeholder:text-stone-400"
        />
        <div className="flex items-center gap-1 text-xs text-stone-400 font-mono">
          <span>Sort:</span>
          <button
            onClick={() => setSort("date")}
            className={`px-2 py-1 rounded ${sort === "date" ? "bg-stone-100 text-stone-700" : "hover:bg-stone-50"}`}
          >
            newest
          </button>
          <button
            onClick={() => setSort("jobs")}
            className={`px-2 py-1 rounded ${sort === "jobs" ? "bg-stone-100 text-stone-700" : "hover:bg-stone-50"}`}
          >
            most jobs
          </button>
        </div>
        <span className="text-xs text-stone-400 font-mono">{filtered.length} users</span>
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100">
            <th className="text-left px-6 py-3 text-xs text-stone-400 font-mono uppercase tracking-wider">User</th>
            <th className="text-left px-6 py-3 text-xs text-stone-400 font-mono uppercase tracking-wider">Joined</th>
            <th className="text-left px-6 py-3 text-xs text-stone-400 font-mono uppercase tracking-wider">Subscription</th>
            <th className="text-right px-6 py-3 text-xs text-stone-400 font-mono uppercase tracking-wider">Jobs</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-stone-400 text-sm">
                No users found
              </td>
            </tr>
          )}
          {filtered.map((user) => (
            <tr key={user.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50">
              <td className="px-6 py-3">
                <div className="font-medium text-stone-800">{user.name ?? "—"}</div>
                <div className="text-xs text-stone-400 font-mono">{user.email}</div>
              </td>
              <td className="px-6 py-3 text-stone-500 text-xs font-mono">{formatDate(user.createdAt)}</td>
              <td className="px-6 py-3">
                {user.subscription ? (
                  <span
                    className={`inline-block text-xs font-mono px-2 py-0.5 rounded border ${STATUS_STYLES[user.subscription.status]}`}
                  >
                    {user.subscription.status.toLowerCase()}
                  </span>
                ) : (
                  <span className="text-xs text-stone-300 font-mono">free</span>
                )}
              </td>
              <td className="px-6 py-3 text-right font-mono text-stone-700">{user._count.jobs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
