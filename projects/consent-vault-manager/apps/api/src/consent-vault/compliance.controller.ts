import { Controller, Get, Query, Req } from "@nestjs/common";
import type { Request } from "express";

import { addDays } from "./date-utils";
import { PendingBreachNoticesService } from "./pending-breach-notices.service";
import { PrismaLedgerRepository } from "./prisma-ledger.repository";

const DEFAULT_SNAPSHOT_WINDOW_DAYS = 90;

/** Backs the dashboard's compliance snapshot view — the same data get_compliance_snapshot exposes over MCP. */
@Controller("compliance")
export class ComplianceController {
  constructor(
    private readonly ledgerRepository: PrismaLedgerRepository,
    private readonly pendingBreachNotices: PendingBreachNoticesService,
  ) {}

  @Get("snapshot")
  snapshot(@Req() req: Request, @Query("from") from?: string, @Query("to") to?: string) {
    const to_ = to ? new Date(to) : new Date();
    const from_ = from ? new Date(from) : addDays(to_, -DEFAULT_SNAPSHOT_WINDOW_DAYS);
    return this.ledgerRepository.getComplianceSnapshot({ from: from_, to: to_ }, req.session.fiduciaryId);
  }

  /**
   * Deliberately NOT scoped by fiduciaryId (Phase 8) — the hash chain is
   * one global structure every tenant's entries interleave in. Its result
   * carries no tenant-specific business data (a boolean, a count, a
   * sequence number), so every authenticated user sees the whole
   * platform's chain health. See LedgerRepository.verifyLedgerIntegrity's
   * doc comment in mock-store/repositories.ts for the full reasoning.
   */
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
  breachEvents(@Req() req: Request) {
    return this.ledgerRepository.listBreachEvents({ fiduciaryId: req.session.fiduciaryId });
  }

  /**
   * Phase 7: drafted-but-unconfirmed DPB notice emails/deadlines, for
   * manual review on the dashboard. Deliberately NOT scoped by fiduciaryId
   * (Phase 8) — this reads Redis's pending-notifications queue, populated
   * by jobs/mcp-server, which stay tenant-unaware by design (see the
   * README's Phase 8 notes).
   */
  @Get("pending-breach-notices")
  pendingBreachNoticesList() {
    return this.pendingBreachNotices.list();
  }
}
