# Pitch materials

Two standalone deliverables for pitching this project — not part of the
running system, not covered by its test suites, and not something
`npm test`/`npm run typecheck` touches.

- **`consent-vault-manager-pitch.pptx`** — a 13-slide deck: the DPDP Act
  compliance problem, what the system automates, the architecture, the
  lawful-basis distinction (consent vs. legitimate use) and how it's
  enforced, the hash-chained audit ledger, the human-in-the-loop
  draft-then-confirm workflow, real dashboard screenshots, build/test
  stats, tech stack, and an 8-phase status timeline.
- **`consent-vault-manager-landing.html`** — a single self-contained HTML
  page covering the same ground in a "register of record" visual style.
  Open it directly in a browser; every asset (font, screenshots) is
  inlined, no network access required. It's also published as a Claude
  Artifact for sharing a live link.

Both were generated from the actual codebase at commit-time — the test
counts, ledger entry count, purpose/consent-artifact breakdown, and
dashboard screenshots are all real, pulled from a live run against
Postgres/Redis, not hand-written. If the system changes materially (new
phases, changed stats, a fixed Drive connector, etc.), these should be
regenerated rather than hand-edited to keep drifting — ask Claude Code to
rebuild them against the current state.
