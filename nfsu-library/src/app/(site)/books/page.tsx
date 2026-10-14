import type { Metadata } from "next";
import Link from "next/link";
import { BookCard } from "@/components/BookCard";
import { BookDetails } from "@/components/BookDetails";
import { BookDrawer } from "@/components/BookDrawer";
import { SearchBar } from "@/components/SearchBar";
import { getBook, getCategories, searchBooks } from "@/lib/books";
import { Icon } from "@/lib/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Collections",
  description: "Search the full NFSU Bhubaneswar library catalogue by title, author, ISBN or category.",
};

type Params = { q?: string; category?: string; sort?: string; page?: string; book?: string };

function href(base: Params, patch: Partial<Params>) {
  const merged: Params = { ...base, ...patch };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `/books?${s}` : "/books";
}

export default async function BooksPage({ searchParams }: { searchParams: Promise<Params> }) {
  const raw = await searchParams;
  const params: Params = {
    q: typeof raw.q === "string" ? raw.q.slice(0, 120) : undefined,
    category: typeof raw.category === "string" ? raw.category : undefined,
    sort: raw.sort === "title" ? "title" : undefined,
  };
  const sort = params.sort === "title" ? "title" : "newest";
  const page = Math.max(1, Number.parseInt(String(raw.page ?? "1"), 10) || 1);

  const [categories, result, drawerBook] = await Promise.all([
    getCategories(),
    searchBooks({ q: params.q, category: params.category, sort, page }),
    raw.book ? getBook(Number(raw.book)) : Promise.resolve(null),
  ]);
  const current = { ...params, page: page > 1 ? String(page) : undefined };
  const activeCat = categories.find((c) => c.slug === params.category);

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-8 pb-20 md:px-6 lg:px-10">
      <p className="eyebrow mb-2">Catalogue</p>
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
        All <em className="font-serif font-normal text-navy italic">collections</em>
      </h1>

      <div className="mt-6 max-w-2xl">
        <SearchBar id="catalogue-search" size="md" defaultValue={params.q} category={params.category} sort={params.sort} />
      </div>

      <nav aria-label="Filter by category" className="mt-6">
        <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:px-0">
          <li>
            <Link
              href={href(params, { category: undefined, page: undefined })}
              aria-current={!params.category ? "true" : undefined}
              className="flex min-h-11 items-center rounded-full bg-white px-4 whitespace-nowrap ring-1 ring-ink/10 hover:ring-navy/40 aria-[current=true]:bg-navy aria-[current=true]:text-white"
            >
              All subjects
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={href(params, { category: c.slug, page: undefined })}
                aria-current={params.category === c.slug ? "true" : undefined}
                className="flex min-h-11 items-center rounded-full bg-white px-4 whitespace-nowrap ring-1 ring-ink/10 hover:ring-navy/40 aria-[current=true]:bg-navy aria-[current=true]:text-white"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-ink-soft">
          <strong className="text-ink">{result.total}</strong> {result.total === 1 ? "book" : "books"}
          {params.q ? <> matching “{params.q}”</> : null}
          {activeCat ? <> in {activeCat.name}</> : null}
        </p>
        <div role="group" aria-label="Sort by" className="flex rounded-full bg-white p-1 ring-1 ring-ink/10">
          {(["newest", "title"] as const).map((s) => (
            <Link
              key={s}
              href={href(params, { sort: s === "title" ? "title" : undefined, page: undefined })}
              aria-current={sort === s ? "true" : undefined}
              className="flex min-h-11 items-center rounded-full px-4 text-sm font-medium text-ink-soft aria-[current=true]:bg-ink aria-[current=true]:text-white"
            >
              {s === "newest" ? "Newest first" : "Title A–Z"}
            </Link>
          ))}
        </div>
      </div>

      {result.books.length === 0 ? (
        <div className="mt-8 rounded-3xl bg-white p-10 text-center shadow-soft">
          <p className="text-lg font-medium">No books found.</p>
          <p className="mt-1 text-ink-soft">Try a shorter search, or check the spelling.</p>
          <Link href="/books" className="btn-outline mt-5">
            Clear search
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {result.books.map((b) => (
            <li key={b.id}>
              <BookCard book={b} href={href(current, { book: String(b.id) })} />
            </li>
          ))}
        </ul>
      )}

      {result.pages > 1 ? (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2">
          {page > 1 ? (
            <Link href={href(params, { page: String(page - 1) })} className="btn-outline px-4" rel="prev">
              <Icon name="chevron-left" size={18} /> Previous
            </Link>
          ) : null}
          <p className="px-3 text-ink-soft">
            Page <strong className="text-ink">{page}</strong> of {result.pages}
          </p>
          {page < result.pages ? (
            <Link href={href(params, { page: String(page + 1) })} className="btn-outline px-4" rel="next">
              Next <Icon name="chevron-right" size={18} />
            </Link>
          ) : null}
        </nav>
      ) : null}

      {drawerBook ? (
        <BookDrawer key={drawerBook.id} title={drawerBook.title} closeHref={href(current, {})}>
          <BookDetails book={drawerBook} />
        </BookDrawer>
      ) : null}
    </div>
  );
}
