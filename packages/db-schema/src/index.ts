// Re-export both dialects. Consumers choose via subpath imports:
//   import { requests } from '@uoadrop/db-schema/pg';
//   import { requests } from '@uoadrop/db-schema/sqlite';
//
// Phase 1.3 will populate these files with real Drizzle schema.

export * as pg from './pg';
export * as sqlite from './sqlite';
