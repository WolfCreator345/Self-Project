/**
 * Persists a rendered report PDF somewhere durable, returning a string that
 * identifies where it ended up — a filesystem path for a local
 * implementation, a file id or URL for a cloud-storage one. Recorded
 * verbatim in the ledger entry's `detail.reportLocation`, so callers
 * shouldn't assume anything about its shape beyond "safe to log."
 */
export interface ReportArchiver {
  store(pdf: Buffer, filename: string): Promise<string>;
}
