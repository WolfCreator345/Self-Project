import { useState } from "react";
import Disclaimer from "./components/Disclaimer.js";
import ConceptExplainer from "./components/ConceptExplainer.js";
import SocraticDialogue from "./components/SocraticDialogue.js";
import CvReviewer from "./components/CvReviewer.js";

type Tab = "concept" | "socratic" | "cv";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "concept", label: "Concept Explainer" },
  { id: "socratic", label: "Socratic Dialogue" },
  { id: "cv", label: "CV Reviewer" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("concept");

  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <h1 className="text-lg font-semibold text-ink-900">
            Tech Law Learning &amp; Placement Assistant
          </h1>
          <p className="text-xs text-slate-500">NFSU LL.M. (Cyber Law &amp; Cyber Forensic Investigation)</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <Disclaimer />

        <nav className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                tab === t.id ? "bg-white text-ink-900 shadow" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {tab === "concept" && <ConceptExplainer />}
          {tab === "socratic" && <SocraticDialogue />}
          {tab === "cv" && <CvReviewer />}
        </section>
      </main>
    </div>
  );
}
