import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MhaLogo, NfsuCrest } from "@/components/Logos";
import { Icon } from "@/lib/icons";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Staff Login", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const session = await auth();
  if (session?.user) redirect("/admin");
  const { callbackUrl } = await searchParams;
  let cb: string | undefined;
  try {
    const u = new URL(callbackUrl ?? "", "http://x");
    if (u.pathname.startsWith("/admin")) cb = u.pathname + u.search;
  } catch {}

  return (
    <main id="main" className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(40rem_30rem_at_0%_0%,rgb(220_217_238/0.8),transparent_70%),radial-gradient(36rem_28rem_at_100%_100%,rgb(236_220_184/0.55),transparent_70%)]"
      />
      <div className="glass relative w-full max-w-md rounded-3xl p-7 shadow-lift sm:p-9">
        <div className="mb-6 flex items-center justify-between">
          <MhaLogo className="h-9" />
          <NfsuCrest className="h-12" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Staff <em className="font-serif font-normal text-navy italic">login</em>
        </h1>
        <p className="mt-1 mb-6 text-ink-soft">For library staff only.</p>
        <LoginForm callbackUrl={cb} />
        <Link href="/" className="mt-6 inline-flex min-h-11 items-center gap-1 text-sm text-ink-soft hover:text-navy">
          <Icon name="chevron-left" size={16} /> Back to library site
        </Link>
      </div>
    </main>
  );
}
