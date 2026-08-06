import { loadKnowledgeBase } from "../knowledgeBase/loader.js";
import type { KnowledgeChunk, RetrievedChunk } from "../types.js";
import { TfidfIndex, tokenize } from "./tfidf.js";

/** Similarity below this is treated as "not relevant enough" — the caller
 * must fall back to an explicit "not covered in provided materials" answer
 * rather than let the LLM improvise from its own training data. */
export const RELEVANCE_THRESHOLD = 0.08;

const TOP_K = 5;
const METADATA_BOOST_PER_HIT = 0.05;

export class Retriever {
  private index = new TfidfIndex();
  private chunksById = new Map<string, KnowledgeChunk>();

  constructor(chunks: KnowledgeChunk[] = loadKnowledgeBase()) {
    this.index.build(
      chunks.map((c) => ({
        // Index the chunk text plus its metadata so a query mentioning an
        // act name, section number, or topic tag verbatim scores higher.
        id: c.id,
        text: [c.text, c.act, c.section, c.source, ...c.topic].join(" "),
      })),
    );
    for (const c of chunks) this.chunksById.set(c.id, c);
  }

  /** Retrieves the top-K most relevant chunks for a query, with a small
   * metadata boost when query tokens literally match a chunk's topic tags
   * or act/short-name — this keeps precision high for narrow legal queries
   * like "DPDP consent" or "Article 17". */
  retrieve(query: string, topK = TOP_K): RetrievedChunk[] {
    const ranked = this.index.query(query, Math.max(topK * 3, topK));
    const queryTokens = new Set(tokenize(query));

    const boosted = ranked.map(({ id, score }) => {
      const chunk = this.chunksById.get(id);
      if (!chunk) return null;

      let boost = 0;
      const metadataTokens = new Set(
        tokenize([chunk.act, chunk.section, ...chunk.topic].join(" ")),
      );
      for (const t of metadataTokens) {
        if (queryTokens.has(t)) boost += METADATA_BOOST_PER_HIT;
      }

      return { ...chunk, score: score + boost };
    });

    return boosted
      .filter((c): c is RetrievedChunk => c !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /** True when nothing retrieved clears the relevance bar — the trigger for
   * an explicit "not covered in provided materials" fallback. */
  isGrounded(retrieved: RetrievedChunk[]): boolean {
    return retrieved.length > 0 && retrieved[0].score >= RELEVANCE_THRESHOLD;
  }
}

let sharedRetriever: Retriever | null = null;

export function getRetriever(): Retriever {
  if (!sharedRetriever) sharedRetriever = new Retriever();
  return sharedRetriever;
}
