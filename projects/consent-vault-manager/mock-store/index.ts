export * from "./types.js";
export * from "./repositories.js";
export { createSeedData, type SeedData } from "./seed.js";
export { InMemoryConsentVaultStore } from "./store.js";

import { createSeedData } from "./seed.js";
import { InMemoryConsentVaultStore } from "./store.js";

/** Convenience factory: a fresh, fully-seeded in-memory store. */
export function createSeededStore(): InMemoryConsentVaultStore {
  return new InMemoryConsentVaultStore(createSeedData());
}
