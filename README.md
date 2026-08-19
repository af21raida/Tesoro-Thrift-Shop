# Thrift & Bid — Thrift Shop Management System

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

## What's in this scaffold (Phase 3)

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
headings only), body is IBM Plex Sans, and prices/bids/countdowns use IBM
Plex Mono for tabular figures. Tokens live in `tailwind.config.ts` and
`app/globals.css`. The Tesoro logo (`public/tesoro-logo.png`) anchors the
header's upper-left and the homepage "Our story" section.

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
