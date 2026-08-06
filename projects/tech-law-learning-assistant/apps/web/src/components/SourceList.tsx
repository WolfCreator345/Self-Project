import type { SourceRef } from "../api.js";

export default function SourceList({ sources }: { sources: SourceRef[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Grounded in
      </p>
      <ul className="space-y-1">
        {sources.map((s) => (
          <li key={s.id} className="text-xs text-slate-600">
            <span className="font-medium text-slate-800">{s.act}</span> — {s.section}
            <span className="text-slate-400"> · {s.source}</span>
            {s.verified === false && (
              <span className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-500">
                MVP summary
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
