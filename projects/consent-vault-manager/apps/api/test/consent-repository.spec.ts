import { PrismaConsentRepository } from "../src/consent-vault/prisma-consent.repository";
import { PrismaLedgerRepository } from "../src/consent-vault/prisma-ledger.repository";
import { PrismaService } from "../src/prisma/prisma.service";
import { resetDatabase } from "./test-db";

describe("PrismaConsentRepository", () => {
  const prisma = new PrismaService();
  const ledger = new PrismaLedgerRepository(prisma);
  const consentRepository = new PrismaConsentRepository(prisma, ledger);

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds the expected entity counts", async () => {
    expect(await consentRepository.listPrincipals()).toHaveLength(8);
    expect(await consentRepository.listPurposes()).toHaveLength(4);
    expect(await consentRepository.listConsentArtifacts()).toHaveLength(12);
    expect(await consentRepository.listProcessors()).toHaveLength(6);
  });

  it("creates a new principal and a new purpose", async () => {
    const principal = await consentRepository.createPrincipal({
      name: "Neha Kapoor",
      email: "neha.kapoor@example.com",
      isMinor: false,
    });
    expect(principal.id).toBeTruthy();
    const found = await consentRepository.findPrincipalById(principal.id);
    expect(found?.email).toBe("neha.kapoor@example.com");
    expect(await consentRepository.listPrincipals()).toHaveLength(9);

    const purpose = await consentRepository.createPurpose({
      description: "Newsletter subscription",
      lawfulBasis: "consent",
      retentionPeriodDays: 400,
    });
    expect(purpose.id).toBeTruthy();
    expect(await consentRepository.listPurposes()).toHaveLength(5);
  });

  it("check_consent_status returns the artifact for a known principal/purpose pair", async () => {
    const found = await consentRepository.findConsentArtifact("principal-1", "purpose-2");
    expect(found?.id).toBe("consent-1");
    expect(found?.status).toBe("granted");
  });

  it("returns null for a principal/purpose pair with no artifact", async () => {
    const found = await consentRepository.findConsentArtifact("principal-1", "purpose-3");
    expect(found).toBeNull();
  });

  it("creates and then revokes a consent artifact, appending ledger entries", async () => {
    const before = await ledger.listEntries();

    const created = await consentRepository.createConsentArtifact({
      principalId: "principal-3",
      purposeId: "purpose-4",
      noticeVersion: "v1.3",
      language: "en",
    });
    expect(created.status).toBe("granted");

    const revoked = await consentRepository.revokeConsentArtifact(created.id, "test revoke");
    expect(revoked.status).toBe("withdrawn");
    expect(revoked.withdrawnAt).toBeTruthy();

    const after = await ledger.listEntries();
    expect(after.length).toBe(before.length + 2);
  });

  it("rejects revoking a consent artifact that isn't granted", async () => {
    // consent-4 is seeded as already withdrawn.
    await expect(consentRepository.revokeConsentArtifact("consent-4", "already withdrawn")).rejects.toThrow();
  });

  it("lists processors for a purpose and marks one for purge", async () => {
    const processors = await consentRepository.listProcessors({ purposeId: "purpose-4" });
    expect(processors).toHaveLength(2);

    const before = await ledger.listEntries();
    const updated = await consentRepository.markProcessorForPurge(processors[0]!.id, "test purge");
    expect(updated.status).toBe("purge_pending");

    const after = await ledger.listEntries();
    expect(after.length).toBe(before.length + 1);
  });
});
