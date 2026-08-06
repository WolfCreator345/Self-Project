import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.",
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Single call point for both Module 1 (direct explanation) and Module 2
 * (Socratic questioning) — they differ only in the system prompt they pass
 * in, per the brief's "two distinct system prompts on the same retrieved
 * context" design. */
export async function askClaude(params: {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
}): Promise<string> {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}
