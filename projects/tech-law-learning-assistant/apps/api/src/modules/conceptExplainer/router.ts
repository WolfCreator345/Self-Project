import { Router } from "express";
import { getRetriever } from "../../retrieval/retriever.js";
import { verifyCitations } from "../../guardrails/citationVerifier.js";
import { askClaude } from "../../llm/claudeClient.js";
import type { ConceptExplainerRequest, ConceptExplainerResponse } from "../../types.js";
import {
  buildConceptExplainerSystemPrompt,
  buildConceptExplainerUserMessage,
  notCoveredFallback,
} from "./promptBuilder.js";

export const conceptExplainerRouter = Router();

const GROUNDING_DISCLAIMER =
  "Answer grounded in the MVP curriculum knowledge base loaded into this tool " +
  "(sample/summarized content — verify exact statutory wording independently).";

conceptExplainerRouter.post("/ask", async (req, res) => {
  const body = req.body as ConceptExplainerRequest;
  const question = (body.question ?? "").trim();
  const depth = body.depth === "advanced" ? "advanced" : "basic";

  if (!question) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  const retriever = getRetriever();
  const retrieved = retriever.retrieve(question);
  const grounded = retriever.isGrounded(retrieved);

  if (!grounded) {
    const response: ConceptExplainerResponse = {
      answer: notCoveredFallback(),
      grounded: false,
      sources: [],
      unverifiedCitations: [],
      disclaimer: GROUNDING_DISCLAIMER,
    };
    res.json(response);
    return;
  }

  try {
    const system = buildConceptExplainerSystemPrompt(depth);
    const userMessage = buildConceptExplainerUserMessage(question, retrieved);

    const answer = await askClaude({
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    const { unverified } = verifyCitations(answer, retrieved);

    const response: ConceptExplainerResponse = {
      answer,
      grounded: true,
      sources: retrieved.map((c) => ({
        id: c.id,
        act: c.act,
        source: c.source,
        section: c.section,
        verified: c.verified,
      })),
      unverifiedCitations: unverified,
      disclaimer: GROUNDING_DISCLAIMER,
    };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `LLM call failed: ${message}` });
  }
});
