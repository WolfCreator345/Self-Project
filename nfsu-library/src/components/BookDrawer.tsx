"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon } from "@/lib/icons";

/** Accessible side drawer (native <dialog>: focus trap + Esc for free). */
export function BookDrawer({ closeHref, title, children }: { closeHref: string; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={() => router.replace(closeHref, { scroll: false })}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-md bg-white p-0 text-ink shadow-lift backdrop:bg-ink/40 backdrop:backdrop-blur-sm open:animate-rise sm:rounded-l-3xl"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3">
          <p className="eyebrow">Book details</p>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="flex size-11 items-center justify-center rounded-full bg-page hover:bg-navy-50"
            aria-label="Close details"
            autoFocus
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </dialog>
  );
}
