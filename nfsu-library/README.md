# NFSU Library, Bhubaneswar Campus

Website for the library of National Forensic Sciences University, Bhubaneswar Campus.
Next.js (App Router, TypeScript) · Tailwind CSS v4 · Prisma + SQLite · Auth.js (Credentials).

## Run it

Requires **Node.js 22.18+**.

```bash
cd nfsu-library
npm install
cp .env.example .env.local      # then fill it in (see below)
npm run db:migrate              # creates prisma/library.db and seeds it
npm run dev                     # http://localhost:3000
```

Production: `npm run build && npm start`. On a fresh server use `npm run db:deploy`, then `npm run db:seed` once.

## Configure `.env.local`

| Variable | What to put |
| --- | --- |
| `DATABASE_URL` | `"file:./library.db"` (SQLite file next to the schema) |
| `ADMIN_EMAIL` | The Library Assistant's login email |
| `ADMIN_PASSWORD_HASH` | Run `npm run hash-password`, type the password twice, and paste the line it prints |
| `ADMIN_NAME` | Name on the dashboard, e.g. `Sumit Panda` |
| `NEXTAUTH_SECRET` | A random secret: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | The public site URL, e.g. `https://library.example.ac.in` |

> Paste the hash exactly as printed. Every `$` is escaped as `\$`, because Next.js
> would otherwise treat `$…` inside `.env` files as variables and corrupt the hash.

`.env.local` is gitignored. No credentials live in the source code. There is a single staff account and no sign-up.
Login is rate-limited to 5 attempts per 15 minutes per IP. The limiter is in-memory, so it resets on restart and applies to a single server instance.

## Where to edit things

| What | Where |
| --- | --- |
| Books, categories, newspaper links | `/admin` (after staff login) |
| Default newspaper links (used for seeding) | `src/config/newspapers.ts` |
| Timings, location, borrowing rules | `src/config/library-info.ts` (**placeholders, confirm before launch**) |
| Contact email, nav links | `src/config/site.ts` |
| Brand colours, fonts, radii | `src/app/globals.css` (`@theme`) |
| Logos | `public/logos/mha-logo.png`, `public/logos/nfsu-logo.png` |

The NFSU crest file currently has a black background, so it is shown on a small black tile.
If you replace it with a transparent PNG, pass `tile={false}` to `NfsuCrest` (`src/components/Logos.tsx`).

## Sample data

`prisma/seed.ts` adds 37 well-known sample books flagged `isSeed = true` (they show a "sample" tag in /admin).
Remove them all with `DELETE FROM "Book" WHERE "isSeed" = 1;` (or via `npm run db:studio`).
Re-running the seed replaces only the sample books. It never touches staff-added books, categories or links.

## Moving to Postgres

Change `provider` in `prisma/schema.prisma` to `"postgresql"`, set `DATABASE_URL`, delete `prisma/migrations`,
then run `npm run db:migrate`. For case-insensitive search, add `mode: "insensitive"` to the `contains` filters in `src/lib/books.ts`.
