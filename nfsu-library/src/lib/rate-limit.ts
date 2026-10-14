/**
 * Fixed-window in-memory rate limiter (per server process).
 * Stored on globalThis so route handlers and server actions share one map.
 * Good enough for a single-instance campus site; use Redis if you scale out.
 */
type Entry = { count: number; resetAt: number };
const g = globalThis as unknown as { __rateBuckets?: Map<string, Entry> };
const buckets = (g.__rateBuckets ??= new Map<string, Entry>());

export const LOGIN_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };

export function hitRateLimit(key: string, { max, windowMs } = LOGIN_LIMIT) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }
  entry.count += 1;
  return { limited: entry.count > max };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function clientIp(headers: Headers) {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
