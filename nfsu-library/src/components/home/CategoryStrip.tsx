import Link from "next/link";
import type { Category } from "@prisma/client";
import { Icon } from "@/lib/icons";

export function CategoryStrip({ categories }: { categories: Category[] }) {
  return (
    <section aria-labelledby="categories-title" className="mx-auto max-w-[1440px] px-4 md:px-6 lg:px-10">
      <h2 id="categories-title" className="eyebrow mb-4">
        Browse by subject
      </h2>
      <ul className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {categories.map((c) => (
          <li key={c.id} className="snap-start">
            <Link
              href={`/books?category=${encodeURIComponent(c.slug)}`}
              className="flex min-h-12 items-center gap-2.5 rounded-full bg-white py-2 pr-5 pl-2 whitespace-nowrap shadow-soft ring-1 ring-ink/5 transition-[box-shadow,color] hover:text-navy hover:shadow-lift"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-navy-50 text-navy">
                <Icon name={c.icon} size={18} />
              </span>
              <span className="text-base font-medium">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
