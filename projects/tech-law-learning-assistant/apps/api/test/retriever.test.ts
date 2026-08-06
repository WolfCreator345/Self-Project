import { describe, expect, it } from "vitest";
import { Retriever, RELEVANCE_THRESHOLD } from "../src/retrieval/retriever.js";
import type { KnowledgeChunk } from "../src/types.js";

const fixtures: KnowledgeChunk[] = [
  {
    id: "dpdp-s6",
    act: "DPDP",
    source: "Digital Personal Data Protection Act, 2023",
    jurisdiction: "India",
    section: "Section 6",
    topic: ["consent", "lawful basis"],
    text: "Consent must be free, specific, informed, unconditional and unambiguous, and may be withdrawn at any time.",
    verified: false,
  },
  {
    id: "gdpr-art17",
    act: "GDPR",
    source: "General Data Protection Regulation",
    jurisdiction: "EU",
    section: "Article 17",
    topic: ["right to erasure", "data subject rights"],
    text: "The right to be forgotten entitles a data subject to obtain erasure of personal data without undue delay.",
    verified: false,
  },
  {
    id: "iso27701-overview",
    act: "ISO",
    source: "ISO/IEC 27701:2019",
    jurisdiction: "International",
    section: "Clause 5",
    topic: ["PIMS", "privacy management"],
    text: "ISO/IEC 27701 extends ISO/IEC 27001 to establish a Privacy Information Management System.",
    verified: false,
  },
];

describe("Retriever", () => {
  it("ranks the chunk whose topic/content matches the query highest", () => {
    const retriever = new Retriever(fixtures);
    const results = retriever.retrieve("What are the requirements for valid consent?");
    expect(results[0].id).toBe("dpdp-s6");
  });

  it("boosts a chunk when the query names its act/section explicitly", () => {
    const retriever = new Retriever(fixtures);
    const results = retriever.retrieve("Explain GDPR Article 17 right to erasure");
    expect(results[0].id).toBe("gdpr-art17");
  });

  it("reports not grounded for a query unrelated to the knowledge base", () => {
    const retriever = new Retriever(fixtures);
    const results = retriever.retrieve("What is the offside rule in football?");
    expect(retriever.isGrounded(results)).toBe(false);
  });

  it("reports grounded for a query that is clearly covered", () => {
    const retriever = new Retriever(fixtures);
    const results = retriever.retrieve("Tell me about ISO 27701 privacy information management system");
    expect(retriever.isGrounded(results)).toBe(true);
    expect(results[0].score).toBeGreaterThanOrEqual(RELEVANCE_THRESHOLD);
  });

  it("returns an empty list for an empty query", () => {
    const retriever = new Retriever(fixtures);
    expect(retriever.retrieve("")).toEqual([]);
  });
});
