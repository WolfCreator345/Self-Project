/**
 * Seeds categories, newspaper links and SAMPLE books.
 *
 * ── SAMPLE DATA ────────────────────────────────────────────────────────────
 * Every book created here has `isSeed: true`. To remove all sample books later:
 *   npx prisma studio   (filter isSeed = true)   or run in SQL:
 *   DELETE FROM "Book" WHERE "isSeed" = 1;
 * Re-running the seed replaces sample books only; staff-added books are kept.
 * Categories and newspaper links are only created if missing (staff edits kept).
 *
 * No admin credentials live here — the staff login is configured in .env.local.
 */
import prismaPkg from "@prisma/client";
import { DEFAULT_NEWSPAPERS } from "../src/config/newspapers.ts";
import { slugify } from "../src/lib/utils.ts";

const { PrismaClient } = prismaPkg;
const db = new PrismaClient();

const CATEGORIES: { name: string; icon: string }[] = [
  { name: "Law", icon: "scale" },
  { name: "Digital Forensics & Information Security", icon: "shield" },
  { name: "Forensic Science", icon: "microscope" },
  { name: "Fiction", icon: "feather" },
  { name: "Non-Fiction", icon: "book-open" },
  { name: "Data Privacy", icon: "lock" },
  { name: "Artificial Intelligence & Ethics", icon: "cpu" },
  { name: "Governance, Risk & Compliance", icon: "clipboard" },
  { name: "Cloud Computing", icon: "cloud" },
  { name: "Others", icon: "grid" },
];

type SeedBook = { title: string; author: string };

// SAMPLE BOOKS — real, well-known titles. Only title + author are given,
// so no publisher/ISBN/year details are invented.
const SAMPLE_BOOKS: Record<string, SeedBook[]> = {
  Law: [
    { title: "Introduction to the Constitution of India", author: "Durga Das Basu" },
    { title: "Indian Constitutional Law", author: "M. P. Jain" },
    { title: "The Indian Penal Code", author: "Ratanlal & Dhirajlal" },
    { title: "The Law of Evidence", author: "Ratanlal & Dhirajlal" },
  ],
  "Digital Forensics & Information Security": [
    { title: "File System Forensic Analysis", author: "Brian Carrier" },
    { title: "The Art of Memory Forensics", author: "Michael Hale Ligh, Andrew Case, Jamie Levy, AAron Walters" },
    { title: "Practical Malware Analysis", author: "Michael Sikorski, Andrew Honig" },
    { title: "Digital Evidence and Computer Crime", author: "Eoghan Casey" },
  ],
  "Forensic Science": [
    { title: "Criminalistics: An Introduction to Forensic Science", author: "Richard Saferstein" },
    { title: "Forensic Science: From the Crime Scene to the Crime Lab", author: "Richard Saferstein" },
    { title: "Modi's Medical Jurisprudence and Toxicology", author: "Jaising P. Modi" },
    { title: "Forensic DNA Typing", author: "John M. Butler" },
  ],
  Fiction: [
    { title: "The Hound of the Baskervilles", author: "Arthur Conan Doyle" },
    { title: "Murder on the Orient Express", author: "Agatha Christie" },
    { title: "Malgudi Days", author: "R. K. Narayan" },
    { title: "The Silence of the Lambs", author: "Thomas Harris" },
  ],
  "Non-Fiction": [
    { title: "Wings of Fire", author: "A. P. J. Abdul Kalam, Arun Tiwari" },
    { title: "The Discovery of India", author: "Jawaharlal Nehru" },
    { title: "Sapiens: A Brief History of Humankind", author: "Yuval Noah Harari" },
    { title: "Thinking, Fast and Slow", author: "Daniel Kahneman" },
  ],
  "Data Privacy": [
    { title: "Understanding Privacy", author: "Daniel J. Solove" },
    { title: "Data and Goliath", author: "Bruce Schneier" },
    { title: "The Age of Surveillance Capitalism", author: "Shoshana Zuboff" },
    { title: "Privacy's Blueprint", author: "Woodrow Hartzog" },
  ],
  "Artificial Intelligence & Ethics": [
    { title: "Artificial Intelligence: A Modern Approach", author: "Stuart Russell, Peter Norvig" },
    { title: "Human Compatible", author: "Stuart Russell" },
    { title: "Weapons of Math Destruction", author: "Cathy O'Neil" },
    { title: "The Alignment Problem", author: "Brian Christian" },
  ],
  "Governance, Risk & Compliance": [
    { title: "Security Risk Management", author: "Evan Wheeler" },
    { title: "Measuring and Managing Information Risk: A FAIR Approach", author: "Jack Freund, Jack Jones" },
    { title: "How to Measure Anything in Cybersecurity Risk", author: "Douglas W. Hubbard, Richard Seiersen" },
  ],
  "Cloud Computing": [
    { title: "Cloud Computing: Concepts, Technology & Architecture", author: "Thomas Erl" },
    { title: "Designing Data-Intensive Applications", author: "Martin Kleppmann" },
    { title: "Site Reliability Engineering", author: "Betsy Beyer, Chris Jones, Jennifer Petoff, Niall Richard Murphy" },
  ],
  Others: [
    { title: "How to Read a Book", author: "Mortimer J. Adler, Charles Van Doren" },
    { title: "The Elements of Style", author: "William Strunk Jr., E. B. White" },
    { title: "Atomic Habits", author: "James Clear" },
  ],
};

async function main() {
  for (const [i, c] of CATEGORIES.entries()) {
    await db.category.upsert({
      where: { slug: slugify(c.name) },
      update: {},
      create: { name: c.name, slug: slugify(c.name), icon: c.icon, sortOrder: i },
    });
  }

  for (const [i, n] of DEFAULT_NEWSPAPERS.entries()) {
    await db.newspaper.upsert({
      where: { slug: n.slug },
      update: {},
      create: { ...n, sortOrder: i },
    });
  }

  const { count } = await db.book.deleteMany({ where: { isSeed: true } });
  if (count) console.log(`Removed ${count} previous sample books`);

  const categories = await db.category.findMany();
  const bySlug = new Map(categories.map((c) => [c.slug, c.id]));

  // Spread "added" dates over the last ~90 days so New Arrivals looks realistic.
  const all = Object.entries(SAMPLE_BOOKS).flatMap(([cat, books]) => books.map((b) => ({ ...b, cat })));
  const now = Date.now();
  let created = 0;
  for (const [i, b] of all.entries()) {
    const categoryId = bySlug.get(slugify(b.cat));
    if (!categoryId) throw new Error(`Missing category ${b.cat}`);
    const copies = 1 + (i % 4);
    await db.book.create({
      data: {
        title: b.title,
        author: b.author,
        categoryId,
        copies,
        available: i % 7 === 3 ? 0 : copies - (i % 2),
        isSeed: true,
        createdAt: new Date(now - (((i * 37) % 90) + 1) * 86_400_000 - i * 60_000),
      },
    });
    created++;
  }
  console.log(`Seeded ${CATEGORIES.length} categories, ${DEFAULT_NEWSPAPERS.length} newspapers, ${created} sample books`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
