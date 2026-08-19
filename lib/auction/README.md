# auction

Phase 8. `bidding.ts` — concurrency-safe bid placement (see its doc
comment for the full race-condition analysis). `closing.ts` — idempotent
auction finalization / closing job, called both from an admin-triggered
Route Handler and lazily from the public auction pages.
