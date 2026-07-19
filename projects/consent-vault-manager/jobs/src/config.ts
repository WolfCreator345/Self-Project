/**
 * Demo cadence: every 2 minutes. Swap for a daily cron by setting
 * EXPIRY_SWEEP_INTERVAL_MS to 24 * 60 * 60 * 1000 (or pass a `pattern` cron
 * string instead of `every` where the sweep is registered in index.ts).
 */
export const EXPIRY_SWEEP_INTERVAL_MS = Number(process.env.EXPIRY_SWEEP_INTERVAL_MS ?? 2 * 60 * 1000);

export const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: Number(process.env.REDIS_PORT ?? 6379),
};
