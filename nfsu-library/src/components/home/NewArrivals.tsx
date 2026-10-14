import Link from "next/link";
import type { BookWithCategory } from "@/lib/books";
import { Icon } from "@/lib/icons";
import { BookCard } from "../BookCard";

export function NewArrivals({ books }: { books: BookWithCategory[] }) {
  const now = new Date();
  return (
    <section id="new-arrivals" aria-labelledby="arrivals-title" className="mx-auto max-w-[1440px] px-4 md:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Fresh on the shelves</p>
          <h2 id="arrivals-title" className="text-3xl font-semibold tracking-tight md:text-4xl">
            New <em className="font-serif font-normal text-navy italic">arrivals</em>
          </h2>
        </div>
        <Link href="/books?sort=newest" className="btn-outline">
          View all <Icon name="arrow-right" size={18} />
        </Link>
      </div>
      {books.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-ink-soft shadow-soft">No books yet. Check back soon.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {books.map((b) => (
            <li key={b.id} className="reveal">
              <BookCard book={b} href={`/books?book=${b.id}`} now={now} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
