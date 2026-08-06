import { useState } from "react";
import { askConceptExplainer, type ConceptExplainerResponse } from "../api.js";
import SourceList from "./SourceList.js";

export default function ConceptExplainer() {
  const [question, setQuestion] = useState("");
  const [depth, setDepth] = useState<"basic" | "advanced">("basic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConceptExplainerResponse | null>(null);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await askConceptExplainer(question.trim(), depth);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Ask a question grounded in the curriculum knowledge base (DPDP Act, GDPR, IT Act,
        ISO 27701/42001, Budapest Convention, WIPO, IPR in cyberspace).
      </p>

      <form onSubmit={handleAsk} className="space-y-3">
        <textarea
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-ink-700 focus:outline-none"
          rows={3}
          placeholder="e.g. What are the conditions for valid consent under the DPDP Act?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">Depth:</span>
            {(["basic", "advanced"] as const).map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDepth(d)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  depth === d
                    ? "bg-ink-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Thinking…" : "Ask"}
          </button>
        </div>
      </form>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {!result.grounded && (
            <p className="mb-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              Not covered in provided materials
            </p>
          )}
          <p className="whitespace-pre-wrap text-sm text-slate-800">{result.answer}</p>

          {result.unverifiedCitations.length > 0 && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              ⚠️ Citation(s) could not be verified against the retrieved source material —
              double-check independently: {result.unverifiedCitations.join(", ")}
            </div>
          )}

          <SourceList sources={result.sources} />
          <p className="mt-3 text-[11px] text-slate-400">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
