import { Controller, Get, Query } from "@nestjs/common";

import { addDays } from "./date-utils";
import { PrismaLedgerRepository } from "./prisma-ledger.repository";

const DEFAULT_SNAPSHOT_WINDOW_DAYS = 90;

/** Backs the dashboard's compliance snapshot view — the same data get_compliance_snapshot exposes over MCP. */
@Controller("compliance")
export class ComplianceController {
  constructor(private readonly ledgerRepository: PrismaLedgerRepository) {}

  @Get("snapshot")
  snapshot(@Query("from") from?: string, @Query("to") to?: string) {
    const to_ = to ? new Date(to) : new Date();
    const from_ = from ? new Date(from) : addDays(to_, -DEFAULT_SNAPSHOT_WINDOW_DAYS);
    return this.ledgerRepository.getComplianceSnapshot({ from: from_, to: to_ });
  }

  @Get("ledger-integrity")
  ledgerIntegrity(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("verifyFullChain") verifyFullChain?: string,
  ) {
    const dateRange = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    return this.ledgerRepository.verifyLedgerIntegrity(dateRange, verifyFullChain === "true");
  }

  /** The compliance snapshot's breachesLogged is just a count — this backs the dashboard's actual breach log list. */
  @Get("breach-events")
  breachEvents() {
    return this.ledgerRepository.listBreachEvents();
  }
}
