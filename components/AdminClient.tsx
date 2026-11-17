"use client";
import { useState } from "react";
import type { Role } from "@/lib/types";

type U = { id: string; email: string; role: Role; createdAt: string; suspended?: boolean; displayName?: string };

export function AdminClient({ initial, me }: { initial: U[]; me: string }) {
  const [users, setUsers] = useState(initial);

  async function update(userId: string, patch: { role?: Role; suspended?: boolean }) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, ...patch }),
    });
    const data = await res.json();
    if (res.ok && data.user) setUsers((us) => us.map((u) => (u.id === userId ? data.user : u)));
    else if (data.error) alert(data.error);
  }

  return (
    <div className="panel overflow-x-auto">
      <table className="table-glass w-full min-w-[560px] text-sm">
        <thead className="border-b border-white/[0.06]">
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th className="!text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-accent-blue/70 to-accent-violet/70 text-xs font-semibold text-white ring-1 ring-white/10">
                    {(u.displayName || u.email)[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      {u.displayName || u.email}
                      {u.id === me && <span className="chip !px-1.5 !py-0 text-[10px]">you</span>}
                    </div>
                    <div className="text-xs text-faint">{u.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <select
                  value={u.role}
                  disabled={u.id === me}
                  onChange={(e) => update(u.id, { role: e.target.value as Role })}
                  className="input !w-auto !py-1.5 text-[13px] disabled:opacity-50"
                >
                  <option value="user">user</option>
                  <option value="moderator">moderator</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td className="px-4 py-3">
                {u.suspended ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-300 ring-1 ring-red-500/20"><span className="h-1.5 w-1.5 rounded-full bg-current" />suspended</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/20"><span className="h-1.5 w-1.5 rounded-full bg-current" />active</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {u.id !== me && (
                  <button
                    onClick={() => update(u.id, { suspended: !u.suspended })}
                    className={u.suspended ? "btn-ghost !text-emerald-300 hover:!bg-emerald-500/10" : "btn-ghost !text-amber-300 hover:!bg-amber-500/10"}
                  >
                    {u.suspended ? "Reinstate" : "Suspend"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
