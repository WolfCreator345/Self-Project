import type { JobPosting } from "../../types.js";

/** A small, representative sample of real-world privacy / tech-law job
 * postings, hand-curated from the kind of language that actually shows up
 * in Indian and global privacy/GRC/legal-tech listings. This is MVP seed
 * data — the brief's v2 backlog calls for live job-feed integration; this
 * module is written so swapping in a live feed only means replacing this
 * file's data source, not the matching/gap logic downstream. */
export const SAMPLE_JOB_POSTINGS: JobPosting[] = [
  {
    id: "privacy-analyst",
    title: "Privacy Analyst",
    company: "Sample Fintech Co.",
    keywords: [
      "DPDP Act", "GDPR", "data mapping", "RoPA", "records of processing",
      "consent management", "DPIA", "data protection impact assessment",
      "privacy policy", "data subject rights", "vendor risk assessment",
      "third-party risk", "breach notification", "ISO 27701", "cross-border transfer",
    ],
    mustHave: ["DPDP Act", "GDPR", "DPIA"],
  },
  {
    id: "dpo-associate",
    title: "Data Protection Associate",
    company: "Sample Consulting LLP",
    keywords: [
      "DPDP Act", "GDPR", "RoPA", "records of processing", "consent management",
      "DPIA", "privacy by design", "ISO 27701", "ISO 42001", "regulatory research",
      "data subject access request", "grievance redressal", "breach notification",
      "contract review", "standard contractual clauses", "SCCs",
    ],
    mustHave: ["DPDP Act", "RoPA", "consent management"],
  },
  {
    id: "privacy-counsel",
    title: "Legal Counsel — Data Privacy",
    company: "Sample SaaS Inc.",
    keywords: [
      "GDPR", "DPDP Act", "contract review", "data processing agreement", "DPA",
      "cross-border transfer", "standard contractual clauses", "SCCs",
      "privacy policy drafting", "regulatory research", "breach notification",
      "IT Act", "IPR", "intellectual property", "compliance advisory",
    ],
    mustHave: ["GDPR", "contract review", "data processing agreement"],
  },
  {
    id: "grc-analyst-cyber",
    title: "GRC Analyst — Cyber & Privacy",
    company: "Sample Bank",
    keywords: [
      "ISO 27701", "ISO 27001", "ISO 42001", "risk assessment", "DPIA",
      "vendor risk assessment", "third-party risk", "security audit",
      "incident response", "breach notification", "DPDP Act", "policy drafting",
      "training and awareness", "control mapping",
    ],
    mustHave: ["ISO 27701", "risk assessment", "DPIA"],
  },
  {
    id: "privacy-consultant",
    title: "Privacy Consultant (Entry-Level)",
    company: "Sample Legal-Tech Startup",
    keywords: [
      "DPDP Act", "GDPR", "consent management", "consent flow", "DPIA", "RoPA",
      "data mapping", "privacy by design", "ISO 27701", "client advisory",
      "gap assessment", "readiness assessment", "training and awareness",
    ],
    mustHave: ["DPDP Act", "gap assessment", "consent management"],
  },
  {
    id: "ai-governance-associate",
    title: "AI Governance & Compliance Associate",
    company: "Sample AI Startup",
    keywords: [
      "ISO 42001", "AI governance", "AI risk assessment", "DPDP Act", "GDPR",
      "algorithmic accountability", "model risk", "DPIA", "bias assessment",
      "responsible AI", "policy drafting", "regulatory research",
    ],
    mustHave: ["ISO 42001", "AI governance", "DPIA"],
  },
];
