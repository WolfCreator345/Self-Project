# Tech Law Learning & Placement Assistant

An AI-powered learning companion for NFSU LL.M. (Cyber Law & Cyber Forensic
Investigation) students — teaches emerging tech law through Socratic dialogue
rather than direct answers, and helps students build placement-ready CVs for
privacy / tech-law careers.

This project lives at `projects/tech-law-learning-assistant/` in this repo,
alongside the unrelated LexEdu app (`backend/`, `frontend/` at the repo root)
and the Consent Vault Manager (`projects/consent-vault-manager/`) — these are
independent projects sharing a repo, not a monorepo.

**This is a study/prep tool. It must never be used or positioned as a
real-time exam aid.**

## Status: Phase 1 — MVP (all three modules)

### Module 1 — Concept Explainer (RAG-based Q&A)
- `apps/api/src/modules/conceptExplainer/` — direct explanations grounded
  strictly in the retrieved curriculum context, with a `basic`/`advanced`
  depth toggle.
- If nothing in the knowledge base clears the relevance bar
  (`RELEVANCE_THRESHOLD` in `retrieval/retriever.ts`), the API returns an
  explicit "not covered in provided materials" response **without calling
  the LLM at all** — the strongest possible guarantee against improvising
  an answer from the model's own training data.

### Module 2 — Socratic Dialogue
- `apps/api/src/modules/socraticDialogue/` — same knowledge base and
  retrieval pipeline as Module 1, but a different system prompt
  (`promptBuilder.ts`) instructs the model to ask 1-2 guiding follow-up
  questions instead of answering directly, and to nudge at a misconception
  rather than name it.
- `memoryStore.ts` is a small in-process, per-session store bounded to the
  last ~3 turns of dialogue (with a 30-minute idle TTL) — enough for a
  follow-up to build on the student's prior response, without pretending to
  be durable chat history. A multi-instance deployment would swap this for
  Redis; the module's call sites don't change.

### Module 3 — CV Reviewer (career module)
- `apps/api/src/modules/cvReviewer/` — accepts pasted CV text or an
  uploaded `.pdf`/`.txt` file (`pdf-parse` for PDF extraction), and:
  - runs an ATS-style keyword compatibility check against a curated sample
    set of real-shaped privacy/tech-law job postings (`jobPostings.ts`),
  - flags concrete gaps (e.g. "mentions DPDP but no GDPR-mapped project",
    "no quantified DPIA/RoPA work" — `gapAnalyzer.ts`) with a rule engine,
  - suggests a specific portfolio project to close each gap (sample RoPA
    workbook, a DPIA for a fictional company, a consent-flow demo, etc).
- This module does **not** call the LLM at all — matching and gap detection
  are deterministic keyword/rule logic, which keeps it fast, free to run,
  and trivially testable. Swapping in an LLM-assisted rewrite pass is a
  natural v2 extension, not a rewrite of this module.

## Guardrail against citation hallucination

Legal accuracy is the single biggest risk in this tool. Two layers guard it:

1. **Retrieval gate** — Modules 1 and 2 only call Claude when the retriever
   finds context that clears `RELEVANCE_THRESHOLD`. Below that bar, the API
   returns a canned "not covered" response and never invokes the model.
2. **Post-generation citation check** — `apps/api/src/guardrails/citationVerifier.ts`
   extracts every "Section X", "Article Y(Z)", "ISO/IEC NNNNN", "Rule N"
   style citation from the model's answer and checks it actually appears in
   the retrieved context. Anything that doesn't match is returned in an
   `unverifiedCitations` array and rendered as a visible ⚠️ warning in the
   UI — the student is told to double-check it rather than trust it
   silently.

Neither layer is a substitute for legal review: the knowledge base itself
(`knowledge-base/sources/*.json`) is **MVP seed content** — summaries written
from general legal knowledge for demonstration purposes, not verbatim
extracts of the official gazette/regulation text (each source file is
tagged `"verified": false`, surfaced to the user as "MVP summary"). A
production deployment must replace it with ingested, verified primary-source
PDFs before this tool is used for anything beyond study/demo purposes.

## Architecture

```
knowledge-base/sources/*.json   — curated legal-unit chunks with metadata
                                   (source, act, section, topic, jurisdiction)
apps/api/                       — Node + Express + TypeScript backend
  src/knowledgeBase/loader.ts   — flattens all source files into one corpus
  src/retrieval/                — dependency-free TF-IDF + cosine-similarity
                                   retriever with a metadata-match boost
  src/guardrails/                — citation verifier (see above)
  src/llm/claudeClient.ts       — single call point for both system prompts
  src/modules/                  — one router per MVP module
apps/web/                       — React + TypeScript + Tailwind (Vite) SPA
  src/components/               — one component per module, 3-tab layout
```

**Why TF-IDF instead of pgvector/Pinecone for the MVP retriever:** the brief
calls for pgvector or Pinecone in production, but this MVP corpus is small
(a few dozen curated chunks) and the goal was a tool that runs anywhere with
just `npm install` — no database or embeddings API to provision. `Retriever`
in `retrieval/retriever.ts` is the seam: swapping in real embeddings + a
vector store means replacing that one class's internals, not any of the
module routers that call it.

## Running locally

### Backend

```bash
cd apps/api
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm install
npm run dev             # http://localhost:8787
npm test                # vitest — no API key required, nothing hits the network
```

The CV Reviewer module and the "not covered" fallback path in Modules 1-2
work with **no API key at all** — only a grounded Concept Explainer / Socratic
answer needs `ANTHROPIC_API_KEY` set.

### Frontend

```bash
cd apps/web
cp .env.example .env   # points at the API, defaults to http://localhost:8787
npm install
npm run dev              # http://localhost:5173
```

## API

| Method | Path                          | Body                                   |
|--------|-------------------------------|-----------------------------------------|
| POST   | `/api/concept-explainer/ask`  | `{ question, depth: "basic"\|"advanced" }` |
| POST   | `/api/socratic/ask`           | `{ sessionId, message }`               |
| POST   | `/api/cv-reviewer/analyze`    | `{ cvText }` **or** multipart `cv` file |
| GET    | `/health`                     | —                                       |

## v2 backlog (explicitly out of this MVP)

Comparative Law Engine · Case Study / Scenario Debates · Treaty/ISO Standard
Navigator · Reflective Writing Feedback · Mock Interview Simulator · Live
job-feed integration. See the project brief for the full "DPDP Sandbox"
longer-term vision.
