import { PrismaClient } from "@prisma/client";

/**
 * ISSUE #2's APPROACH TO "REAL POSTGRES, NOT MOCKS"
 * ===================================================
 * The concurrency guarantees this project relies on — the guarded
 * `UPDATE ... WHERE` pattern in lib/inventory/stock.ts and
 * lib/auction/bidding.ts, and the `SELECT ... FOR UPDATE` row lock in
 * lib/auction/closing.ts — are properties of how PostgreSQL executes and
 * locks rows under real concurrent connections. An in-memory mock of
 * Prisma, or a swap to SQLite, would not exercise MVCC/row-locking at all
 * and could pass these tests while the real guard was broken (or vice
 * versa) — testing the mock instead of the thing that matters. A
 * dedicated testcontainer/Docker Postgres was considered but rejected as
 * an unnecessary new dependency (the brief explicitly says not to add
 * one) for a project that already requires a running Postgres instance
 * for `npm run dev` in the first place.
 *
 * So: these integration tests run against whatever `DATABASE_URL` the
 * environment already has configured — the same database `npm run dev`
 * and `npm run seed` use. `hasDatabaseUrl` gates every integration test
 * file behind `describe.skipIf`, so `npm test` still passes cleanly in an
 * environment with no database configured (this sandbox included) instead
 * of hard-failing; running it against a real dev database exercises the
 * genuine race. For CI, the recommendation is a dedicated disposable
 * Postgres database (e.g. a docker-compose service scoped to CI) so tests
 * never run against real data — this project doesn't have CI configured
 * yet, so that wiring is left as a follow-up rather than invented here.
 *
 * Every fixture below creates real rows with randomized, test-prefixed
 * identifiers, and every test file cleans up what it created in an
 * `afterAll`, in FK-safe order (Transaction/OrderItem/Order before Bid
 * before Auction before Product before Category before User) — this
 * schema's relations are a mix of Cascade and Restrict (Phase 11 issue
 * #6 made Product -> Category explicitly Restrict), so deletion order
 * matters here the same way it would in application code.
 */
export const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

export const testPrisma = new PrismaClient();

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function makeTestUser(label: string) {
  return testPrisma.user.create({
    data: {
      name: `Test ${label}`,
      email: `test-${label}-${uniqueSuffix()}@example.test`,
      passwordHash: "not-a-real-hash",
      // Phase 12: Role enum merged BUYER/SELLER into BUYER_SELLER.
      roles: ["BUYER_SELLER"],
    },
  });
}

export async function makeTestCategory() {
  const suffix = uniqueSuffix();
  return testPrisma.category.create({
    data: { name: `Test Category ${suffix}`, slug: `test-category-${suffix}` },
  });
}

export async function makeTestAuctionProduct(categoryId: string) {
  return testPrisma.product.create({
    data: {
      name: "Test Auction Item",
      description: "Created by an automated test — safe to delete.",
      price: 10,
      type: "AUCTION_ITEM",
      categoryId,
    },
  });
}

export async function makeTestStockedProduct(categoryId: string, stock: number) {
  const product = await testPrisma.product.create({
    data: {
      name: "Test Stocked Item",
      description: "Created by an automated test — safe to delete.",
      price: 10,
      type: "THRIFT_STOCK",
      categoryId,
    },
  });
  await testPrisma.inventory.create({
    data: { productId: product.id, stock, available: true },
  });
  return product;
}
