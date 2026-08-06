const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `Request failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface SourceRef {
  id: string;
  act: string;
  source: string;
  section: string;
  verified?: boolean;
}

export interface ConceptExplainerResponse {
  answer: string;
  grounded: boolean;
  sources: SourceRef[];
  unverifiedCitations: string[];
  disclaimer: string;
}

export function askConceptExplainer(question: string, depth: "basic" | "advanced") {
  return postJson<ConceptExplainerResponse>("/api/concept-explainer/ask", { question, depth });
}

export interface SocraticResponse {
  reply: string;
  sources: SourceRef[];
  turnsRemembered: number;
}

export function askSocratic(sessionId: string, message: string) {
  return postJson<SocraticResponse>("/api/socratic/ask", { sessionId, message });
}

export interface CvGap {
  gap: string;
  detail: string;
  suggestedProject: string;
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
  atsScore: number;
  bestMatchJobTitle: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  gaps: CvGap[];
  perJobMatches: JobMatch[];
}

export function reviewCvText(cvText: string) {
  return postJson<CvReviewResponse>("/api/cv-reviewer/analyze", { cvText });
}

export async function reviewCvFile(file: File): Promise<CvReviewResponse> {
  const form = new FormData();
  form.append("cv", file);
  const res = await fetch(`${API_BASE_URL}/api/cv-reviewer/analyze`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `Request failed with ${res.status}`);
  }
  return res.json();
}
