# Devlog — Tesoro (thrift shop management system)

## 2026-09-10 — Homepage hero: single collage replaced with 4-card overlapping spread

### What changed
- `app/page.tsx` (homepage hero only): removed the single hero-side image
  (`/hero-collage.png`) and replaced it with 4 overlapping/spread cards in
  the same area beside the hero text:
  - `/hero-card-tee.png` (cat t-shirt)
  - `/hero-card-book.png` ("Homesick for Another World" book)
  - `/hero-card-poster.png` ("The Holdovers" poster)
  - `/hero-card-cd.png` (The Smiths "The Queen Is Dead" CD)
- `app/globals.css`: added `.hero-spread` / `.hero-card` / `.hero-card-1..4`
  styles — each card gets its own position/rotation (`--tilt`: -6deg, 3deg,
  -3deg, 5deg) so the four read as a natural fanned card spread; card styling
  (white tag background, `border-line` border, soft shadow,
  `mix-blend-multiply`) matches the existing medieval/thrift-shop theme.
- Individual sideways hover effect: each card has its own independent
  `:hover` rule (`.hero-card-1:hover` … `.hero-card-4:hover`) that shifts only
  the hovered card `translateX(10px)` while preserving its rotation; siblings
  keep their own transforms and never move. `transition: transform 0.25s
  ease` makes the nudge smooth and eases the card back on mouse-leave. There
  is no container-level hover rule, so the group never moves together.

### What was deliberately NOT changed
- Hero headline text ("Find treasures. / Give them a new story."), both hero
  buttons ("Browse the shop", "See live auctions"), navigation, fonts,
  colors, and all other homepage sections are untouched (verified via
  `git diff app/page.tsx` — only the hero-image block changed).
- `public/hero-collage.png` was left in place (not deleted); nothing else in
  the repo was redesigned and no other functionality was touched.

### Assets note
- The 4 pictures supplied with the request must be saved as the filenames
  above under `public/`. Temporary labeled placeholder PNGs were generated
  at those paths only so layout/hover could be verified; overwrite them with
  the provided pictures (same filenames, no code change needed). Images use
  `object-fit: contain`, so the pictures themselves are shown uncropped.

### Testing performed
- `npx tsc --noEmit` — passes, no type errors.
- `npm run build` — succeeds (fixed one self-inflicted CSS error first: a
  missing closing `}` for `@layer components`).
- Verified via file checks: all 4 `src` paths present in `app/page.tsx`;
  all 4 per-card `:hover` rules plus `translateX(10px)` and the `transform`
  transition present in `app/globals.css`; hero text and both hero buttons
  still present.
- Hover logic review: `:hover` transform applies per card only, rotation is
  preserved via `--tilt`, no `.hero-spread:hover` rule exists — so only the
  hovered card moves and it returns smoothly.
- `npm test` (Vitest, needs real Postgres) was not run — no test or
  server-side code was changed. `plan.md` needed no update (this visual
  change affects none of the roadmap phases); `README.md` design-language
  note updated to describe the new hero assets.

## 2026-09-10 (follow-up) — Reference arrangement + transparent-background fix

### What changed
- `app/page.tsx`: reordered the four hero cutouts back-to-front to match the
  supplied reference arrangement — CD back-left, poster centre, book right,
  tee front-bottom (classes `.hero-card-1..4` now map to CD/poster/book/tee
  in that order).
- `app/globals.css`: removed the white card boxes entirely
  (`background-color: #fff`, border, `box-shadow`, `mix-blend-multiply` all
  gone) because the 4 pictures have transparent backgrounds. Each cutout is
  now borderless with `background: transparent` and a soft
  `filter: drop-shadow(...)` that follows the cutout's own alpha shape
  instead of a rectangle — so no white rectangle can ever show, and
  overlapping areas no longer darken (multiply is gone). Container is now
  square (`aspect-ratio: 1 / 1`) to fit the reference-style collage; each
  cutout sizes by width with natural height.
- The independent sideways hover is unchanged in behavior (only the hovered
  cutout does `rotate(var(--tilt)) translateX(10px)`; siblings never move),
  now also deepening the drop-shadow slightly on hover.

### Testing performed
- `npm run build` — succeeds.
- Verified: `background: transparent`, `drop-shadow`, square container, all
  4 per-card `:hover` rules with `translateX(10px)` present; no
  `background-color: #fff` / `mix-blend-mode` left in the hero styles; all 4
  `src` paths present; hero text and both buttons intact.
