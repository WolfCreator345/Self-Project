import Link from "next/link";
import { MhaLogo, NfsuCrest } from "./Logos";
import { DesktopNav, MobileNav } from "./Nav";

export function Header() {
  return (
    <header className="sticky top-0 z-50">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 px-4 py-3 lg:gap-3 lg:px-10">
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center rounded-xl bg-white/85 px-2 py-1 shadow-soft backdrop-blur-md"
          aria-label="NFSU Library home"
        >
          <MhaLogo className="h-8 md:h-9 lg:h-11" />
        </Link>

        <DesktopNav />
        <MobileNav />

        <Link href="/" className="flex shrink-0 items-center rounded-xl" aria-label="NFSU Library home">
          <NfsuCrest className="h-11 md:h-12 lg:h-14" />
        </Link>
      </div>
    </header>
  );
}
