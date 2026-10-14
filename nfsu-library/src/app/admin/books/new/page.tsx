import { getCategories } from "@/lib/books";
import { BookForm } from "../../BookForm";

export const dynamic = "force-dynamic";

export default async function NewBookPage() {
  const categories = await getCategories();
  return (
    <div>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Add a book</h1>
      <BookForm categories={categories} />
    </div>
  );
}
