/**
 * Default links to the OFFICIAL e-paper sites of Odisha newspapers.
 * These seed the database; after that, staff edit them at /admin/newspapers.
 * We only link out — never scrape, iframe, download or rehost content.
 *
 * Verified Oct 2026 via web search (publisher-owned pages / Wikipedia):
 * - Sambad: sambadepaper.com — site states content is property of Eastern Media Ltd (publisher)
 * - The Samaja: samajaepaper.in — contact page of Servants of the People Society & The Samaja
 * - The Samaya: samayaepaper.com — linked from Wikipedia; publisher Ashirbad Prakashan Pvt. Ltd.
 */
export type NewspaperLink = {
  slug: string;
  nameEn: string;
  nameOr: string;
  url: string;
};

export const DEFAULT_NEWSPAPERS: NewspaperLink[] = [
  { slug: "samaja", nameEn: "The Samaja", nameOr: "ସମାଜ", url: "https://www.samajaepaper.in/" },
  { slug: "sambad", nameEn: "Sambad", nameOr: "ସମ୍ବାଦ", url: "https://sambadepaper.com/" },
  { slug: "samaya", nameEn: "The Samaya", nameOr: "ସମୟ", url: "https://www.samayaepaper.com/" },
];
