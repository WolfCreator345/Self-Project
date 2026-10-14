"use client";

import { useActionState } from "react";
import type { Newspaper } from "@prisma/client";
import { addNewspaper, updateNewspaper, type FormState } from "../actions";

function Fields({ p, prefix }: { p?: Newspaper; prefix: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_1fr_2fr]">
      <div>
        <label htmlFor={`${prefix}-en`} className="label">
          Name (English)
        </label>
        <input id={`${prefix}-en`} name="nameEn" defaultValue={p?.nameEn} required className="field" />
      </div>
      <div>
        <label htmlFor={`${prefix}-or`} className="label">
          Name (Odia)
        </label>
        <input id={`${prefix}-or`} name="nameOr" lang="or" defaultValue={p?.nameOr} required className="field font-odia" />
      </div>
      <div>
        <label htmlFor={`${prefix}-url`} className="label">
          Official e-paper link
        </label>
        <input id={`${prefix}-url`} name="url" type="url" defaultValue={p?.url} placeholder="https://" required className="field" />
      </div>
    </div>
  );
}

function Msg({ s }: { s: FormState }) {
  if (!s.error && !s.ok) return null;
  return (
    <p role={s.error ? "alert" : "status"} className={`text-sm ${s.error ? "text-crimson" : "text-emerald-700"}`}>
      {s.error ?? s.ok}
    </p>
  );
}

export function NewspaperRow({ p, children }: { p: Newspaper; children?: React.ReactNode }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateNewspaper, {});
  return (
    <li className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={p.id} />
        <Fields p={p} prefix={`np-${p.id}`} />
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary px-5" disabled={pending}>
            Save
          </button>
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn-outline px-4">
            Test link
          </a>
          <Msg s={state} />
        </div>
      </form>
      {children}
    </li>
  );
}

export function AddNewspaperForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addNewspaper, {});
  return (
    <form action={action} className="space-y-3 rounded-3xl border-2 border-dashed border-ink/15 p-5">
      <h2 className="font-semibold">Add another newspaper</h2>
      <Fields prefix="np-new" />
      <div className="flex items-center gap-3">
        <button className="btn-dark px-5" disabled={pending}>
          Add newspaper
        </button>
        <Msg s={state} />
      </div>
    </form>
  );
}
