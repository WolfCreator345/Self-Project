import { useQuery } from "@tanstack/react-query";

import { apiGet } from "../lib/api";
import type { ComplianceSnapshot, LedgerIntegrityReport, WireBreachEvent } from "../lib/types";

const POLL_INTERVAL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? 30_000);

export function ComplianceView() {
  const snapshotQuery = useQuery({
    queryKey: ["compliance", "snapshot"],
    queryFn: () => apiGet<ComplianceSnapshot>("/compliance/snapshot"),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const integrityQuery = useQuery({
    queryKey: ["compliance", "ledger-integrity"],
    queryFn: () => apiGet<LedgerIntegrityReport>("/compliance/ledger-integrity"),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const breachQuery = useQuery({
    queryKey: ["compliance", "breach-events"],
    queryFn: () => apiGet<WireBreachEvent[]>("/compliance/breach-events"),
    refetchInterval: POLL_INTERVAL_MS,
  });

  return (
    <div>
      <h2>Compliance Snapshot</h2>

      <div style={{ marginBottom: 16 }}>
        <strong>Ledger integrity: </strong>
        {integrityQuery.isLoading && <span>checking…</span>}
        {integrityQuery.data && (
          <span
            style={{
              background: integrityQuery.data.intact ? "green" : "crimson",
              color: "white",
              borderRadius: 4,
              padding: "2px 10px",
            }}
          >
            {integrityQuery.data.intact ? "INTACT" : "BROKEN"}
          </span>
        )}
        {integrityQuery.data && (
          <span style={{ marginLeft: 8, fontSize: 12, color: "#555" }}>
            {integrityQuery.data.verifiedFullChain ? "full chain walk" : "incremental check"}, checked{" "}
            {integrityQuery.data.entriesChecked} {integrityQuery.data.entriesChecked === 1 ? "entry" : "entries"}
          </span>
        )}
        {integrityQuery.data && !integrityQuery.data.intact && integrityQuery.data.firstBreak && (
          <p style={{ color: "crimson" }}>
            First break at sequence {integrityQuery.data.firstBreak.sequence} ({integrityQuery.data.firstBreak.reason})
          </p>
        )}
      </div>

      {snapshotQuery.isLoading && <p>Loading…</p>}
      {snapshotQuery.data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          <Stat label="Consents granted" value={snapshotQuery.data.consentsGranted} />
          <Stat label="Consents withdrawn" value={snapshotQuery.data.consentsWithdrawn} />
          <Stat label="Consents expired" value={snapshotQuery.data.consentsExpired} />
          <Stat label="DSR open" value={snapshotQuery.data.dsrOpen} />
          <Stat label="DSR overdue" value={snapshotQuery.data.dsrOverdue} />
          <Stat label="DSR resolved" value={snapshotQuery.data.dsrResolved} />
        </div>
      )}

      <h3>Breach log</h3>
      {breachQuery.isLoading && <p>Loading…</p>}
      {breachQuery.data && breachQuery.data.length === 0 && <p>No breaches logged.</p>}
      {breachQuery.data && breachQuery.data.length > 0 && (
        <table border={1} cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Description</th>
              <th>Severity</th>
              <th>Detected at</th>
              <th>DPB notify due</th>
            </tr>
          </thead>
          <tbody>
            {breachQuery.data.map((event) => (
              <tr key={event.id}>
                <td>{event.description}</td>
                <td>{event.severity}</td>
                <td>{new Date(event.detectedAt).toLocaleString()}</td>
                <td>{new Date(event.dpbNotifyDueAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 4, padding: 12 }}>
      <div style={{ fontSize: 24, fontWeight: "bold" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#555" }}>{label}</div>
    </div>
  );
}
