import Link from "next/link";
import { NewspaperCard } from "../NewspaperCard";

type Paper = { id: number; nameEn: string; nameOr: string; url: string };

export function NewspapersSection({ papers, date, heading = true }: { papers: Paper[]; date: string; heading?: boolean }) {
  return (
    <section id="newspapers" aria-labelledby={heading ? "papers-title" : undefined} aria-label={heading ? undefined : "Newspapers"}>
      {heading ? (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Odisha edition</p>
            <h2 id="papers-title" className="text-3xl font-semibold tracking-tight md:text-4xl">
              Today&apos;s <em className="font-serif font-normal text-navy italic">e-newspapers</em>
            </h2>
          </div>
          <Link href="/newspapers" className="btn-outline">
            All newspapers
          </Link>
        </div>
      ) : null}
      <ul className="grid gap-4 md:grid-cols-3">
        {papers.map((p) => (
          <li key={p.id} className="flex">
            <div className="w-full">
              <NewspaperCard nameEn={p.nameEn} nameOr={p.nameOr} url={p.url} date={date} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink-soft">
        Each button opens the newspaper&apos;s own official website in a new tab.
      </p>
    </section>
  );
}
