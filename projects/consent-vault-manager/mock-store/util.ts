import type { PageParams } from "./repositories.js";

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

export function paginate<T>(items: T[], params?: PageParams): T[] {
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? items.length;
  return items.slice(offset, offset + limit);
}
