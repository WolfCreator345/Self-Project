import { beforeEach, describe, expect, it } from "vitest";
import { appendTurn, clearAllSessions, getRecentTurns } from "../src/modules/socraticDialogue/memoryStore.js";

describe("socratic memoryStore", () => {
  beforeEach(() => clearAllSessions());

  it("returns an empty list for an unseen session", () => {
    expect(getRecentTurns("unknown-session")).toEqual([]);
  });

  it("remembers turns for a session", () => {
    appendTurn("s1", { role: "student", content: "What is consent?" });
    appendTurn("s1", { role: "assistant", content: "What do you think 'freely given' requires?" });
    const turns = getRecentTurns("s1");
    expect(turns).toHaveLength(2);
    expect(turns[0].content).toBe("What is consent?");
  });

  it("bounds memory to the last 2-3 turns of dialogue, not unbounded history", () => {
    for (let i = 0; i < 10; i++) {
      appendTurn("s2", { role: "student", content: `student turn ${i}` });
      appendTurn("s2", { role: "assistant", content: `assistant turn ${i}` });
    }
    const turns = getRecentTurns("s2");
    expect(turns.length).toBeLessThanOrEqual(6);
    // most recent turn should be preserved
    expect(turns[turns.length - 1].content).toBe("assistant turn 9");
  });

  it("keeps sessions independent", () => {
    appendTurn("a", { role: "student", content: "from a" });
    appendTurn("b", { role: "student", content: "from b" });
    expect(getRecentTurns("a")).toHaveLength(1);
    expect(getRecentTurns("b")).toHaveLength(1);
    expect(getRecentTurns("a")[0].content).toBe("from a");
  });
});
