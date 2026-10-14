# AGENTS.md — instructions for AI coding agents (Codex etc.)

Official library website for **National Forensic Sciences University (NFSU), Bhubaneswar Campus**.
Users: students and faculty (mostly on phones) plus one staff account (Library Assistant, Sumit Panda).

## Stack
Next.js 15 App Router + TypeScript · Tailwind CSS v4 (tokens in `src/app/globals.css` `@theme`) ·
Prisma 6 + SQLite · Auth.js v5 (Credentials, JWT session) · bcryptjs. Node.js 22.18+.

## Commands (run inside `nfsu-library/`)
| Task | Command |
| --- | --- |
| Install | `npm ci` |
| Dev server | `npm run dev` |
| Lint (must pass with 0 errors) | `npm run lint` |
| Production build (must pass) | `npm run build` |
| Production start (runs migrations first) | `npm run start:prod` |
| First-time DB setup + seed | `npm run setup` |
| New migration (dev) | `npm run db:migrate -- --name <name>` |
| Make the admin password hash | `npm run hash-password` |

Local secrets live in `.env.local` (copy `.env.example`). Deployment steps: see `DEPLOY.md`.

## Hard rules
- **Never** put the admin email, password or hash in any source file, seed, test, commit or log.
  They come only from `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` env vars. `.env.local` is gitignored; keep it that way.
- In `.env` files every `$` in the bcrypt hash must be written `\$` (Next.js expands `$VAR`).
  In a hosting dashboard or Docker `--env-file`, use the plain hash.
- No public sign-up, student accounts, reservations, payments, analytics, chat widgets or dark-mode toggle.
- Newspapers: only **link** to official e-paper sites (`target="_blank" rel="noopener noreferrer"`).
  Never scrape, iframe, download or rehost newspaper content. Never guess URLs.
- Don't add npm dependencies or change `prisma/schema.prisma` without the owner's approval.
- Don't delete the MHA / NFSU logo files in `public/logos/` or redraw them.
- Keep accessibility: 16px body text, 44px tap targets, visible focus rings, alt text, `prefers-reduced-motion`.
- The SQLite file must be on persistent storage in production. Serverless hosts (Vercel/Netlify)
  need a Postgres migration first, which requires owner approval.

## Map
- `src/app/(site)/`: public pages (home, `/books`, `/newspapers`)
- `src/app/admin/`: staff area; `actions.ts` holds all server actions (each re-checks the session)
- `src/app/login/`, `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts`: authentication and the `/admin` guard
- `src/lib/rate-limit.ts`: in-memory login limiter (5 tries / 15 min / IP)
- `src/config/`: site info, default newspaper links, library timings (**placeholders, confirm with the library**)
- `prisma/seed.ts`: categories, newspaper links, sample books (`isSeed = true`)

## Before you finish any change
Run `npm run lint` and `npm run build`. Both must succeed.
