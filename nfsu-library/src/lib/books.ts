import type { Prisma } from "@prisma/client";
import { DEFAULT_NEWSPAPERS } from "@/config/newspapers";
import { db } from "./db";

export const PAGE_SIZE = 12;

export type BookWithCategory = Prisma.BookGetPayload<{ include: { category: true } }>;

export async function getCategories() {
  return db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function getNewArrivals(take = 12) {
  return db.book.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    include: { category: true },
  });
}

export type CatalogueQuery = {
  q?: string;
  category?: string;
  sort?: "newest" | "title";
  page?: number;
};

export async function searchBooks({ q, category, sort = "newest", page = 1 }: CatalogueQuery) {
  const term = q?.trim();
  // SQLite LIKE is case-insensitive for ASCII. On Postgres add `mode: "insensitive"`.
  const where: Prisma.BookWhereInput = {
    AND: [
      category ? { category: { slug: category } } : {},
      term
        ? {
            OR: [
              { title: { contains: term } },
              { author: { contains: term } },
              { isbn: { contains: term.replace(/[-\s]/g, "") } },
              { isbn: { contains: term } },
              { publisher: { contains: term } },
              { category: { name: { contains: term } } },
            ],
          }
        : {},
    ],
  };
  const orderBy: Prisma.BookOrderByWithRelationInput[] =
    sort === "title" ? [{ title: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }];

  const [total, books] = await Promise.all([
    db.book.count({ where }),
    db.book.findMany({
      where,
      orderBy,
      include: { category: true },
      skip: (Math.max(1, page) - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return { total, books, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getBook(id: number) {
  if (!Number.isInteger(id) || id < 1) return null;
  return db.book.findUnique({ where: { id }, include: { category: true } });
}

export async function getNewspapers() {
  const rows = await db.newspaper.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  return rows.length ? rows : DEFAULT_NEWSPAPERS.map((n, i) => ({ ...n, id: -1 - i }));
}
