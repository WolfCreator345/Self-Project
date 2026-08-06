import { describe, expect, it } from "vitest";
import { extractCitations, verifyCitations } from "../src/guardrails/citationVerifier.js";
import type { RetrievedChunk } from "../src/types.js";

const context: RetrievedChunk[] = [
  {
    id: "dpdp-s6",
    act: "DPDP",
    source: "Digital Personal Data Protection Act, 2023",
    jurisdiction: "India",
    section: "Section 6",
    topic: ["consent"],
    text: "Consent must be free, specific, informed, unconditional and unambiguous.",
    verified: false,
    score: 0.5,
  },
  {
    id: "gdpr-art7",
    act: "GDPR",
    source: "General Data Protection Regulation",
    jurisdiction: "EU",
    section: "Article 7",
    topic: ["consent"],
    text: "Where processing is based on consent, the controller must be able to demonstrate consent.",
    verified: false,
    score: 0.4,
  },
];

describe("extractCitations", () => {
  it("extracts Section and Article style citations", () => {
    const text = "Under Section 6 of the DPDP Act and Article 7 of the GDPR, consent must be freely given.";
    const citations = extractCitations(text);
    expect(citations.some((c) => /section 6/i.test(c))).toBe(true);
    expect(citations.some((c) => /article 7/i.test(c))).toBe(true);
  });

  it("extracts ISO standard citations", () => {
    const text = "This is covered under ISO/IEC 27701:2019.";
    const citations = extractCitations(text);
    expect(citations.some((c) => /iso/i.test(c))).toBe(true);
  });
});

describe("verifyCitations", () => {
  it("marks a citation present in the retrieved context as verified", () => {
    const text = "Under Section 6, consent must be freely given.";
    const result = verifyCitations(text, context);
    expect(result.verified.some((c) => /section 6/i.test(c))).toBe(true);
    expect(result.unverified).toHaveLength(0);
  });

  it("flags a citation NOT present in the retrieved context as unverified — the hallucination guardrail", () => {
    const text = "This is also addressed under Section 99 of the DPDP Act, which does not exist in the context.";
    const result = verifyCitations(text, context);
    expect(result.unverified.some((c) => /section 99/i.test(c))).toBe(true);
  });

  it("flags an article number fabricated beyond what was retrieved", () => {
    const text = "GDPR Article 200 requires this.";
    const result = verifyCitations(text, context);
    expect(result.unverified.some((c) => /article 200/i.test(c))).toBe(true);
    expect(result.verified).toHaveLength(0);
  });
});
