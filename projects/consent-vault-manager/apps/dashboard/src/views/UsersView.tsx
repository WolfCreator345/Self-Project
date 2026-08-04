import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthContext";
import { apiGet, apiPost, apiPut, ApiError } from "../lib/api";
import type { Role, WireUser } from "../lib/types";

const ROLES: Role[] = ["admin", "dpo", "viewer"];

/**
 * Phase 8: team management, admin-only — the API rejects everything here
 * with 403 for a dpo/viewer session, so this view double-checks the role
 * client-side too, to fail closed with a clear message rather than a
 * confusing screenful of failed requests.
 */
export function UsersView() {
  const { role, fiduciaryName } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ username: "", password: "", role: "viewer" as Role });
  const [formError, setFormError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<WireUser[]>("/users"),
    enabled: role === "admin",
  });

  const createMutation = useMutation({
    mutationFn: () => apiPost<WireUser>("/users", form),
    onSuccess: () => {
      setForm({ username: "", password: "", role: "viewer" });
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Failed to create user"),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => apiPut<WireUser>(`/users/${id}/role`, { role }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  if (role !== "admin") {
    return (
      <div>
        <h2>Team</h2>
        <p>Only an admin can view or manage this fiduciary's team.</p>
      </div>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate();
  }

  return (
    <div>
      <h2>Team — {fiduciaryName}</h2>
      <p style={{ color: "#555" }}>
        Everyone here can sign in and act within this fiduciary alone — accounts in other fiduciaries are never
        visible from here, and this list only ever shows your own.
      </p>

      {usersQuery.isLoading && <p>Loading…</p>}
      {usersQuery.isError && <p style={{ color: "crimson" }}>Failed to load users.</p>}

      {usersQuery.data && (
        <table border={1} cellPadding={6} style={{ borderCollapse: "collapse", width: "100%", marginBottom: 24 }}>
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.data.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.role}</td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                  <select
                    value={user.role}
                    disabled={roleMutation.isPending}
                    onChange={(e) => roleMutation.mutate({ id: user.id, role: e.target.value as Role })}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Add a team member</h3>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label>
          Username
          <br />
          <input
            type="text"
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </label>
        <label>
          Password
          <br />
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <label>
          Role
          <br />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Adding…" : "Add"}
        </button>
      </form>
      {formError && <p style={{ color: "crimson" }}>{formError}</p>}
    </div>
  );
}
