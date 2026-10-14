"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { NAV_LINKS } from "@/config/site";
import { Icon } from "@/lib/icons";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href.startsWith("/#")) return false;
  return pathname.startsWith(href);
}

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-0.5 rounded-full bg-white p-1.5 shadow-lift ring-1 ring-ink/5">
        {NAV_LINKS.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-full px-2 text-sm font-medium whitespace-nowrap transition-colors lg:px-4 lg:text-base ${
                  active ? "bg-navy-50 text-navy" : "text-ink-soft hover:bg-page hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
        <li className="ml-1">
          <Link href="/login" className="btn-dark min-h-11 px-3.5 text-sm whitespace-nowrap lg:px-5 lg:text-base">
            Staff Login
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const ref = useRef<HTMLDialogElement>(null);

  // Close the sheet whenever the route (or hash target) changes.
  useEffect(() => {
    ref.current?.close();
  }, [pathname]);

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white p-1 shadow-lift ring-1 ring-ink/5 md:hidden">
      <Link
        href="/books#catalogue-search"
        className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-page"
        aria-label="Search the catalogue"
      >
        <Icon name="search" />
      </Link>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-base font-medium text-white"
        aria-haspopup="dialog"
      >
        <Icon name="menu" size={18} />
        Menu
      </button>

      <dialog
        ref={ref}
        aria-label="Site menu"
        className="inset-x-0 top-auto bottom-0 m-0 h-fit max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-white p-0 text-ink shadow-lift backdrop:bg-ink/40 backdrop:backdrop-blur-sm open:animate-rise"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="p-5 pb-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-lg font-semibold">Menu</p>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="flex size-11 items-center justify-center rounded-full bg-page"
              aria-label="Close menu"
            >
              <Icon name="x" />
            </button>
          </div>
          <nav aria-label="Main (mobile)">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => ref.current?.close()}
                    aria-current={isActive(pathname, l.href) ? "page" : undefined}
                    className="flex min-h-12 items-center justify-between rounded-2xl px-4 text-lg font-medium hover:bg-page aria-[current=page]:bg-navy-50 aria-[current=page]:text-navy"
                  >
                    {l.label}
                    <Icon name="chevron-right" size={18} className="text-ink-soft" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Link href="/login" onClick={() => ref.current?.close()} className="btn-dark mt-5 w-full">
            Staff Login
          </Link>
        </div>
      </dialog>
    </div>
  );
}
