import { Router } from "express";
import { getRetriever } from "../../retrieval/retriever.js";
import { askClaude, type ChatTurn } from "../../llm/claudeClient.js";
import type { SocraticRequest, SocraticResponse } from "../../types.js";
import { appendTurn, getRecentTurns } from "./memoryStore.js";
import {
  buildSocraticSystemPrompt,
  buildSocraticUserMessage,
  socraticNotCoveredFallback,
} from "./promptBuilder.js";

export const socraticDialogueRouter = Router();

socraticDialogueRouter.post("/ask", async (req, res) => {
  const body = req.body as SocraticRequest;
  const sessionId = (body.sessionId ?? "").trim();
  const message = (body.message ?? "").trim();

  if (!sessionId || !message) {
    res.status(400).json({ error: "sessionId and message are required" });
    return;
  }

  const priorTurns = getRecentTurns(sessionId);

  // Ground retrieval in the current message plus recent student turns, so a
  // short follow-up like "why not?" still resolves against the right topic.
  const retrievalQuery = [
    ...priorTurns.filter((t) => t.role === "student").map((t) => t.content),
    message,
  ].join(" ");

  const retriever = getRetriever();
  const retrieved = retriever.retrieve(retrievalQuery);
  const grounded = retriever.isGrounded(retrieved);

  appendTurn(sessionId, { role: "student", content: message });

  if (!grounded) {
    const reply = socraticNotCoveredFallback();
    appendTurn(sessionId, { role: "assistant", content: reply });
    const response: SocraticResponse = {
      reply,
      sources: [],
      turnsRemembered: getRecentTurns(sessionId).length,
    };
    res.json(response);
    return;
  }

  try {
    const system = buildSocraticSystemPrompt();
    const history: ChatTurn[] = priorTurns.map((t) => ({
      role: t.role === "student" ? "user" : "assistant",
      content: t.content,
    }));
    const userMessage = buildSocraticUserMessage(retrieved, message);

    const reply = await askClaude({
      system,
      messages: [...history, { role: "user", content: userMessage }],
      maxTokens: 400,
    });

    appendTurn(sessionId, { role: "assistant", content: reply });

    const response: SocraticResponse = {
      reply,
      sources: retrieved.map((c) => ({ id: c.id, act: c.act, source: c.source, section: c.section })),
      turnsRemembered: getRecentTurns(sessionId).length,
    };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `LLM call failed: ${message}` });
  }
});
