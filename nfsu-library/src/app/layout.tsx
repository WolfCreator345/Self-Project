import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Noto_Sans_Oriya, Outfit } from "next/font/google";
import { SITE } from "@/config/site";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});
const odia = Noto_Sans_Oriya({
  subsets: ["oriya"],
  weight: ["500", "600"],
  variable: "--font-odia-noto",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  title: { default: SITE.name, template: `%s · ${SITE.shortName}` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { title: SITE.name, description: SITE.description, type: "website", locale: "en_IN" },
  icons: { icon: "/logos/nfsu-logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#332B66",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${instrument.variable} ${odia.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-white"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
