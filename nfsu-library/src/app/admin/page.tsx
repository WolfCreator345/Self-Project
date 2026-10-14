import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Icon } from "@/lib/icons";
import { deleteBook } from "./actions";
import { ConfirmButton } from "./ConfirmButton";

export const dynamic = "force-dynamic";

const PER_PAGE = 25;
const MESSAGES: Record<string, string> = {
  added: "Book added. It now appears first in New Arrivals.",
  updated: "Book updated.",
  deleted: "Book deleted.",
};

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; saved?: string }>;
}) {
  const session = await auth();
  const { q = "", page: pageRaw, saved } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const term = q.trim().slice(0, 120);
  const where = term ? { OR: [{ title: { contains: term } }, { author: { contains: term } }, { isbn: { contains: term } }] } : {};

  const [total, thisMonth, filtered, books] = await Promise.all([
    db.book.count(),
    db.book.count({ where: { createdAt: { gte: monthStart } } }),
    db.book.count({ where }),
    db.book.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { category: true },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(filtered / PER_PAGE));
  const qs = (p: number) => `/admin?${new URLSearchParams({ ...(term ? { q: term } : {}), page: String(p) })}`;

  return (
    <div>
      {saved && MESSAGES[saved] ? (
        <p role="status" className="mb-6 rounded-2xl bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
          {MESSAGES[saved]}
        </p>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        Welcome, <em className="font-serif font-normal text-navy italic">{session?.user?.name ?? "Library Assistant"}</em>
      </h1>

      <dl className="mt-6 grid grid-cols-2 gap-4 md:max-w-lg">
        <div className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <dt className="text-sm text-ink-soft">Total books</dt>
          <dd className="mt-1 text-4xl font-semibold text-navy">{total}</dd>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
          <dt className="text-sm text-ink-soft">Added this month</dt>
          <dd className="mt-1 text-4xl font-semibold text-navy">{thisMonth}</dd>
        </div>
      </dl>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold">Books</h2>
        <div className="flex flex-wrap gap-2">
          <form action="/admin" role="search" className="flex gap-2">
            <label htmlFor="admin-q" className="sr-only">
              Search books
            </label>
            <input id="admin-q" name="q" type="search" defaultValue={term} placeholder="Title, author or ISBN" className="field w-56" />
            <button className="btn-outline px-4">Search</button>
          </form>
          <Link href="/admin/books/new" className="btn-primary px-5">
            <Icon name="plus" size={18} /> Add book
          </Link>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-3xl bg-white shadow-soft ring-1 ring-ink/5">
        <table className="w-full min-w-[720px] text-left">
          <caption className="sr-only">All books, newest first</caption>
          <thead className="border-b border-ink/10 text-sm text-ink-soft">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Title</th>
              <th scope="col" className="px-4 py-3 font-medium">Author</th>
              <th scope="col" className="px-4 py-3 font-medium">Category</th>
              <th scope="col" className="px-4 py-3 font-medium">Copies</th>
              <th scope="col" className="px-4 py-3 font-medium">Added</th>
              <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {books.map((b) => (
              <tr key={b.id} className="align-middle">
                <td className="px-4 py-2 font-medium">
                  {b.title}
                  {b.isSeed ? <span className="ml-2 rounded-full bg-gold-200/60 px-2 py-0.5 text-xs font-normal text-ink">sample</span> : null}
                </td>
                <td className="px-4 py-2 text-ink-soft">{b.author}</td>
                <td className="px-4 py-2 text-ink-soft">{b.category.name}</td>
                <td className="px-4 py-2 text-ink-soft">
                  {b.available}/{b.copies}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-ink-soft">
                  {b.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="px-2 py-2">
                  <div className="flex justify-end gap-1">
                    <Link href={`/admin/books/${b.id}/edit`} className="flex size-11 items-center justify-center rounded-full text-ink-soft hover:bg-navy-50 hover:text-navy" aria-label={`Edit ${b.title}`}>
                      <Icon name="edit" size={18} />
                    </Link>
                    <form action={deleteBook}>
                      <input type="hidden" name="id" value={b.id} />
                      <ConfirmButton
                        message={`Delete “${b.title}”? This cannot be undone.`}
                        label={`Delete ${b.title}`}
                        className="flex size-11 items-center justify-center rounded-full text-ink-soft hover:bg-crimson-50 hover:text-crimson"
                      >
                        <Icon name="trash" size={18} />
                      </ConfirmButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {books.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-soft">
                  No books found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
          {page > 1 ? <Link href={qs(page - 1)} className="btn-outline px-4">Previous</Link> : null}
          <span className="text-ink-soft">Page {page} of {pages}</span>
          {page < pages ? <Link href={qs(page + 1)} className="btn-outline px-4">Next</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}
