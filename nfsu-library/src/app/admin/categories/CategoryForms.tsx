"use client";

import { useActionState } from "react";
import type { Category } from "@prisma/client";
import { CATEGORY_ICON_KEYS, Icon } from "@/lib/icons";
import { addCategory, deleteCategory, updateCategory, type FormState } from "../actions";

function Msg({ s }: { s: FormState }) {
  const text = s.error ?? s.fieldErrors?.name ?? s.ok;
  if (!text) return null;
  const bad = !!(s.error || s.fieldErrors);
  return (
    <p role={bad ? "alert" : "status"} className={`text-sm ${bad ? "text-crimson" : "text-emerald-700"}`}>
      {text}
    </p>
  );
}

function IconSelect({ id, defaultValue }: { id: string; defaultValue?: string }) {
  return (
    <select id={id} name="icon" defaultValue={defaultValue ?? "book"} className="field">
      {CATEGORY_ICON_KEYS.map((k) => (
        <option key={k} value={k}>
          {k}
        </option>
      ))}
    </select>
  );
}

export function AddCategoryForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addCategory, {});
  return (
    <form action={action} className="grid gap-3 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-ink/5 md:grid-cols-[1fr_180px_auto] md:items-end">
      <div>
        <label htmlFor="new-cat" className="label">
          New category name
        </label>
        <input id="new-cat" name="name" required className="field" />
      </div>
      <div>
        <label htmlFor="new-cat-icon" className="label">
          Icon
        </label>
        <IconSelect id="new-cat-icon" />
      </div>
      <button className="btn-primary" disabled={pending}>
        <Icon name="plus" size={18} /> Add
      </button>
      <div className="md:col-span-3">
        <Msg s={state} />
      </div>
    </form>
  );
}

export function CategoryRow({ c, count }: { c: Category; count: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateCategory, {});
  const [delState, delAction] = useActionState<FormState, FormData>(deleteCategory, {});
  return (
    <li className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-ink/5">
      <div className="flex flex-wrap items-end gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-navy-50 text-navy">
          <Icon name={c.icon} />
        </span>
        <form action={action} className="flex flex-1 flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={c.id} />
          <div className="min-w-48 flex-1">
            <label htmlFor={`cat-${c.id}`} className="label">
              Name <span className="font-normal text-ink-soft">· {count} book{count === 1 ? "" : "s"}</span>
            </label>
            <input id={`cat-${c.id}`} name="name" defaultValue={c.name} required className="field" />
          </div>
          <div className="w-40">
            <label htmlFor={`cat-icon-${c.id}`} className="label">
              Icon
            </label>
            <IconSelect id={`cat-icon-${c.id}`} defaultValue={c.icon} />
          </div>
          <button className="btn-outline px-4" disabled={pending}>
            Save
          </button>
        </form>
        <form
          action={delAction}
          onSubmit={(e) => {
            if (!confirm(`Delete category “${c.name}”?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={c.id} />
          <button className="flex size-11 items-center justify-center rounded-full text-ink-soft hover:bg-crimson-50 hover:text-crimson" aria-label={`Delete ${c.name}`}>
            <Icon name="trash" size={18} />
          </button>
        </form>
      </div>
      <div className="mt-2 pl-14">
        <Msg s={state} />
        <Msg s={delState} />
      </div>
    </li>
  );
}
