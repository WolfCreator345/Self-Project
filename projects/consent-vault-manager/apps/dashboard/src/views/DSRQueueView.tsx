import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "../lib/api";
import type { DSRStatus, DSRType, WireDSRRequest } from "../lib/types";

const TYPES: DSRType[] = ["access", "correction", "erasure", "nomination"];
const STATUSES: DSRStatus[] = ["open", "in_progress", "resolved", "overdue"];

const POLL_INTERVAL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? 30_000);

function isOverdue(request: WireDSRRequest): boolean {
  return request.status !== "resolved" && new Date(request.dueAt).getTime() < Date.now();
}

export function DSRQueueView() {
  const [typeFilter, setTypeFilter] = useState<DSRType | "">("");
  const [statusFilter, setStatusFilter] = useState<DSRStatus | "">("");

  const params = new URLSearchParams();
  if (typeFilter) params.set("type", typeFilter);
  if (statusFilter) params.set("status", statusFilter);

  const requestsQuery = useQuery({
    queryKey: ["dsr-requests", typeFilter, statusFilter],
    queryFn: () => apiGet<WireDSRRequest[]>(`/dsr-requests?${params.toString()}`),
    refetchInterval: POLL_INTERVAL_MS,
  });

  return (
    <div>
      <h2>DSR Queue</h2>

      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <label>
          Type:{" "}
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as DSRType | "")}>
            <option value="">All</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status:{" "}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DSRStatus | "")}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {requestsQuery.isLoading && <p>Loading…</p>}
      {requestsQuery.isError && <p style={{ color: "crimson" }}>Failed to load DSR requests.</p>}

      {requestsQuery.data && (
        <table border={1} cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Principal</th>
              <th>Type</th>
              <th>Status</th>
              <th>Due at</th>
            </tr>
          </thead>
          <tbody>
            {requestsQuery.data.map((request) => (
              <tr key={request.id}>
                <td>{request.principalId}</td>
                <td>{request.type}</td>
                <td>{request.status}</td>
                <td>
                  {new Date(request.dueAt).toLocaleString()}
                  {isOverdue(request) && (
                    <span
                      style={{
                        marginLeft: 8,
                        background: "crimson",
                        color: "white",
                        borderRadius: 4,
                        padding: "1px 6px",
                        fontSize: 12,
                      }}
                    >
                      OVERDUE
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
