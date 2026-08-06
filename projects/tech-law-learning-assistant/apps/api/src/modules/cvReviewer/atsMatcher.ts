import type { JobPosting } from "../../types.js";

export interface AtsMatchResult {
  jobId: string;
  jobTitle: string;
  score: number; // 0-100
  matchedKeywords: string[];
  missingKeywords: string[];
  missingMustHave: string[];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Phrase-presence keyword match — CV keywords in this domain are mostly
 * multi-word terms ("data protection impact assessment", "records of
 * processing"), so a simple normalized substring check is more reliable
 * for an MVP than a bag-of-words/token overlap approach. */
function cvContainsKeyword(cvTextNormalized: string, keyword: string): boolean {
  return cvTextNormalized.includes(normalize(keyword));
}

export function matchAgainstJob(cvText: string, job: JobPosting): AtsMatchResult {
  const cvNormalized = normalize(cvText);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of job.keywords) {
    if (cvContainsKeyword(cvNormalized, kw)) matched.push(kw);
    else missing.push(kw);
  }

  const missingMustHave = job.mustHave.filter((kw) => !cvContainsKeyword(cvNormalized, kw));

  const score = job.keywords.length === 0 ? 0 : Math.round((matched.length / job.keywords.length) * 100);

  return {
    jobId: job.id,
    jobTitle: job.title,
    score,
    matchedKeywords: matched,
    missingKeywords: missing,
    missingMustHave,
  };
}

/** Matches a CV against every sample posting and returns results sorted by
 * score, best match first — this drives both the headline ATS score and
 * the keyword-gap detail shown to the student. */
export function matchAgainstAllJobs(cvText: string, jobs: JobPosting[]): AtsMatchResult[] {
  return jobs
    .map((job) => matchAgainstJob(cvText, job))
    .sort((a, b) => b.score - a.score);
}
