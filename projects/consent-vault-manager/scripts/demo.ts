import { createSeededStore } from "../mock-store/index.js";

async function main() {
  const store = createSeededStore();

  console.log("── Fiduciary ──────────────────────────────────────────────");
  console.log(await store.getFiduciary());

  const principals = await store.listPrincipals();
  const purposes = await store.listPurposes();
  console.log(`\n${principals.length} principals, ${purposes.length} purposes seeded.`);

  console.log("\n── Consent status mix ─────────────────────────────────────");
  const allConsents = await store.listConsentArtifacts();
  const byStatus = { granted: 0, withdrawn: 0, expired: 0 } as Record<string, number>;
  for (const c of allConsents) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
  console.log(byStatus);

  console.log("\n── check_consent_status(principal-1, purpose-2) ───────────");
  console.log(await store.findConsentArtifact("principal-1", "purpose-2"));

  console.log("\n── list_open_dsr_requests(overdueOnly: true) ──────────────");
  console.log(await store.listDSRRequests({ overdueOnly: true }));

  console.log("\n── create_consent_record + revoke_consent round trip ──────");
  const created = await store.createConsentArtifact({
    principalId: "principal-6",
    purposeId: "purpose-3",
    noticeVersion: "v1.3",
    language: "en",
  });
  console.log("created:", created);
  const revoked = await store.revokeConsentArtifact(created.id, "Principal requested withdrawal via helpdesk");
  console.log("revoked:", revoked);

  console.log("\n── get_compliance_snapshot(2026-01-01 .. 2026-12-31) ──────");
  console.log(
    await store.getComplianceSnapshot({
      from: new Date("2026-01-01"),
      to: new Date("2026-12-31"),
    }),
  );

  console.log(`\n── Ledger now has ${(await store.listEntries()).length} entries ──`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
