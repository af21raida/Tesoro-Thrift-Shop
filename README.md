# Tesoro — Secondhand Marketplace & Auctions

University project scaffold: a secondhand marketplace with a limited-edition
product auction/bidding system as its core feature. Next.js (App Router) +
TypeScript + Tailwind CSS on the frontend, Server Actions/Route Handlers on
the backend, PostgreSQL + Prisma for persistence.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 14 (App Router), React 18 |
| Language | TypeScript |
| Styling | Tailwind CSS (design tokens in `tailwind.config.ts`) |
| Database | PostgreSQL |
| ORM | Prisma (`prisma/schema.prisma`, migrations in `prisma/migrations/`) |
| Data validation | Zod |
| Auth / sessions | bcryptjs (password hashing), jose (signed httpOnly-cookie JWTs) |
| Server logic | Next.js Server Actions, Route Handlers (cron endpoint) |
| Tests | Vitest (`npm test`) — unit + real-Postgres integration tests |
| Tooling | ESLint, PostCSS/Autoprefixer, `tsx` (seed runner) |

See `package.json` for exact versions.

## What's in this scaffold

- Full App Router folder structure with every route from the plan present
  as a working page — most render a labeled placeholder until their
  implementation phase, so the whole route tree is navigable today.
- Prisma schema (from Phase 2) wired in at `prisma/schema.prisma`, plus a
  Prisma Client singleton at `lib/db/prisma.ts`.
- Auth scaffolding: password hashing (`lib/auth/password.ts`), signed
  httpOnly-cookie sessions via `jose` (`lib/auth/session.ts`), and
  role/ownership checks for Server Actions (`lib/auth/rbac.ts`). Registration
  and login pages/actions themselves are Phase 4.
- Edge `middleware.ts` doing coarse route-prefix → role gating as a UX
  convenience — **not** the security boundary; every Server Action still
  calls `requireRole`/`requireOwnerOrRole` itself.
- Base UI shell: root layout with the project's font/color tokens, header,
  footer, a `Button` component, and a homepage hero establishing the visual
  identity (see "Design language" below).
- `lib/` and `actions/` subfolders each carry a short `README.md` noting
  what will live there and in which phase, so the architecture is visible
  even where the code isn't written yet.

## Design language

A light, warm antique/secondhand-market theme: ivory parchment backgrounds,
dark-walnut ink for structure, antique gold (brass) accents borrowed from
price tags, muted olive for "good/success", muted plum for a live auction,
and dusty burgundy (stamp) for something closed/rejected — like ink stamps
on a thrift tag. Display face is Cinzel (Roman-capital serif, used for
headings and button labels), body and prices are Cormorant Garamond (with
SemiBold/Bold figures for prices). Tokens live in `tailwind.config.ts` and
`app/globals.css`. The header has two panels: the 1st is burgundy
(`#2F0909`) with a pure-CSS checkered wooden overlay (see
`.header-wood-overlay` in `app/globals.css`) and an enlarged Tesoro logo
(`public/tesoro-logo.png`, `h-24 w-24 md:h-28 md:w-28`) upper-left; the
2nd (homepage search + categories bar) is `#343952` with a burgundy
Search button matching the 1st panel. The logo also anchors the homepage
"Our story" section. The homepage hero
shows four product photos (`public/hero-card-tee.png`,
`public/hero-card-book.png`, `public/hero-card-poster.png`,
`public/hero-card-cd.png`) as an overlapping card spread beside the hero
text (CD back-left, poster centre, book right, tee front) — the
pictures have transparent backgrounds so they render as borderless cutouts
with a soft drop-shadow, and each shifts slightly sideways on its own hover
(see `.hero-spread` / `.hero-card` in `app/globals.css`). Each card is a
link to its product-detail page (`/products/[id]`, resolved by product
name at render time).

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and AUTH_SECRET
npm run prisma:migrate # creates the database schema
npm run seed            # currently just verifies the DB connection
npm run dev
```

## Folder map

```
app/            Route groups: (public) (auth) (buyer) (seller) (admin) (staff), api/
components/     ui/ (shared primitives) + one folder per feature area
lib/            auth/ db/ auction/ inventory/ orders/ payments/ validation/ notifications/
actions/        Server Actions, grouped the same way as lib/
prisma/         schema.prisma, seed.ts
middleware.ts   Edge-level route gating
```

## Roadmap

Phases 4–11 (auth, products/inventory, listings/moderation, cart/checkout,
the auction/bidding system, admin & staff dashboards, reporting, testing)
build on this scaffold in order — see the Phase 1 analysis doc for the full
roadmap table.
