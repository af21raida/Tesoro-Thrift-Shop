import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // See lib/test-support/server-only-shim.ts for why this alias exists.
      "server-only": path.resolve(__dirname, "lib/test-support/server-only-shim.ts"),
    },
  },
  test: {
    environment: "node",
    // Integration tests talk to a real Postgres instance (see
    // lib/test-support/db.ts) and share table state, so they can't run in
    // parallel workers against the same database without racing each
    // other's fixtures.
    fileParallelism: false,
  },
});
