import type { BookWithCategory } from "@/lib/books";
import { addedAgo } from "@/lib/utils";
import { Availability } from "./Availability";
import { BookCover } from "./BookCover";

export function BookDetails({ book }: { book: BookWithCategory }) {
  const rows: [string, string | number | null | undefined][] = [
    ["Author", book.author],
    ["Category", book.category.name],
    ["Publisher", book.publisher],
    ["Year", book.year],
    ["ISBN", book.isbn],
    ["Shelf location", book.shelf],
    ["Copies", book.copies],
  ];
  return (
    <div>
      <div className="mx-auto w-40">
        <BookCover title={book.title} coverUrl={book.coverUrl} sizes="160px" />
      </div>
      <h2 className="mt-5 text-2xl/tight font-semibold">{book.title}</h2>
      <p className="mt-1 text-ink-soft">{book.author}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Availability available={book.available} copies={book.copies} />
        <span className="text-sm text-ink-soft">{addedAgo(book.createdAt)}</span>
      </div>
      <dl className="mt-6 divide-y divide-ink/10 rounded-2xl bg-page px-4">
        {rows
          .filter(([, v]) => v !== null && v !== undefined && v !== "")
          .map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-3">
              <dt className="text-ink-soft">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
      </dl>
      <p className="mt-5 text-sm text-ink-soft">
        To borrow this book, note the shelf location and bring your NFSU ID card to the library desk.
      </p>
    </div>
  );
}
