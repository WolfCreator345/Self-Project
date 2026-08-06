import { useState } from "react";
import { reviewCvFile, reviewCvText, type CvReviewResponse } from "../api.js";

export default function CvReviewer() {
  const [cvText, setCvText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CvReviewResponse | null>(null);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = file ? await reviewCvFile(file) : await reviewCvText(cvText.trim());
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
        Paste your CV text or upload a .pdf/.txt file. It's compared against a sample set of
        real privacy/tech-law job postings for an ATS-style keyword match and a gap analysis.
      </p>

      <form onSubmit={handleAnalyze} className="space-y-3">
        <textarea
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-ink-700 focus:outline-none"
          rows={6}
          placeholder="Paste CV text here…"
          value={cvText}
          onChange={(e) => {
            setCvText(e.target.value);
            if (e.target.value) setFile(null);
          }}
          disabled={!!file}
        />
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".pdf,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-600"
          />
          {file && (
            <button
              type="button"
              className="text-xs text-slate-500 underline"
              onClick={() => setFile(null)}
            >
              clear file
            </button>
          )}
          <button
            type="submit"
            disabled={loading || (!file && cvText.trim().length < 20)}
            className="ml-auto rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Analyze CV"}
          </button>
        </div>
      </form>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-slate-600">
                Closest-match role:{" "}
                <span className="font-medium text-slate-800">{result.bestMatchJobTitle}</span>
              </p>
              <p className="text-2xl font-semibold text-ink-900">{result.atsScore}%</p>
            </div>
            <p className="mt-1 text-xs text-slate-400">ATS-style keyword compatibility score</p>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Matched</p>
                <div className="flex flex-wrap gap-1">
                  {result.matchedKeywords.map((k) => (
                    <span key={k} className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Missing</p>
                <div className="flex flex-wrap gap-1">
                  {result.missingKeywords.map((k) => (
                    <span key={k} className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {result.gaps.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Gaps &amp; suggested portfolio projects</p>
              {result.gaps.map((g) => (
                <div key={g.gap} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">{g.gap}</p>
                  <p className="mt-1 text-xs text-amber-800">{g.detail}</p>
                  <p className="mt-2 text-xs text-slate-700">
                    <span className="font-semibold">Try building: </span>
                    {g.suggestedProject}
                  </p>
                </div>
              ))}
            </div>
          )}

          <details className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700">
              Fit across all sample postings
            </summary>
            <ul className="mt-2 space-y-1">
              {result.perJobMatches.map((m) => (
                <li key={m.jobId} className="flex justify-between text-xs text-slate-600">
                  <span>{m.jobTitle}</span>
                  <span className="font-medium">{m.score}%</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
