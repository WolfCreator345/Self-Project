import { db } from "@/lib/db";
import { deleteNewspaper } from "../actions";
import { ConfirmButton } from "../ConfirmButton";
import { AddNewspaperForm, NewspaperRow } from "./NewspaperForms";

export const dynamic = "force-dynamic";

export default async function NewspapersAdminPage() {
  const papers = await db.newspaper.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Newspaper links</h1>
      <p className="mt-1 mb-6 max-w-2xl text-ink-soft">
        Only link to each publisher&apos;s <strong>official</strong> e-paper website. Use “Test link” to check it
        opens correctly.
      </p>
      <ul className="space-y-4">
        {papers.map((p) => (
          <NewspaperRow key={p.id} p={p}>
            <form action={deleteNewspaper} className="mt-3 border-t border-ink/10 pt-3">
              <input type="hidden" name="id" value={p.id} />
              <ConfirmButton message={`Remove ${p.nameEn}?`} className="text-sm text-crimson underline-offset-4 hover:underline min-h-11">
                Remove this newspaper
              </ConfirmButton>
            </form>
          </NewspaperRow>
        ))}
      </ul>
      <div className="mt-6">
        <AddNewspaperForm />
      </div>
    </div>
  );
}
