import { CategoryStrip } from "@/components/home/CategoryStrip";
import { Hero } from "@/components/home/Hero";
import { InfoBand } from "@/components/home/InfoBand";
import { NewArrivals } from "@/components/home/NewArrivals";
import { NewspapersSection } from "@/components/home/NewspapersSection";
import { getCategories, getNewArrivals, getNewspapers } from "@/lib/books";
import { todayLong } from "@/lib/utils";

// Always fresh: new books show up the moment staff add them, and the date is today's.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, arrivals, papers] = await Promise.all([getCategories(), getNewArrivals(12), getNewspapers()]);
  return (
    <>
      <Hero />
      <div className="space-y-16 pb-20 md:space-y-24">
        <CategoryStrip categories={categories} />
        <NewArrivals books={arrivals} />
        <div className="mx-auto max-w-[1440px] px-4 md:px-6 lg:px-10">
          <NewspapersSection papers={papers} date={todayLong()} />
        </div>
      </div>
      <InfoBand />
    </>
  );
}
