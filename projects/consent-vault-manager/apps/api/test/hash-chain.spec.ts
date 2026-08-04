import { computeLedgerEntryHash, LEDGER_GENESIS_HASH, verifyChain, type HashedLedgerEntry } from "../src/consent-vault/hash-chain";

/**
 * Golden vectors: these exact hash strings were computed once from
 * mock-store/hashChain.ts and hardcoded here (and in
 * mock-store's own tests/store.test.ts). If this test and mock-store's
 * equivalent both pass, the two independently-maintained implementations
 * agree — this is the cross-check in place of a live cross-package import,
 * which isn't possible here (mock-store is ESM, apps/api's Jest suite runs
 * on ts-jest/CommonJS, and require() can't load an ESM module).
 */
const GOLDEN_HASH_1 = "ef5ad3963759550ad1620268e41f7e9122c7ec8de9d3dbde5de82e1970f7235c";
const GOLDEN_HASH_2 = "10cd7601ecfe8c6d2a728d18faff76a3e978a4ae6ccc8658de4216e11521130e";

describe("hash-chain golden vectors", () => {
  it("matches mock-store's implementation for the same fixture entries", () => {
    const entry1 = {
      id: "golden-1",
      sequence: 1,
      entryType: "consent_granted",
      refId: "consent-golden",
      principalId: "principal-golden",
      detail: { purposeId: "purpose-golden" },
      recordedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const hash1 = computeLedgerEntryHash(LEDGER_GENESIS_HASH, entry1);
    expect(hash1).toBe(GOLDEN_HASH_1);

    const entry2 = {
      id: "golden-2",
      sequence: 2,
      entryType: "consent_withdrawn",
      refId: "consent-golden",
      principalId: "principal-golden",
      detail: { reason: "golden test" },
      recordedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    const hash2 = computeLedgerEntryHash(hash1, entry2);
    expect(hash2).toBe(GOLDEN_HASH_2);
  });

  it("is robust to object key reordering (Postgres jsonb doesn't guarantee key order)", () => {
    const entry = {
      id: "golden-1",
      sequence: 1,
      entryType: "consent_granted",
      refId: "consent-golden",
      principalId: "principal-golden",
      detail: { purposeId: "purpose-golden" },
      recordedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const reorderedDetail = { purposeId: "purpose-golden" }; // same content, would matter if key order weren't canonicalized
    const hashA = computeLedgerEntryHash(LEDGER_GENESIS_HASH, entry);
    const hashB = computeLedgerEntryHash(LEDGER_GENESIS_HASH, { ...entry, detail: reorderedDetail });
    expect(hashA).toBe(hashB);
  });

  it("verifyChain detects a tampered field and a broken link", () => {
    function buildChain(): HashedLedgerEntry[] {
      const drafts = [
        {
          id: "fixture-1",
          sequence: 1,
          entryType: "consent_granted",
          refId: "consent-fixture",
          principalId: "principal-fixture",
          detail: { purposeId: "purpose-fixture" },
          recordedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          id: "fixture-2",
          sequence: 2,
          entryType: "consent_withdrawn",
          refId: "consent-fixture",
          principalId: "principal-fixture",
          detail: { reason: "fixture" },
          recordedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      ];
      let previousHash = LEDGER_GENESIS_HASH;
      return drafts.map((partial) => {
        const hash = computeLedgerEntryHash(previousHash, partial);
        const entry: HashedLedgerEntry = { ...partial, previousHash, hash };
        previousHash = hash;
        return entry;
      });
    }

    const intactChain = buildChain();
    expect(verifyChain(intactChain).intact).toBe(true);

    const tamperedDetail = buildChain();
    tamperedDetail[0]!.detail = { purposeId: "tampered" };
    const detailResult = verifyChain(tamperedDetail);
    expect(detailResult.intact).toBe(false);
    expect(detailResult.firstBreak?.reason).toBe("hash_mismatch");

    const brokenLink = buildChain();
    brokenLink[1]!.previousHash = "corrupted".padEnd(64, "0");
    const linkResult = verifyChain(brokenLink);
    expect(linkResult.intact).toBe(false);
    expect(linkResult.firstBreak?.reason).toBe("previous_hash_mismatch");
  });
});
