import "server-only";
import { prisma } from "@/lib/db/prisma";
import { isLowStock, isOutOfStock } from "@/lib/inventory/stock";

/**
 * Every function here runs a fresh query against Postgres — nothing is
 * cached, precomputed, or mocked, per the Phase 1 analysis's explicit
 * "all computed from real rows, not mocked" requirement for Phase 10.
 * Pages call the subset relevant to their role (admin/reports uses all of
 * these; staff/reports uses only getSalesSummary and getInventorySummary,
 * matching the Staff use-case diagram's narrower "Participate in Sales
 * Reports" scope with no user/auction-financial authority).
 */

export interface SalesSummary {
  totalRevenue: string;
  totalOrders: number;
  averageOrderValue: string;
  bySource: Array<{ source: "CHECKOUT" | "AUCTION"; revenue: string; orders: number }>;
}

/** Only CONFIRMED orders count as a completed sale — PENDING/FAILED/CANCELLED never contributed real revenue. */
export async function getSalesSummary(): Promise<SalesSummary> {
  const [totals, bySource] = await Promise.all([
    prisma.order.aggregate({
      where: { status: "CONFIRMED" },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["source"],
      where: { status: "CONFIRMED" },
      _sum: { totalAmount: true },
      _count: true,
    }),
  ]);

  const totalRevenue = totals._sum.totalAmount?.toNumber() ?? 0;
  const totalOrders = totals._count;

  return {
    totalRevenue: totalRevenue.toFixed(2),
    totalOrders,
    averageOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : "0.00",
    bySource: bySource.map((row) => ({
      source: row.source,
      revenue: (row._sum.totalAmount?.toNumber() ?? 0).toFixed(2),
      orders: row._count,
    })),
  };
}

export interface DailyRevenuePoint {
  day: string; // "Aug 05"
  revenue: number;
  orders: number;
}

/**
 * Prisma's groupBy has no date-truncation, so this is one of the few raw
 * queries in the project outside lib/auction — same justification as
 * bidding.ts's atomic UPDATE: the aggregation genuinely needs SQL, not
 * three round trips grouped in application code.
 */
export async function getRevenueByDay(days = 14): Promise<DailyRevenuePoint[]> {
  const rows = await prisma.$queryRaw<Array<{ day: Date; revenue: string | null; orders: bigint }>>`
    SELECT date_trunc('day', "createdAt") AS day, SUM("totalAmount") AS revenue, COUNT(*) AS orders
    FROM "Order"
    WHERE status = 'CONFIRMED' AND "createdAt" >= now() - (${days}::text || ' days')::interval
    GROUP BY day
    ORDER BY day ASC
  `;

  return rows.map((row) => ({
    day: new Date(row.day).toLocaleDateString(undefined, { month: "short", day: "2-digit" }),
    revenue: Number(row.revenue ?? 0),
    orders: Number(row.orders),
  }));
}

export interface InventorySummary {
  totalUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockItems: Array<{ productId: string; name: string; stock: number; lowStockThreshold: number }>;
}

export async function getInventorySummary(): Promise<InventorySummary> {
  const rows = await prisma.inventory.findMany({
    include: { product: { select: { name: true } } },
  });

  const totalUnits = rows.reduce((sum, row) => sum + row.stock, 0);
  const lowStock = rows.filter((row) => isLowStock(row.stock, row.lowStockThreshold));
  const outOfStockCount = rows.filter((row) => isOutOfStock(row.stock)).length;

  return {
    totalUnits,
    lowStockCount: lowStock.length,
    outOfStockCount,
    lowStockItems: lowStock
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10)
      .map((row) => ({
        productId: row.productId,
        name: row.product.name,
        stock: row.stock,
        lowStockThreshold: row.lowStockThreshold,
      })),
  };
}

export interface AuctionPerformance {
  countsByStatus: Record<"PENDING" | "UPCOMING" | "ACTIVE" | "ENDED" | "CANCELLED", number>;
  totalBids: number;
  auctionRevenue: string;
  topAuctions: Array<{
    auctionId: string;
    productName: string;
    bidCount: number;
    winningBid: string | null;
    winnerName: string | null;
  }>;
}

