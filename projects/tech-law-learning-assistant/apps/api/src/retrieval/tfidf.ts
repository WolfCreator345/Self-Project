/** Minimal, dependency-free TF-IDF + cosine-similarity index.
 *
 * This is the MVP retrieval layer: it runs entirely in-process so the
 * assistant works without provisioning pgvector/Pinecone or an embeddings
 * API. The knowledge base swap-in described in the project brief (pgvector
 * or Pinecone, real embedding vectors) is a drop-in replacement for this
 * module — `Retriever` in retriever.ts is the seam.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "of", "and", "or", "to", "in", "on", "for", "is", "are",
  "was", "were", "be", "been", "being", "with", "as", "by", "at", "from",
  "that", "this", "these", "those", "it", "its", "into", "than", "then",
  "so", "such", "not", "no", "does", "do", "did", "has", "have", "had",
  "can", "could", "will", "would", "should", "what", "which", "who",
  "whom", "how", "why", "when", "where", "i", "you", "he", "she", "they",
  "we", "my", "your", "their", "our",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export interface TfidfDocument {
  id: string;
  text: string;
}

interface IndexedDoc {
  id: string;
  termFreq: Map<string, number>;
  norm: number;
}

export class TfidfIndex {
  private docs: IndexedDoc[] = [];
  private idf = new Map<string, number>();
  private docCount = 0;

  build(documents: TfidfDocument[]): void {
    this.docCount = documents.length;
    const docFreq = new Map<string, number>();

    const tokenizedDocs = documents.map((d) => ({ id: d.id, tokens: tokenize(d.text) }));

    for (const { tokens } of tokenizedDocs) {
      const seen = new Set(tokens);
      for (const term of seen) {
        docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
      }
    }

    for (const [term, df] of docFreq) {
      // smoothed idf, always positive
      this.idf.set(term, Math.log((1 + this.docCount) / (1 + df)) + 1);
    }

    this.docs = tokenizedDocs.map(({ id, tokens }) => {
      const termFreq = new Map<string, number>();
      for (const term of tokens) {
        termFreq.set(term, (termFreq.get(term) ?? 0) + 1);
      }
      let normSq = 0;
      for (const [term, tf] of termFreq) {
        const weight = tf * (this.idf.get(term) ?? 0);
        normSq += weight * weight;
      }
      return { id, termFreq, norm: Math.sqrt(normSq) };
    });
  }

  /** Returns doc ids ranked by cosine similarity to the query, highest first. */
  query(text: string, topK: number): Array<{ id: string; score: number }> {
    const queryTokens = tokenize(text);
    if (queryTokens.length === 0) return [];

    const queryTf = new Map<string, number>();
    for (const term of queryTokens) {
      queryTf.set(term, (queryTf.get(term) ?? 0) + 1);
    }

    const queryWeights = new Map<string, number>();
    let queryNormSq = 0;
    for (const [term, tf] of queryTf) {
      const weight = tf * (this.idf.get(term) ?? 0);
      queryWeights.set(term, weight);
      queryNormSq += weight * weight;
    }
    const queryNorm = Math.sqrt(queryNormSq);
    if (queryNorm === 0) return [];

    const scored = this.docs.map((doc) => {
      let dot = 0;
      for (const [term, qWeight] of queryWeights) {
        const dTf = doc.termFreq.get(term);
        if (!dTf) continue;
        const dWeight = dTf * (this.idf.get(term) ?? 0);
        dot += qWeight * dWeight;
      }
      const denom = queryNorm * doc.norm;
      const score = denom === 0 ? 0 : dot / denom;
      return { id: doc.id, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
