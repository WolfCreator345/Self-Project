import Link from "next/link";
import { SearchBar } from "../SearchBar";
import { HeroBackdrop } from "./HeroBackdrop";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative -mt-[68px] overflow-hidden pt-[68px] md:-mt-[72px] md:pt-[72px] lg:-mt-[80px] lg:pt-[80px]">
      <HeroBackdrop />
      <div className="relative mx-auto max-w-[1440px] px-4 pt-12 pb-24 md:px-6 md:pt-24 md:pb-24 lg:px-10">
        <div className="max-w-3xl">
          <p className="eyebrow mb-4 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 tracking-[0.08em] backdrop-blur sm:tracking-[0.14em]">
            <span className="size-1.5 rounded-full bg-gold" aria-hidden="true" />
            NFSU Library · Bhubaneswar Campus
          </p>
          <h1 id="hero-title" className="text-[2.6rem]/[1.05] font-semibold tracking-tight text-ink sm:text-6xl/[1.04] lg:text-7xl/[1.02]">
            Where <em className="font-serif font-normal text-navy italic">evidence</em> meets knowledge.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-soft md:text-xl">
            Find books on law, forensic science, cyber security and more. Check what&apos;s new on
            the shelves and read today&apos;s Odia newspapers, all in one place.
          </p>
          <div className="mt-8 max-w-2xl">
            <SearchBar />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/#new-arrivals" className="btn-dark">
              Browse New Arrivals
            </Link>
            <Link href="/newspapers" className="btn-outline">
              Read Today&apos;s Newspaper
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
