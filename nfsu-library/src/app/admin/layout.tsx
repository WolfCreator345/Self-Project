import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NfsuCrest } from "@/components/Logos";
import { Icon } from "@/lib/icons";
import { AdminNav } from "./AdminNav";
import { logout } from "./actions";

export const metadata: Metadata = { title: "Staff dashboard", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Middleware already guards /admin; this is defence in depth.
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link href="/admin" className="flex min-h-11 items-center gap-3 font-semibold">
            <NfsuCrest className="h-10" />
            <span>
              Library staff
              <span className="block text-xs font-normal text-ink-soft">NFSU Bhubaneswar</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn-outline px-4 text-sm">
              View site
            </Link>
            <form action={logout}>
              <button type="submit" className="btn-dark px-4 text-sm">
                <Icon name="logout" size={18} /> Logout
              </button>
            </form>
          </div>
        </div>
        <AdminNav />
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        {children}
      </main>
    </div>
  );
}
