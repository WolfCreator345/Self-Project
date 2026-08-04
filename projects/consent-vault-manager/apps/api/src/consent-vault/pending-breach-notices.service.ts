import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";

import { REDIS_CONNECTION } from "../../../../jobs/src/config";
import type { PendingAction } from "../../../../jobs/src/pendingActions";
import { PENDING_NOTIFICATIONS_QUEUE } from "../../../../jobs/src/queues";

export interface PendingBreachNotice {
  pendingJobId: string;
  kind: "breach_notice_email" | "breach_notice_deadline";
  breachEventId: string;
  stagedAt: string;
  detail: PendingAction;
}

/**
 * Read-only view onto jobs/'s pending-notifications Redis queue, filtered to
 * breach-related drafts — backs the dashboard's "surface the drafted notice
 * and deadline... for manual review and send" requirement (Phase 7). The
 * dashboard otherwise only ever talks to Postgres through the other
 * controllers; this is the one place apps/api reads from Redis, since these
 * drafts don't exist in Postgres at all until a human confirms them (at
 * which point they show up as ordinary ConsentLedgerEntry rows instead).
 */
@Injectable()
export class PendingBreachNoticesService implements OnModuleDestroy {
  private readonly queue = new Queue<PendingAction>(PENDING_NOTIFICATIONS_QUEUE, { connection: REDIS_CONNECTION });

  async list(): Promise<PendingBreachNotice[]> {
    const jobs = await this.queue.getJobs(["waiting", "delayed"]);
    return jobs
      .filter((job) => job.data.kind === "breach_notice_email" || job.data.kind === "breach_notice_deadline")
      .map((job) => ({
        pendingJobId: job.id!,
        kind: job.data.kind as "breach_notice_email" | "breach_notice_deadline",
        breachEventId: job.data.refId,
        stagedAt: new Date(job.timestamp).toISOString(),
        detail: job.data,
      }));
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
