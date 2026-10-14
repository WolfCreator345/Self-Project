"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Book, Category } from "@prisma/client";
import { saveBook, type FormState } from "./actions";

type Field = {
  name: keyof Book;
  label: string;
  type?: string;
  required?: boolean;
  hint?: string;
  inputMode?: "numeric" | "url";
  span?: boolean;
};

const FIELDS: Field[] = [
  { name: "title", label: "Title", required: true, span: true },
  { name: "author", label: "Author(s)", required: true, span: true },
  { name: "isbn", label: "ISBN", hint: "10 or 13 digits, hyphens are fine", inputMode: "numeric" },
  { name: "publisher", label: "Publisher" },
  { name: "year", label: "Year", type: "number", inputMode: "numeric" },
  { name: "shelf", label: "Shelf location", hint: "e.g. Rack 4, Shelf B" },
  { name: "copies", label: "Total copies", type: "number", required: true, inputMode: "numeric" },
  { name: "available", label: "Copies available now", type: "number", hint: "Leave empty = all copies", inputMode: "numeric" },
  { name: "coverUrl", label: "Cover image URL", type: "url", hint: "Optional. Must start with https://", span: true },
];

export function BookForm({ book, categories }: { book?: Book; categories: Category[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveBook, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-ink/5 md:p-8" noValidate>
      {book ? <input type="hidden" name="id" value={book.id} /> : null}
      {state.error ? (
        <p role="alert" className="mb-6 rounded-2xl bg-crimson-50 px-4 py-3 text-sm font-medium text-crimson">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        {FIELDS.slice(0, 2).map((f) => (
          <Input key={f.name} f={f} book={book} error={fe[f.name]} />
        ))}
        <div>
          <label htmlFor="categoryId" className="label">
            Category <span className="text-crimson" aria-hidden="true">*</span>
          </label>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={book?.categoryId ?? ""}
            aria-invalid={!!fe.categoryId}
            aria-describedby={fe.categoryId ? "categoryId-err" : undefined}
            className="field"
          >
            <option value="" disabled>
              Choose…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {fe.categoryId ? (
            <p id="categoryId-err" className="mt-1 text-sm text-crimson">
              {fe.categoryId}
            </p>
          ) : null}
        </div>
        {FIELDS.slice(2).map((f) => (
          <Input key={f.name} f={f} book={book} error={fe[f.name]} />
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-70">
          {pending ? "Saving…" : book ? "Save changes" : "Add book"}
        </button>
        <Link href="/admin" className="btn-outline">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Input({ f, book, error }: { f: Field; book?: Book; error?: string }) {
  const id = String(f.name);
  const value = book?.[f.name];
  const describedBy = [error ? `${id}-err` : "", f.hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={f.span ? "md:col-span-2" : ""}>
      <label htmlFor={id} className="label">
        {f.label} {f.required ? <span className="text-crimson" aria-hidden="true">*</span> : null}
      </label>
      <input
        id={id}
        name={id}
        type={f.type ?? "text"}
        inputMode={f.inputMode}
        required={f.required}
        min={f.type === "number" ? 0 : undefined}
        defaultValue={value === null || value === undefined ? (f.name === "copies" ? 1 : "") : String(value)}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`field ${error ? "border-crimson" : ""}`}
      />
      {f.hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-soft">
          {f.hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-sm text-crimson">
          {error}
        </p>
      ) : null}
    </div>
  );
}
