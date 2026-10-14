import { Icon } from "@/lib/icons";

export function NewspaperCard({
  nameEn,
  nameOr,
  url,
  date,
}: {
  nameEn: string;
  nameOr: string;
  url: string;
  date: string;
}) {
  const verified = /^https:\/\//.test(url);
  return (
    <article className="glass flex flex-col rounded-3xl p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p lang="or" className="font-odia text-3xl font-semibold text-navy">
            {nameOr}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-ink">{nameEn}</h3>
        </div>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-navy-50 text-navy">
          <Icon name="newspaper" />
        </span>
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
        <Icon name="calendar" size={16} />
        <time>{date}</time>
      </p>
      <span className="my-5 h-px w-full bg-gold/50" aria-hidden="true" />
      {verified ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-auto">
          Open today&apos;s e-paper
          <Icon name="external" size={18} />
          <span className="sr-only">(opens {nameEn} official site in a new tab)</span>
        </a>
      ) : (
        <p className="mt-auto rounded-2xl bg-page p-3 text-sm text-ink-soft">Link coming soon.</p>
      )}
    </article>
  );
}
