import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "../lib/api";
import type {
  ConsentStatus,
  DataPrincipal,
  Purpose,
  WireConsentArtifact,
  WireConsentLedgerEntry,
} from "../lib/types";

const STATUSES: ConsentStatus[] = ["granted", "withdrawn", "expired"];

export function ConsentStatusView() {
  const [statusFilter, setStatusFilter] = useState<ConsentStatus | "">("");
  const [purposeFilter, setPurposeFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const principalsQuery = useQuery({
    queryKey: ["principals"],
    queryFn: () => apiGet<DataPrincipal[]>("/principals"),
  });
  const purposesQuery = useQuery({
    queryKey: ["purposes"],
    queryFn: () => apiGet<Purpose[]>("/purposes"),
  });

  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (purposeFilter) params.set("purposeId", purposeFilter);
  const artifactsQuery = useQuery({
    queryKey: ["consent-artifacts", statusFilter, purposeFilter],
    queryFn: () => apiGet<WireConsentArtifact[]>(`/consent-artifacts?${params.toString()}`),
  });

  const ledgerQuery = useQuery({
    queryKey: ["consent-artifacts", selectedId, "ledger"],
    queryFn: () => apiGet<WireConsentLedgerEntry[]>(`/consent-artifacts/${selectedId}/ledger`),
    enabled: selectedId !== null,
  });

  const principalById = new Map((principalsQuery.data ?? []).map((p) => [p.id, p]));
  const purposeById = new Map((purposesQuery.data ?? []).map((p) => [p.id, p]));

  return (
    <div>
      <h2>Consent Status</h2>

      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <label>
          Status:{" "}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ConsentStatus | "")}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Purpose:{" "}
          <select value={purposeFilter} onChange={(e) => setPurposeFilter(e.target.value)}>
            <option value="">All</option>
            {(purposesQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.description}
              </option>
            ))}
          </select>
        </label>
      </div>

      {artifactsQuery.isLoading && <p>Loading…</p>}
      {artifactsQuery.isError && <p style={{ color: "crimson" }}>Failed to load consent artifacts.</p>}

      {artifactsQuery.data && (
        <table border={1} cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Principal</th>
              <th>Purpose</th>
              <th>Status</th>
              <th>Granted at</th>
            </tr>
          </thead>
          <tbody>
            {artifactsQuery.data.map((artifact) => (
              <tr
                key={artifact.id}
                onClick={() => setSelectedId(artifact.id)}
                style={{ cursor: "pointer", background: selectedId === artifact.id ? "#eef" : undefined }}
              >
                <td>{principalById.get(artifact.principalId)?.name ?? artifact.principalId}</td>
                <td>{purposeById.get(artifact.purposeId)?.description ?? artifact.purposeId}</td>
                <td>{artifact.status}</td>
                <td>{new Date(artifact.grantedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedId && (
        <div style={{ marginTop: 16, border: "1px solid #ccc", padding: 12 }}>
          <h3>Ledger history — {selectedId}</h3>
          {ledgerQuery.isLoading && <p>Loading…</p>}
          {ledgerQuery.data && (
            <table border={1} cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>Sequence</th>
                  <th>Entry type</th>
                  <th>Recorded at</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {ledgerQuery.data.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.sequence}</td>
                    <td>{entry.entryType}</td>
                    <td>{new Date(entry.recordedAt).toLocaleString()}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{entry.hash.slice(0, 12)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
