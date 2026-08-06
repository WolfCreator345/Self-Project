import { describe, expect, it } from "vitest";
import { matchAgainstAllJobs, matchAgainstJob } from "../src/modules/cvReviewer/atsMatcher.js";
import type { JobPosting } from "../src/types.js";

const job: JobPosting = {
  id: "test-job",
  title: "Privacy Analyst",
  company: "Test Co.",
  keywords: ["DPDP Act", "GDPR", "DPIA", "RoPA", "consent management"],
  mustHave: ["DPDP Act", "GDPR"],
};

describe("matchAgainstJob", () => {
  it("scores a CV mentioning all keywords at 100", () => {
    const cv = "Worked on DPDP Act compliance, GDPR mapping, DPIA reports, RoPA maintenance, and consent management flows.";
    const result = matchAgainstJob(cv, job);
    expect(result.score).toBe(100);
    expect(result.missingKeywords).toHaveLength(0);
    expect(result.missingMustHave).toHaveLength(0);
  });

  it("scores a CV mentioning no keywords at 0 and flags all mustHaves missing", () => {
    const cv = "Worked as a barista and managed inventory for a coffee shop.";
    const result = matchAgainstJob(cv, job);
    expect(result.score).toBe(0);
    expect(result.missingMustHave).toEqual(["DPDP Act", "GDPR"]);
  });

  it("is case-insensitive and matches multi-word phrases", () => {
    const cv = "Led a dpdp act readiness project and drafted a ropa for a mid-size company.";
    const result = matchAgainstJob(cv, job);
    expect(result.matchedKeywords).toContain("DPDP Act");
    expect(result.matchedKeywords).toContain("RoPA");
  });
});

describe("matchAgainstAllJobs", () => {
  it("sorts results best match first", () => {
    const jobs: JobPosting[] = [
      job,
      { id: "unrelated", title: "Baker", company: "Bakery", keywords: ["bread", "pastry"], mustHave: ["bread"] },
    ];
    const cv = "Experienced in DPDP Act, GDPR, DPIA, RoPA, and consent management.";
    const results = matchAgainstAllJobs(cv, jobs);
    expect(results[0].jobId).toBe("test-job");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });
});
