-- ============================================================================
-- Manual migration: Role enum BUYER/SELLER -> BUYER_SELLER
-- ============================================================================
-- This project has no committed Prisma migration history yet (schema.prisma
-- has been the single source of truth through every phase so far), so this
-- is written as a standalone script rather than a `prisma migrate dev`
-- output. Run it against your actual database BEFORE running
-- `npx prisma migrate dev` / `npx prisma db push` against the updated
-- schema.prisma — Prisma's own migration diff cannot do this remapping
-- automatically (a plain "recreate the enum" migration would fail the
-- moment it hit a row still containing 'BUYER' or 'SELLER', since that text
-- has no home in the new enum).
--
-- Run STEP 1 and STEP 2 as separate statements/transactions — PostgreSQL
-- does not allow a newly-added enum value (ALTER TYPE ... ADD VALUE) to be
-- used in the same transaction that added it.
--
-- Safe to run against a fresh/empty database too: every UPDATE is a no-op
-- if there are no matching rows.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1 (expand): add BUYER_SELLER alongside the existing values, then
-- migrate every user's roles array to use it instead of BUYER/SELLER.
-- Run this block, then commit, before STEP 2.
-- ----------------------------------------------------------------------------

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BUYER_SELLER';

-- (commit / new connection here — see note above)

-- Collapse BUYER and/or SELLER into BUYER_SELLER for every affected user,
-- de-duplicating with DISTINCT so a user who previously had BOTH BUYER and
-- SELLER ends up with a single BUYER_SELLER entry, not two. ADMIN and STAFF
-- rows are untouched because neither 'BUYER' nor 'SELLER' appears in their
-- roles array, so the WHERE clause never matches them — ADMIN can never end
-- up with BUYER_SELLER through this script, matching the "ADMIN must never
-- receive BUYER_SELLER" requirement.
UPDATE "User"
SET roles = (
  SELECT ARRAY(
    SELECT DISTINCT role
    FROM unnest(
      array_replace(array_replace(roles::text[], 'BUYER', 'BUYER_SELLER'), 'SELLER', 'BUYER_SELLER')
    ) AS role
  )
)::"Role"[]
WHERE 'BUYER' = ANY(roles::text[]) OR 'SELLER' = ANY(roles::text[]);

-- Verify before continuing to STEP 2:
--   SELECT id, email, roles FROM "User" WHERE roles::text[] && ARRAY['BUYER','SELLER'];
-- should return zero rows.

-- ----------------------------------------------------------------------------
-- STEP 2 (contract): PostgreSQL has no ALTER TYPE ... DROP VALUE, so removing
-- BUYER/SELLER from the enum means recreating it. Only run this once STEP 1
-- has been verified to have converted every row (this is also exactly what
-- `npx prisma migrate dev` will generate/require once schema.prisma no
-- longer lists BUYER/SELLER — running it here manually first, with the
-- explicit USING mapping below, is what makes that later `prisma migrate
-- dev` a no-op / clean diff instead of a failing one).
-- ----------------------------------------------------------------------------

CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'STAFF', 'BUYER_SELLER');

ALTER TABLE "User"
  ALTER COLUMN roles TYPE "Role_new"[]
  USING roles::text[]::"Role_new"[];

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

-- ============================================================================
-- End of manual migration. After this succeeds, run:
--   npx prisma migrate dev --name role_model_buyer_seller_merge --create-only
-- and confirm the generated migration is empty/no-op against the schema
-- (it should be, since the database now already matches schema.prisma),
-- then `npx prisma generate` to refresh the Prisma Client types.
-- ============================================================================
