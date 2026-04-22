// Drizzle ORM schema — SQLite (local offline DB on librarian laptop)
// Phase 1.3: populate with real tables matching docs/ARCHITECTURE.md schema.
//
// Same logical tables as pg.ts, but using drizzle-orm/sqlite-core.
// Sync strategy: local writes → outbox → push to Supabase when online.

export const __placeholder = true;
