import { PrismaClient } from "@prisma/client";

/**
 * Next.js dev mode hot-reloads modules on every save, which would otherwise
 * create a fresh PrismaClient (and a fresh DB connection pool) on every
 * change. Caching the instance on `globalThis` in development avoids
 * exhausting Postgres connections. In production, a single instance is
 * created once per server process, which is what we want.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
