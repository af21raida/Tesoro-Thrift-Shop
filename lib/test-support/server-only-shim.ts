// Vitest (plain Vite/Node, not Next's RSC bundler) runs the real
// "server-only" package, which throws by design outside a Server
// Component context. Next.js itself no-ops this import in every context
// its own bundler considers valid (Server Components, Server Actions,
// Route Handlers — everything this codebase's lib/ modules actually run
// in), so the throw is a test-runner artifact, not a real constraint this
// project violates. vitest.config.ts aliases "server-only" to this empty
// module so unit/integration tests can import server-only lib/ code the
// same way `next build`/`next dev` already do.
export {};
