import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { KnowledgeChunk } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// apps/api/src/knowledgeBase/loader.ts -> ../../../../knowledge-base/sources
const SOURCES_DIR = path.resolve(__dirname, "../../../../knowledge-base/sources");

interface SourceFile {
  act: string;
  source: string;
  jurisdiction: string;
  verified?: boolean;
  chunks: Array<{
    id: string;
    section: string;
    topic: string[];
    text: string;
  }>;
}

let cache: KnowledgeChunk[] | null = null;

/** Loads and flattens every knowledge-base/sources/*.json file into a single
 * list of chunks, each carrying its source-level metadata. Cached in memory
 * — this is a small, curated MVP corpus, not a production-scale index. */
export function loadKnowledgeBase(): KnowledgeChunk[] {
  if (cache) return cache;

  const files = readdirSync(SOURCES_DIR).filter((f) => f.endsWith(".json"));
  const chunks: KnowledgeChunk[] = [];

  for (const file of files) {
    const raw = readFileSync(path.join(SOURCES_DIR, file), "utf-8");
    const parsed = JSON.parse(raw) as SourceFile;
    for (const c of parsed.chunks) {
      chunks.push({
        id: c.id,
        act: parsed.act,
        source: parsed.source,
        jurisdiction: parsed.jurisdiction,
        section: c.section,
        topic: c.topic,
        text: c.text,
        verified: parsed.verified ?? false,
      });
    }
  }

  cache = chunks;
  return chunks;
}
