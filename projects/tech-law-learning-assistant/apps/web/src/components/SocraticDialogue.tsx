import { useMemo, useState } from "react";
import { askSocratic } from "../api.js";
import SourceList from "./SourceList.js";
import type { SourceRef } from "../api.js";

interface DisplayTurn {
  role: "student" | "assistant";
  content: string;
  sources?: SourceRef[];
}

export default function SocraticDialogue() {
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  const [turns, setTurns] = useState<DisplayTurn[]>([
    {
      role: "assistant",
      content:
        "Let's work through a tech-law concept together — I'll ask guiding questions rather than " +
        "hand you the answer. What would you like to explore? (DPDP Act, GDPR, IT Act, ISO " +
        "27701/42001, treaties, or IPR in cyberspace)",
    },
  ]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    setTurns((prev) => [...prev, { role: "student", content: trimmed }]);
    setMessage("");
    setLoading(true);
    setError(null);
    try {
      const res = await askSocratic(sessionId, trimmed);
      setTurns((prev) => [...prev, { role: "assistant", content: res.reply, sources: res.sources }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Socratic mode: the assistant asks guiding questions instead of answering directly, and
        remembers the last few turns of this conversation.
      </p>

      <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
        {turns.map((t, i) => (
          <div key={i} className={t.role === "student" ? "text-right" : "text-left"}>
            <div
              className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                t.role === "student" ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{t.content}</p>
            </div>
            {t.role === "assistant" && t.sources && t.sources.length > 0 && (
              <div className="mt-1 text-left">
                <SourceList sources={t.sources} />
              </div>
            )}
          </div>
        ))}
        {loading && <p className="text-xs text-slate-400">Thinking of a good follow-up…</p>}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ink-700 focus:outline-none"
          placeholder="Your response…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
