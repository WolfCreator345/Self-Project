import { PrismaConsentRepository } from "./prisma-consent.repository";
import { PrismaDSRRepository } from "./prisma-dsr.repository";
import { PrismaLedgerRepository } from "./prisma-ledger.repository";
import { PrismaService } from "../prisma/prisma.service";

export interface RealRepositories {
  prisma: PrismaService;
  consent: PrismaConsentRepository;
  dsr: PrismaDSRRepository;
  ledger: PrismaLedgerRepository;
}

/**
 * Manually wires the three Prisma-backed repositories without NestJS's DI
 * container, for consumers (mcp-server/, jobs/) that import this file
 * directly via tsx rather than running inside a Nest application. This
 * works because the repository classes don't actually need Nest's
 * reflection-based injection to function — they just take their
 * dependencies as plain constructor arguments, exactly like apps/api's own
 * Jest tests already do (`new PrismaConsentRepository(prisma, ledger)`).
 * `@Injectable()` is a harmless no-op decorator outside a Nest container.
 *
 * mock-store's `createSeededStore()` returns one object satisfying all
 * three repository interfaces; this returns three separate instances
 * instead (see the README's Phase 5 notes on why) — callers reference
 * `.consent`/`.dsr`/`.ledger` rather than a single combined object.
 */
export async function createRealRepositories(): Promise<RealRepositories> {
  const prisma = new PrismaService();
  await prisma.$connect();
  const ledger = new PrismaLedgerRepository(prisma);
  const consent = new PrismaConsentRepository(prisma, ledger);
  const dsr = new PrismaDSRRepository(prisma, ledger);
  return { prisma, consent, dsr, ledger };
}
