"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { CATEGORY_ICON_KEYS } from "@/lib/icons";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: string };

async function requireStaff() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

function str(fd: FormData, k: string, max = 300) {
  const v = String(fd.get(k) ?? "").trim();
  return v.slice(0, max);
}

function intOrNull(v: string) {
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

function refreshPublic() {
  revalidatePath("/", "layout");
}

/* ───────────── Books ───────────── */

function parseBook(fd: FormData) {
  const errors: Record<string, string> = {};
  const title = str(fd, "title", 300);
  const author = str(fd, "author", 300);
  const isbn = str(fd, "isbn", 20).replace(/[\s-]/g, "") || null;
  const publisher = str(fd, "publisher", 200) || null;
  const shelf = str(fd, "shelf", 60) || null;
  const coverUrl = str(fd, "coverUrl", 1000) || null;
  const categoryId = Number(str(fd, "categoryId"));
  const year = intOrNull(str(fd, "year"));
  const copies = intOrNull(str(fd, "copies")) ?? 1;
  const availableRaw = intOrNull(str(fd, "available"));
  const available = availableRaw ?? copies;
  const thisYear = new Date().getFullYear();

  if (!title) errors.title = "Enter the book title.";
  if (!author) errors.author = "Enter the author.";
  if (!Number.isInteger(categoryId) || categoryId < 1) errors.categoryId = "Choose a category.";
  if (isbn && !/^(\d{9}[\dXx]|\d{13})$/.test(isbn)) errors.isbn = "ISBN should be 10 or 13 digits.";
  if (year !== null && (Number.isNaN(year) || year < 1450 || year > thisYear + 1))
    errors.year = `Enter a year between 1450 and ${thisYear + 1}.`;
  if (Number.isNaN(copies) || copies < 1 || copies > 999) errors.copies = "Copies must be between 1 and 999.";
  if (Number.isNaN(available) || available < 0 || available > copies)
    errors.available = "Available must be between 0 and the number of copies.";
  if (coverUrl) {
    try {
      const u = new URL(coverUrl);
      if (u.protocol !== "https:") errors.coverUrl = "Cover URL must start with https://";
    } catch {
      errors.coverUrl = "Enter a full image link, e.g. https://…/cover.jpg";
    }
  }
  return {
    errors,
    data: { title, author, isbn: isbn?.toUpperCase() ?? null, publisher, shelf, coverUrl, categoryId, year, copies, available },
  };
}

export async function saveBook(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = Number(fd.get("id") ?? 0);
  const { errors, data } = parseBook(fd);
  if (Object.keys(errors).length) return { error: "Please fix the highlighted fields.", fieldErrors: errors };
  if (!(await db.category.findUnique({ where: { id: data.categoryId } })))
    return { error: "Please fix the highlighted fields.", fieldErrors: { categoryId: "Choose a category." } };

  if (id) {
    await db.book.update({ where: { id }, data });
  } else {
    await db.book.create({ data });
  }
  refreshPublic();
  redirect(`/admin?saved=${id ? "updated" : "added"}`);
}

export async function deleteBook(fd: FormData) {
  await requireStaff();
  const id = Number(fd.get("id"));
  if (Number.isInteger(id) && id > 0) {
    await db.book.delete({ where: { id } }).catch(() => null);
    refreshPublic();
  }
  redirect("/admin?saved=deleted");
}

/* ───────────── Categories ───────────── */

function parseIcon(v: string) {
  return (CATEGORY_ICON_KEYS as readonly string[]).includes(v) ? v : "book";
}

export async function addCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const name = str(fd, "name", 80);
  if (!name) return { fieldErrors: { name: "Enter a category name." } };
  const slug = slugify(name);
  if (!slug) return { fieldErrors: { name: "Use letters or numbers in the name." } };
  const max = await db.category.aggregate({ _max: { sortOrder: true } });
  try {
    await db.category.create({
      data: { name, slug, icon: parseIcon(str(fd, "icon")), sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { fieldErrors: { name: "A category with this name already exists." } };
    throw e;
  }
  refreshPublic();
  return { ok: `Added “${name}”.` };
}

export async function updateCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = Number(fd.get("id"));
  const name = str(fd, "name", 80);
  if (!name) return { error: "Name cannot be empty." };
  try {
    await db.category.update({ where: { id }, data: { name, icon: parseIcon(str(fd, "icon")) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { error: "Another category already has this name." };
    throw e;
  }
  refreshPublic();
  return { ok: "Saved." };
}

export async function deleteCategory(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = Number(fd.get("id"));
  const count = await db.book.count({ where: { categoryId: id } });
  if (count > 0) return { error: `Move or delete its ${count} book${count > 1 ? "s" : ""} first.` };
  await db.category.delete({ where: { id } }).catch(() => null);
  refreshPublic();
  return { ok: "Deleted." };
}

/* ───────────── Newspapers ───────────── */

function parsePaper(fd: FormData) {
  const nameEn = str(fd, "nameEn", 80);
  const nameOr = str(fd, "nameOr", 80);
  const url = str(fd, "url", 500);
  let error: string | undefined;
  if (!nameEn || !nameOr) error = "Enter the name in English and Odia.";
  else {
    try {
      if (new URL(url).protocol !== "https:") error = "Link must start with https://";
    } catch {
      error = "Enter the full official e-paper link (https://…).";
    }
  }
  return { error, data: { nameEn, nameOr, url } };
}

export async function updateNewspaper(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const id = Number(fd.get("id"));
  const { error, data } = parsePaper(fd);
  if (error) return { error };
  await db.newspaper.update({ where: { id }, data });
  refreshPublic();
  return { ok: "Saved." };
}

export async function addNewspaper(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireStaff();
  const { error, data } = parsePaper(fd);
  if (error) return { error };
  const base = slugify(data.nameEn) || "paper";
  const taken = await db.newspaper.count({ where: { slug: { startsWith: base } } });
  const max = await db.newspaper.aggregate({ _max: { sortOrder: true } });
  await db.newspaper.create({
    data: { ...data, slug: taken ? `${base}-${taken + 1}` : base, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  refreshPublic();
  return { ok: `Added ${data.nameEn}.` };
}

export async function deleteNewspaper(fd: FormData) {
  await requireStaff();
  const id = Number(fd.get("id"));
  await db.newspaper.delete({ where: { id } }).catch(() => null);
  refreshPublic();
  redirect("/admin/newspapers");
}

/* ───────────── Session ───────────── */

export async function logout() {
  await signOut({ redirect: false });
  // Belt and braces: expire every Auth.js cookie (incl. chunked / __Secure- variants)
  // so the session can't survive a sign-out.
  const jar = await cookies();
  for (const c of jar.getAll()) {
    if (c.name.includes("authjs.")) {
      jar.set(c.name, "", { maxAge: 0, path: "/", secure: c.name.startsWith("__Secure-"), httpOnly: true, sameSite: "lax" });
    }
  }
  redirect("/login");
}
