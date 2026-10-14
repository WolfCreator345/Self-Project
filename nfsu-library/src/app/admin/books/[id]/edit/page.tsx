import { notFound } from "next/navigation";
import { getCategories } from "@/lib/books";
import { db } from "@/lib/db";
import { BookForm } from "../../../BookForm";

export const dynamic = "force-dynamic";

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bookId = Number(id);
  if (!Number.isInteger(bookId)) notFound();
  const [book, categories] = await Promise.all([db.book.findUnique({ where: { id: bookId } }), getCategories()]);
  if (!book) notFound();
  return (
    <div>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Edit book</h1>
      <BookForm book={book} categories={categories} />
    </div>
  );
}
