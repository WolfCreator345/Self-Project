"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Books" },
  { href: "/admin/books/new", label: "Add book" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/newspapers", label: "Newspaper links" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Staff" className="mx-auto max-w-6xl px-4 md:px-6">
      <ul className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? pathname === "/admin" || /\/edit$/.test(pathname) : pathname.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-11 items-center border-b-2 border-transparent px-3 whitespace-nowrap text-ink-soft hover:text-ink aria-[current=page]:border-navy aria-[current=page]:font-medium aria-[current=page]:text-navy"
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
