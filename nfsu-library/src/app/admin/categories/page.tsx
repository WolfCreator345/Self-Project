import { db } from "@/lib/db";
import { AddCategoryForm, CategoryRow } from "./CategoryForms";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { books: true } } },
  });
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Categories</h1>
      <p className="mt-1 mb-6 text-ink-soft">These appear as subject pills on the home page and as filters in the catalogue.</p>
      <AddCategoryForm />
      <ul className="mt-6 space-y-3">
        {categories.map((c) => (
          <CategoryRow key={c.id} c={c} count={c._count.books} />
        ))}
      </ul>
    </div>
  );
}