export async function getAuctionPerformance(): Promise<AuctionPerformance> {
  const [byStatus, bidCount, revenue, topAuctions] = await Promise.all([
    prisma.auction.groupBy({ by: ["status"], _count: true }),
    prisma.bid.count(),
    prisma.order.aggregate({
      where: { source: "AUCTION", status: "CONFIRMED" },
      _sum: { totalAmount: true },
    }),
    prisma.auction.findMany({
      where: { status: "ENDED" },
      include: {
        product: { select: { name: true } },
        winner: { select: { name: true } },
        _count: { select: { bids: true } },
      },
      orderBy: { bids: { _count: "desc" } },
      take: 5,
    }),
  ]);

  const countsByStatus: AuctionPerformance["countsByStatus"] = {
    PENDING: 0,
    UPCOMING: 0,
    ACTIVE: 0,
    ENDED: 0,
    CANCELLED: 0,
  };
  for (const row of byStatus) {
    countsByStatus[row.status] = row._count;
  }

  return {
    countsByStatus,
    totalBids: bidCount,
    auctionRevenue: (revenue._sum.totalAmount?.toNumber() ?? 0).toFixed(2),
    topAuctions: topAuctions.map((auction) => ({
      auctionId: auction.id,
      productName: auction.product.name,
      bidCount: auction._count.bids,
      winningBid: auction.currentHighestBid?.toString() ?? null,
      winnerName: auction.winner?.name ?? null,
    })),
  };
}

export interface TopSeller {
  userId: string;
  name: string;
  soldListings: number;
}

/**
 * "Sold listings" — units actually sold through checkout (summed
 * `OrderItem.quantity` for order items tied to that seller's listings),
 * not a count of Listing rows.
 *
 * Phase 12 fix: this used to `groupBy` on `Listing.status === "SOLD"`,
 * which was a correct proxy for "units sold" back when a listing was
 * always exactly one item and reaching SOLD meant that one unit had been
 * bought. Now that listings carry real Inventory quantities
 * (create-listing.ts) and checkout.ts decrements stock without ever
 * flipping `Listing.status` to SOLD, that old query would silently stop
 * counting any sale made after this change — it isn't a metric that
 * generalizes to "sold 3 of 10," only "sold the 1 of 1." Summing
 * `OrderItem.quantity` is the metric that's actually correct for both the
 * old single-unit case and the new multi-unit one, and needs a raw
 * aggregate query (rather than Prisma's `groupBy`) because Prisma can't
 * group by a field on a *related* model — `sellerId` lives on `Listing`,
 * not `OrderItem` — in a single query.
 */
export async function getTopSellers(limit = 5): Promise<TopSeller[]> {
  const rows = await prisma.$queryRaw<Array<{ sellerId: string; name: string; soldUnits: bigint }>>`
    SELECT l."sellerId" AS "sellerId", u.name AS name, SUM(oi.quantity)::bigint AS "soldUnits"
    FROM "OrderItem" oi
    JOIN "Listing" l ON l.id = oi."listingId"
    JOIN "User" u ON u.id = l."sellerId"
    GROUP BY l."sellerId", u.name
    ORDER BY "soldUnits" DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    userId: row.sellerId,
    name: row.name,
    soldListings: Number(row.soldUnits),
  }));
}

export interface TopBidder {
  userId: string;
  name: string;
  bidCount: number;
}

export async function getTopBidders(limit = 5): Promise<TopBidder[]> {
  const grouped = await prisma.bid.groupBy({
    by: ["userId"],
    _count: { userId: true },
    orderBy: { _count: { userId: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const bidders = await prisma.user.findMany({
    where: { id: { in: grouped.map((row) => row.userId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(bidders.map((bidder) => [bidder.id, bidder.name]));

  return grouped.map((row) => ({
    userId: row.userId,
    name: nameById.get(row.userId) ?? "Unknown",
    bidCount: row._count.userId,
  }));
}

export interface TopBuyer {
  userId: string;
  name: string;
  orders: number;
  totalSpent: string;
}

export async function getTopBuyers(limit = 5): Promise<TopBuyer[]> {
  const grouped = await prisma.order.groupBy({
    by: ["userId"],
    where: { status: "CONFIRMED" },
    _sum: { totalAmount: true },
    _count: true,
    orderBy: { _sum: { totalAmount: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const buyers = await prisma.user.findMany({
    where: { id: { in: grouped.map((row) => row.userId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(buyers.map((buyer) => [buyer.id, buyer.name]));

  return grouped.map((row) => ({
    userId: row.userId,
    name: nameById.get(row.userId) ?? "Unknown",
    orders: row._count,
    totalSpent: (row._sum.totalAmount?.toNumber() ?? 0).toFixed(2),
  }));
}
