import Link from "next/link";
import type { BookWithCategory } from "@/lib/books";
import { addedAgo } from "@/lib/utils";
import { Availability } from "./Availability";
import { BookCover } from "./BookCover";

/** Whole card is clickable via the title link's ::after overlay; focus ring shows on the card. */
export function BookCard({ book, href, now }: { book: BookWithCategory; href: string; now?: Date }) {
  return (
    <article className="relative flex h-full flex-col rounded-3xl bg-white p-3 shadow-soft ring-1 ring-ink/5 transition-shadow focus-within:ring-3 focus-within:ring-navy hover:shadow-lift">
      <BookCover title={book.title} coverUrl={book.coverUrl} />
      <div className="flex flex-1 flex-col gap-2 px-1 pt-3 pb-1">
        <span className="w-fit rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-medium text-navy">
          {book.category.name}
        </span>
        <h3 className="line-clamp-2 text-base/snug font-semibold text-ink">
          <Link
            href={href}
            scroll={false}
            className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none"
          >
            {book.title}
          </Link>
        </h3>
        <p className="line-clamp-1 text-sm text-ink-soft">{book.author}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <Availability available={book.available} copies={book.copies} />
          <span className="text-xs text-ink-soft">{addedAgo(book.createdAt, now)}</span>
        </div>
      </div>
    </article>
  );
}
