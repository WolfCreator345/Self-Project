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
    expect(await consentRepository.listPrincipals()).toHaveLength(10);
    expect(await consentRepository.listPurposes()).toHaveLength(5);
    expect(await consentRepository.listConsentArtifacts()).toHaveLength(14);
    expect(await consentRepository.listProcessors()).toHaveLength(6);
    expect(await consentRepository.listFiduciaries()).toHaveLength(2);
  });

  it("creates a new principal and a new purpose", async () => {
    const principal = await consentRepository.createPrincipal({
      fiduciaryId: "fiduciary-1",
      name: "Neha Kapoor",
      email: "neha.kapoor@example.com",
      isMinor: false,
    });
    expect(principal.id).toBeTruthy();
    const found = await consentRepository.findPrincipalById(principal.id);
    expect(found?.email).toBe("neha.kapoor@example.com");
    expect(await consentRepository.listPrincipals()).toHaveLength(11);

    const purpose = await consentRepository.createPurpose({
      fiduciaryId: "fiduciary-1",
      description: "Newsletter subscription",
      lawfulBasis: "consent",
      retentionPeriodDays: 400,
    });
    expect(purpose.id).toBeTruthy();
    expect(await consentRepository.listPurposes()).toHaveLength(6);
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

  it("rejects creating a consent artifact against a legitimate_use purpose", async () => {
    // purpose-3 ("Fraud prevention and security monitoring") is legitimate_use —
    // consent isn't a valid basis for it.
    await expect(
      consentRepository.createConsentArtifact({
        principalId: "principal-1",
        purposeId: "purpose-3",
        noticeVersion: "v1.3",
        language: "en",
      }),
    ).rejects.toThrow(/legitimate_use/);
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

  describe("Multi-tenant (Phase 8)", () => {
    it("scopes principals, purposes, and consent artifacts by fiduciary", async () => {
      const principalsB = await consentRepository.listPrincipals({ fiduciaryId: "fiduciary-2" });
      expect(principalsB.map((p) => p.id).sort()).toEqual(["principal-10", "principal-9"]);

      const purposesB = await consentRepository.listPurposes({ fiduciaryId: "fiduciary-2" });
      expect(purposesB.map((p) => p.id)).toEqual(["purpose-5"]);

      const consentsB = await consentRepository.listConsentArtifacts({ fiduciaryId: "fiduciary-2" });
      expect(consentsB.map((c) => c.id).sort()).toEqual(["consent-13", "consent-14"]);
    });

    it("derives a new consent artifact's fiduciaryId from its purpose", async () => {
      const artifact = await consentRepository.createConsentArtifact({
        principalId: "principal-9",
        purposeId: "purpose-5",
        noticeVersion: "v1.0",
        language: "en",
      });
      expect(artifact.fiduciaryId).toBe("fiduciary-2");
    });

    it("rejects a consent artifact linking a principal and purpose from different fiduciaries", async () => {
      await expect(
        consentRepository.createConsentArtifact({
          principalId: "principal-1", // fiduciary-1
          purposeId: "purpose-5", // fiduciary-2
          noticeVersion: "v1.0",
          language: "en",
        }),
      ).rejects.toThrow(/different fiduciaries/);
    });

    it("lists and finds fiduciaries", async () => {
      const all = await consentRepository.listFiduciaries();
      expect(all).toHaveLength(2);
      const found = await consentRepository.findFiduciaryById("fiduciary-2");
      expect(found?.name).toBe("Northbridge FinServ Pvt. Ltd.");
      expect(await consentRepository.findFiduciaryById("no-such-fiduciary")).toBeNull();
    });
  });
});
