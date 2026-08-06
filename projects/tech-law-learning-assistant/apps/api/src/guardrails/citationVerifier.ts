import type { RetrievedChunk } from "../types.js";

/** Patterns that look like a statute/standard/treaty citation in generated
 * text. Deliberately broad — false positives just get double-checked
 * against the retrieved context and cost nothing; false negatives are the
 * real risk (an unguarded hallucinated citation slipping through). */
const CITATION_PATTERNS: RegExp[] = [
  /\bSections?\s+\d+[A-Za-z]?(\s*(-|to|–)\s*\d+[A-Za-z]?)?\b/gi,
  /\bArticles?\s+\d+[A-Za-z]?(\(\d+\))?(\([a-z]\))?(\s*(-|to|–)\s*\d+[A-Za-z]?)?\b/gi,
  /\bClauses?\s+\d+(\.\d+)*\b/gi,
  /\bRules?\s+\d+[A-Za-z]?\b/gi,
  /\bISO\/?\s?IEC\s?\d{4,5}(:\d{4})?\b/gi,
  /\bSchedule\b/gi,
];

export interface CitationCheckResult {
  /** Citation strings found in the generated text that DO appear (loosely
   * normalized) in at least one retrieved chunk's section metadata or body. */
  verified: string[];
  /** Citation strings found in the generated text that could NOT be matched
   * against the retrieved context — the model may be citing from its own
   * training data rather than the grounded material, which is exactly the
   * hallucination risk this tool exists to prevent. */
  unverified: string[];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Extracts citation-like substrings from generated text. */
export function extractCitations(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of CITATION_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const m of matches) {
      const trimmed = m[0].trim();
      // Skip bare "Schedule" mentions with no number — too generic to check.
      if (/^schedule$/i.test(trimmed)) continue;
      found.add(trimmed);
    }
  }
  return [...found];
}

/** Verifies each citation extracted from `generatedText` actually appears
 * in the retrieved context (chunk `section` field or chunk body). This is
 * a post-generation check, not a substitute for grounding the prompt in
 * context — it's the last line of defense against a fabricated citation
 * reaching the student. */
export function verifyCitations(
  generatedText: string,
  retrievedChunks: RetrievedChunk[],
): CitationCheckResult {
  const citations = extractCitations(generatedText);
  const haystack = retrievedChunks
    .map((c) => normalize(`${c.section} ${c.text} ${c.act}`))
    .join(" | ");

  const verified: string[] = [];
  const unverified: string[] = [];

  for (const citation of citations) {
    const needle = normalize(citation);
    if (haystack.includes(needle)) {
      verified.push(citation);
    } else {
      unverified.push(citation);
    }
  }

  return { verified, unverified };
}
