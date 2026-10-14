"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/lib/icons";
import { login, type LoginState } from "./actions";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-5" noValidate={false}>
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      {state.error ? (
        <p role="alert" className="rounded-2xl bg-crimson-50 px-4 py-3 text-sm font-medium text-crimson">
          {state.error}
        </p>
      ) : null}
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="username" className="field" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            className="field pr-14"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-ink-soft hover:text-ink"
          >
            <Icon name={show ? "eye-off" : "eye"} />
          </button>
        </div>
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-70">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
