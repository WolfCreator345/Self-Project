import Link from "next/link";
import { NAV_LINKS, SITE } from "@/config/site";
import { MhaLogo, NfsuCrest } from "./Logos";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-ink/10 bg-white">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:px-6 lg:px-10">
        <div>
          <div className="flex items-center gap-4">
            <MhaLogo className="h-11" />
            <span className="h-10 w-px bg-gold" aria-hidden="true" />
            <NfsuCrest className="h-14" />
          </div>
          <p className="mt-5 max-w-sm text-ink-soft">
            {SITE.name}. Books, journals and e-newspapers for the students and faculty of NFSU.
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="eyebrow mb-3">Quick links</h2>
          <ul className="space-y-1">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-11 items-center text-ink hover:text-navy hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/login" className="inline-flex min-h-11 items-center text-ink hover:text-navy hover:underline">
                Staff Login
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className="eyebrow mb-3">Contact</h2>
          <p className="text-ink-soft">Library, NFSU Bhubaneswar Campus, Odisha</p>
          <a
            href={`mailto:${SITE.contactEmail}`}
            className="mt-1 inline-flex min-h-11 items-center font-medium text-navy underline-offset-4 hover:underline"
          >
            {SITE.contactEmail}
          </a>
        </div>
      </div>
      <div className="border-t border-ink/10">
        <p className="mx-auto max-w-[1440px] px-4 py-5 text-sm text-ink-soft md:px-6 lg:px-10">
          © {year} {SITE.university}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
