import { LIBRARY_INFO } from "@/config/library-info";
import { SITE } from "@/config/site";
import { Icon } from "@/lib/icons";

export function InfoBand() {
  return (
    <section id="about" aria-labelledby="about-title" className="on-dark bg-ink text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:px-6 md:py-24 lg:px-10">
        <p className="mb-2 text-sm font-semibold tracking-[0.14em] text-gold uppercase">About &amp; timings</p>
        <h2 id="about-title" className="max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
          Plan your <em className="font-serif font-normal text-gold italic">visit</em>.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <h3 className="flex items-center gap-2 text-2xl">
              <Icon name="clock" className="text-gold" />
              <em className="font-serif font-normal italic">Timings</em>
            </h3>
            <dl className="mt-4 space-y-3">
              {LIBRARY_INFO.timings.map((t) => (
                <div key={t.days}>
                  <dt className="text-sm text-white/70">{t.days}</dt>
                  <dd className="text-base font-medium">{t.hours}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <h3 className="flex items-center gap-2 text-2xl">
              <Icon name="pin" className="text-gold" />
              <em className="font-serif font-normal italic">Location</em>
            </h3>
            <address className="mt-4 not-italic">
              <p className="font-medium">{LIBRARY_INFO.location.line1}</p>
              <p className="text-white/80">{LIBRARY_INFO.location.line2}</p>
              <p className="mt-3 text-sm text-white/70">{LIBRARY_INFO.location.note}</p>
            </address>
          </div>
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 md:col-span-2 lg:col-span-1">
            <h3 className="flex items-center gap-2 text-2xl">
              <Icon name="rules" className="text-gold" />
              <em className="font-serif font-normal italic">Borrowing</em>
            </h3>
            <ul className="mt-4 space-y-2.5 text-white/85">
              {LIBRARY_INFO.borrowing.map((r) => (
                <li key={r} className="flex gap-2.5">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 md:col-span-2 lg:col-span-1">
            <h3 className="flex items-center gap-2 text-2xl">
              <Icon name="mail" className="text-gold" />
              <em className="font-serif font-normal italic">Contact</em>
            </h3>
            <p className="mt-4 text-white/80">Questions about books, membership or your account? Write to us.</p>
            <a
              href={`mailto:${SITE.contactEmail}`}
              className="mt-3 inline-flex min-h-11 items-center font-medium break-all text-gold underline underline-offset-4"
            >
              {SITE.contactEmail}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
