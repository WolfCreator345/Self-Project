import { describe, expect, it } from "vitest";
import { analyzeGaps } from "../src/modules/cvReviewer/gapAnalyzer.js";

describe("analyzeGaps", () => {
  it("flags DPDP-only CVs as missing a GDPR-mapped project", () => {
    const cv = "Worked extensively on DPDP Act compliance for an Indian fintech.";
    const gaps = analyzeGaps(cv);
    expect(gaps.some((g) => g.gap.includes("GDPR-mapped project"))).toBe(true);
  });

  it("does not flag the DPDP/GDPR gap when both are present", () => {
    const cv = "Worked on DPDP Act and GDPR compliance mapping across two regions.";
    const gaps = analyzeGaps(cv);
    expect(gaps.some((g) => g.gap.includes("GDPR-mapped project"))).toBe(false);
  });

  it("flags missing DPIA/RoPA work", () => {
    const cv = "Reviewed privacy policies and handled data subject requests.";
    const gaps = analyzeGaps(cv);
    expect(gaps.some((g) => g.gap.includes("DPIA/RoPA"))).toBe(true);
  });

  it("does not flag DPIA/RoPA gap when RoPA is mentioned", () => {
    const cv = "Built and maintained a RoPA covering 40+ processing activities.";
    const gaps = analyzeGaps(cv);
    expect(gaps.some((g) => g.gap.includes("DPIA/RoPA"))).toBe(false);
  });

  it("flags CVs with no quantified achievements", () => {
    const cv = "Responsible for privacy compliance and consent management tasks.";
    const gaps = analyzeGaps(cv);
    expect(gaps.some((g) => g.gap.includes("Achievements aren't quantified"))).toBe(true);
  });

  it("does not flag quantification gap when a bullet has a number near a privacy term", () => {
    const cv = "Reduced DSR response time from 20 days to 5 days by streamlining the consent workflow.";
    const gaps = analyzeGaps(cv);
    expect(gaps.some((g) => g.gap.includes("Achievements aren't quantified"))).toBe(false);
  });

  it("suggests a concrete portfolio project for every gap raised", () => {
    const cv = "General compliance experience.";
    const gaps = analyzeGaps(cv);
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) {
      expect(g.suggestedProject.length).toBeGreaterThan(10);
    }
  });
});
