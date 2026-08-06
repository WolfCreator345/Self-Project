import type { CvGap } from "../../types.js";

interface GapRule {
  /** Fires when ALL of `requires` are present in the CV and NONE of
   * `absentAny` are — i.e. "mentions DPDP but no GDPR-mapped project". */
  id: string;
  requires: string[];
  absentAll: string[];
  gap: string;
  detail: string;
  suggestedProject: string;
}

function norm(s: string): string {
  return s.toLowerCase();
}

function containsAny(cvNormalized: string, terms: string[]): boolean {
  return terms.some((t) => cvNormalized.includes(norm(t)));
}

function containsAll(cvNormalized: string, terms: string[]): boolean {
  return terms.every((t) => cvNormalized.includes(norm(t)));
}

const RULES: GapRule[] = [
  {
    id: "dpdp-without-gdpr",
    requires: ["dpdp"],
    absentAll: ["gdpr"],
    gap: "Mentions DPDP but no GDPR-mapped project",
    detail:
      "Your CV references the DPDP Act but doesn't show GDPR exposure — most privacy roles (even India-based) expect candidates to reason across both regimes, since Indian teams frequently serve EU-facing products.",
    suggestedProject:
      "Build a short DPDP-to-GDPR crosswalk memo for one process (e.g. consent capture), mapping DPDP Section 6 to GDPR Article 7 and noting where the two diverge.",
  },
  {
    id: "no-dpia-ropa",
    requires: [],
    absentAll: ["dpia", "data protection impact assessment", "ropa", "records of processing"],
    gap: "No quantified DPIA/RoPA work",
    detail:
      "There's no evidence of hands-on DPIA or RoPA (Records of Processing Activities) work — these are the two artifacts recruiters screen for first in privacy-analyst and DPO-track roles.",
    suggestedProject:
      "Build a sample RoPA workbook for a fictional mid-size company (5-8 processing activities) and a companion DPIA for one high-risk activity, following GDPR Article 30/35 and DPDP Section 8 structure.",
  },
  {
    id: "no-consent-flow",
    requires: [],
    absentAll: ["consent management", "consent flow", "consent manager"],
    gap: "No consent-flow / consent-management project",
    detail:
      "Consent lifecycle (capture, granularity, withdrawal, audit trail) is a recurring interview topic for DPDP-readiness roles, and there's nothing in the CV that demonstrates you've actually built or audited one.",
    suggestedProject:
      "Build a small consent-flow demo (a form + backend log) implementing DPDP Section 6's requirements — free, specific, informed, unambiguous consent, plus an easy withdrawal path and an auditable log entry per consent event.",
  },
  {
    id: "no-iso-standard",
    requires: [],
    absentAll: ["iso 27701", "iso 27001", "iso 42001", "iso/iec"],
    gap: "No ISO privacy/AI-management standard exposure",
    detail:
      "Recruiters for GRC-flavoured privacy roles often screen for ISO 27701 (privacy) or ISO 42001 (AI governance) familiarity — your CV shows none.",
    suggestedProject:
      "Pick one ISO/IEC 27701 Annex A control and write a short implementation note showing how a fictional company would evidence it (policy + one supporting artifact).",
  },
  {
    id: "no-breach-incident",
    requires: [],
    absentAll: ["breach notification", "incident response", "breach response"],
    gap: "No breach-notification / incident-response experience shown",
    detail:
      "Breach notification timelines (72 hours under GDPR Article 33, 'as soon as possible' plus prescribed reporting under DPDP) are a common interview scenario question — nothing on the CV signals you've worked through one.",
    suggestedProject:
      "Draft a breach-notification runbook and a sample notification letter for a fictional breach scenario, citing the applicable GDPR/DPDP timelines and required content.",
  },
  {
    id: "no-vendor-risk",
    requires: [],
    absentAll: ["vendor risk", "third-party risk", "third party risk", "sub-processor", "subprocessor"],
    gap: "No third-party / vendor risk assessment experience",
    detail:
      "Most in-house and consulting privacy roles include vendor due diligence — the CV doesn't show any third-party or vendor risk assessment work.",
    suggestedProject:
      "Build a vendor privacy risk-assessment questionnaire and score a fictional SaaS sub-processor against it, flagging any cross-border transfer or sub-processing risk.",
  },
  {
    id: "no-quantified-impact",
    requires: [],
    absentAll: [], // special-cased in code below (needs a numeric heuristic, not a keyword list)
    gap: "Achievements aren't quantified",
    detail:
      "Lines describing your privacy/compliance work read as duties rather than outcomes — recruiters and ATS scoring both respond better to numbers (e.g. 'reduced DSR response time from 20 to 5 days', 'mapped 40+ processing activities').",
    suggestedProject:
      "Rewrite 2-3 CV bullet points to lead with a quantified outcome (time saved, records mapped, risk items closed) instead of a task description.",
  },
];

/** Very rough heuristic: does the CV contain at least one bullet-style line
 * with a number near a privacy/compliance-flavoured word? This is
 * deliberately simple for the MVP rather than full NLP. */
function hasQuantifiedImpact(cvText: string): boolean {
  const lines = cvText.split(/\n/);
  const numberPattern = /\d/;
  const privacyWordPattern = /(privacy|dpdp|gdpr|dpia|ropa|consent|compliance|risk|audit|breach)/i;
  return lines.some((line) => numberPattern.test(line) && privacyWordPattern.test(line));
}

export function analyzeGaps(cvText: string): CvGap[] {
  const cvNormalized = norm(cvText);
  const gaps: CvGap[] = [];

  for (const rule of RULES) {
    if (rule.id === "no-quantified-impact") {
      if (!hasQuantifiedImpact(cvText)) {
        gaps.push({ gap: rule.gap, detail: rule.detail, suggestedProject: rule.suggestedProject });
      }
      continue;
    }

    const requiresOk = rule.requires.length === 0 || containsAll(cvNormalized, rule.requires);
    const absentOk = rule.absentAll.length === 0 || !containsAny(cvNormalized, rule.absentAll);

    if (requiresOk && absentOk) {
      gaps.push({ gap: rule.gap, detail: rule.detail, suggestedProject: rule.suggestedProject });
    }
  }

  return gaps;
}
