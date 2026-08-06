import type { SocraticTurn } from "../../types.js";

/** In-process short-term memory per session — the brief calls for "last
 * 2-3 turns" of conversation memory, not durable chat history, so a simple
 * bounded in-memory map is the right scope for the MVP. A production
 * deployment serving multiple instances would move this to Redis, but the
 * interface below is the seam for that swap. */
const MAX_TURNS_REMEMBERED = 3;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes of inactivity

interface SessionEntry {
  turns: SocraticTurn[];
  lastAccess: number;
}

const sessions = new Map<string, SessionEntry>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now - entry.lastAccess > SESSION_TTL_MS) sessions.delete(id);
  }
}

export function getRecentTurns(sessionId: string): SocraticTurn[] {
  pruneExpired();
  return sessions.get(sessionId)?.turns ?? [];
}

export function appendTurn(sessionId: string, turn: SocraticTurn): void {
  pruneExpired();
  const entry = sessions.get(sessionId) ?? { turns: [], lastAccess: Date.now() };
  entry.turns.push(turn);
  if (entry.turns.length > MAX_TURNS_REMEMBERED * 2) {
    // keep the last N student+assistant turn PAIRS (2-3 turns of dialogue)
    entry.turns = entry.turns.slice(-MAX_TURNS_REMEMBERED * 2);
  }
  entry.lastAccess = Date.now();
  sessions.set(sessionId, entry);
}

/** Test/ops helper — not exposed over HTTP. */
export function clearAllSessions(): void {
  sessions.clear();
}
