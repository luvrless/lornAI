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
    <div className="panel overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-faint">
          <tr>
            <th className="px-4 py-2.5">User</th>
            <th className="px-4 py-2.5">Role</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2.5">
                <div className="font-medium">{u.displayName || u.email}</div>
                <div className="text-xs text-faint">{u.email}</div>
              </td>
              <td className="px-4 py-2.5">
                <select
                  value={u.role}
                  disabled={u.id === me}
                  onChange={(e) => update(u.id, { role: e.target.value as Role })}
                  className="input !w-auto !py-1"
                >
                  <option value="user">user</option>
                  <option value="moderator">moderator</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td className="px-4 py-2.5">
                {u.suspended ? <span className="chip text-red-300">suspended</span> : <span className="chip text-emerald-300">active</span>}
              </td>
              <td className="px-4 py-2.5 text-right">
                {u.id !== me && (
                  <button
                    onClick={() => update(u.id, { suspended: !u.suspended })}
                    className="text-xs text-amber-300 hover:underline"
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