- Placeholder PNGs regenerated with real transparency (transparent
  background + colored shape) to prove the no-white-box path; overwrite
  them with the provided transparent pictures using the same filenames —
  no code change needed.

## 2026-09-10 (part 3) — Hero cards now link to their product pages

### Product mapping verification (against the live DB, no duplicates created)
All four targets already exist as purchasable `THRIFT_STOCK` products with
stock available, served by the existing `/products/[id]` route:

- `hero-card-tee.png` → "Cat White Tee" (`denim-outerwear` = clothing/apparel)
- `hero-card-book.png` → "Homesick For Another World By Ottessa Moshfegh"
  (`vinyl-records` = the project's book/media category)
- `hero-card-poster.png` → "The Holdovers Poster" (`vinyl-records`)
- `hero-card-cd.png` → '"the Queen Is Dead"- cd By The Smiths'
  (`vinyl-records`)
- Exact-name match used deliberately: a "Cat t-shirt" AUCTION_ITEM also
  exists, and the exact lookup avoids linking the tee card to the wrong
  record (auction items live under `/auctions/`, not product pages).

### What changed
- `app/page.tsx`: each hero `<img>` is now wrapped in a Next.js `Link`
  whose `href` is resolved at render time by exact product-name lookup
  (`HERO_PRODUCT_NAMES` + `heroHref()`), so a reseed (new IDs, same names)
  can't break the links. Falls back to `/products` if an item is ever
  missing — never a dead link. Removed `aria-hidden` from the hero collage
  wrapper (it now contains focusable links) and added per-link
  `aria-label`s with the product names. No new routes, no new products, no
  hardcoded IDs or fake product info.
- `app/globals.css`: positioning/rotation/hover classes now sit on the
  link; added `.hero-card img { display:block; width:100%; height:auto }`
  so the whole cutout is the click target, plus `cursor: pointer` as the
  clickable affordance. The per-card `:hover` rules
  (`rotate(var(--tilt)) translateX(10px)`) are otherwise byte-identical in
  behavior — only the hovered card moves, siblings never move, smooth
  return on mouse-leave. Hero text, buttons, nav, and all other sections
  untouched.

### Testing performed
- `npx tsc --noEmit` clean; `npm run build` succeeds.
- Live production server (`npm run start`): homepage returns 200 and
  renders all four `/products/<id>` hrefs; each of the four product pages
  returns 200 (all four listings are public, in-stock `THRIFT_STOCK`).
- Hero text, both buttons, and all four card images confirmed present in
  the rendered homepage; no console-relevant breakage (no new client JS).
- `plan.md` needed no update (no planned task affected); `README.md` hero
  note extended with the click-through behavior.

## 2026-09-10 (part 4) — Header restyle: checkered wood overlay, larger logo, second-panel recolor

### What changed
- `components/layout/header.tsx` (1st header panel): kept the burgundy base
  (`bg-burgundy`, `#2F0909`), added a pointer-events-none
  `.header-wood-overlay` layer so the wood pattern never blocks logo/nav
  clicks; content wrapper made `relative` and header `overflow-hidden`.
  Logo image enlarged from `h-14 w-14 md:h-16 md:w-16` to
  `h-24 w-24 md:h-28 md:w-28`.
- `app/globals.css`: `.header-wood-overlay` is a pure CSS/SVG checkered
  wooden texture (no image asset) — desaturated `feTurbulence` grain +
  `repeating-conic-gradient` parquet checker (72px checks, 144px tile) +
  2px grout lines + top/bottom shading, `mix-blend-mode: overlay` at
  `opacity: 0.52` so burgundy still dominates and text stays readable.
- `components/layout/home-search-bar.tsx` (2nd header panel, search +
  categories): band color changed from `bg-burgundy` to `bg-[#343952]`
  (via an intermediate `#18573e` step per request history); Search submit
  button changed from `bg-teal hover:bg-teal-light` to
  `bg-burgundy hover:bg-burgundy-dark` to match the 1st panel.

### What was deliberately NOT changed
- Header nav links, session/unread-count logic, search form behavior
  (GET to `/products`), input styling, and all other pages/sections
  untouched — visual-only header change.

### Testing performed
- `npx tsc --noEmit` clean after each header edit.
- `plan.md` does not exist in the repo (searched `**/*.md`), so no update
  was possible/needed; `README.md` design-language note extended with the
  header panel colors, checkered wood overlay, and enlarged logo.
