# @uoadrop/desktop

Electron app for the librarian workstation.

## Status: Placeholder (Phase 1.2+)

Will contain:

- `src/main/` — Electron main process (window, single-instance lock, security flags)
- `src/main/ipc.ts` — IPC handlers: `file:open`, `file:print`, `printer:status`
- `src/main/server.ts` — embedded Fastify server (port 3737)
- `src/main/db.ts` — better-sqlite3 connection + migrations
- `src/main/lock-screen.ts` — idle overlay
- `src/preload/` — context-isolated preload bridge
- `src/renderer/` — React dashboard (3 buttons: view / print / ready)

Scaffold with `electron-vite` in Phase 1.2.

## Dev

```bash
pnpm --filter @uoadrop/desktop dev
```
