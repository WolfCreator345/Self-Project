import type { Metadata } from "next";
import { NewspapersSection } from "@/components/home/NewspapersSection";
import { getNewspapers } from "@/lib/books";
import { todayLong } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "E-Newspapers",
  description: "Open today's Odisha e-newspapers — The Samaja, Sambad and The Samaya — on their official websites.",
};

export default async function NewspapersPage() {
  const papers = await getNewspapers();
  const date = todayLong();
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-8 pb-20 md:px-6 lg:px-10">
      <p className="eyebrow mb-2">Odisha edition · {date}</p>
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
        Today&apos;s <em className="font-serif font-normal text-navy italic">e-newspapers</em>
      </h1>
      <p className="mt-4 mb-8 max-w-2xl text-lg text-ink-soft">
        Read the day&apos;s Odia newspapers for free on each publisher&apos;s official e-paper site. Links open in a new
        tab.
      </p>
      <NewspapersSection papers={papers} date={date} heading={false} />
    </div>
  );
}
