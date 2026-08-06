/** A single legal-unit chunk in the curriculum knowledge base. */
export interface KnowledgeChunk {
  id: string;
  act: string;
  source: string;
  jurisdiction: string;
  section: string;
  topic: string[];
  text: string;
  /** false for MVP seed content — summarized by the assistant's authors, not
   *  an OCR/verbatim extract of the official gazette text. Surfaced to the
   *  user so citations are never presented as more authoritative than they are. */
  verified: boolean;
}

export interface RetrievedChunk extends KnowledgeChunk {
  score: number;
}

export type ExplanationDepth = "basic" | "advanced";

export interface ConceptExplainerRequest {
  question: string;
  depth?: ExplanationDepth;
}

export interface ConceptExplainerResponse {
  answer: string;
  grounded: boolean;
  sources: Array<Pick<KnowledgeChunk, "id" | "act" | "source" | "section" | "verified">>;
  unverifiedCitations: string[];
  disclaimer: string;
}

export interface SocraticTurn {
  role: "student" | "assistant";
  content: string;
}

export interface SocraticRequest {
  sessionId: string;
  message: string;
}

export interface SocraticResponse {
  reply: string;
  sources: Array<Pick<KnowledgeChunk, "id" | "act" | "source" | "section">>;
  turnsRemembered: number;
}

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  keywords: string[];
  mustHave: string[];
}

export interface JobMatch {
  jobId: string;
  jobTitle: string;
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  missingMustHave: string[];
}

export interface CvReviewResponse {
  /** ATS-style compatibility score (0-100) against the closest-matching
   * sample job posting. */
  atsScore: number;
  bestMatchJobTitle: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  gaps: CvGap[];
  /** Full per-posting breakdown, so the student can see fit across roles,
   * not just the single closest one. */
  perJobMatches: JobMatch[];
}

export interface CvGap {
  gap: string;
  detail: string;
  suggestedProject: string;
}
