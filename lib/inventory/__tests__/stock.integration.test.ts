import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decrementStock, InsufficientStockError } from "@/lib/inventory/stock";
import { hasDatabaseUrl, testPrisma, makeTestCategory, makeTestStockedProduct } from "@/lib/test-support/db";

describe.skipIf(!hasDatabaseUrl)("decrementStock concurrency (Phase 11 audit issue #2, item 6)", () => {
  let categoryId: string;

  beforeAll(async () => {
    categoryId = (await makeTestCategory()).id;
  });

  afterAll(async () => {
    // Inventory cascade-deletes with its Product (onDelete: Cascade), so
    // deleting Product is enough here.
    await testPrisma.product.deleteMany({ where: { categoryId } });
    await testPrisma.category.delete({ where: { id: categoryId } });
    await testPrisma.$disconnect();
  });

  /**
   * This is the exact scenario lib/inventory/stock.ts's own docstring
   * describes as the reason for the guarded `UPDATE ... WHERE stock >=
   * quantity` pattern: two checkouts racing for the last unit of stock. A
   * naive read-then-write implementation would let both requests read
   * stock=1, both decide "there's enough," and both decrement — ending at
   * stock=-1 (or stock=0 with two sales recorded for one unit). This test
   * fails if that regression is ever reintroduced.
   */
  it("two concurrent decrementStock() calls at stock=1: only one succeeds, stock never goes negative", async () => {
    const product = await makeTestStockedProduct(categoryId, 1);

    const results = await Promise.allSettled([
      decrementStock(product.id, 1),
      decrementStock(product.id, 1),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError);

    const inventory = await testPrisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.stock).toBe(0);
    expect(inventory.stock).toBeGreaterThanOrEqual(0); // the DB CHECK constraint's own invariant, restated here
  });

  it("three concurrent decrementStock(quantity=1) calls at stock=2: exactly two succeed", async () => {
    const product = await makeTestStockedProduct(categoryId, 2);

    const results = await Promise.allSettled([
      decrementStock(product.id, 1),
      decrementStock(product.id, 1),
      decrementStock(product.id, 1),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(2);

    const inventory = await testPrisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.stock).toBe(0);
  });

  it("a single decrement below available stock succeeds and leaves the correct remainder", async () => {
    const product = await makeTestStockedProduct(categoryId, 5);
    await decrementStock(product.id, 2);
    const inventory = await testPrisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.stock).toBe(3);
  });

  it("rejects a decrement larger than available stock, leaving stock unchanged", async () => {
    const product = await makeTestStockedProduct(categoryId, 1);
    await expect(decrementStock(product.id, 5)).rejects.toBeInstanceOf(InsufficientStockError);
    const inventory = await testPrisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(inventory.stock).toBe(1);
  });
});
