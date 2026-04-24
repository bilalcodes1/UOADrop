# @uoadrop/desktop

Electron app for the librarian workstation.

## Status: Active app

This package currently contains the running desktop application:

- `src/main/` — Electron main process, IPC handlers, Fastify server, SQLite, printer polling
- `src/preload/` — context-isolated preload bridge
- `src/renderer/` — React dashboard for the librarian
- `resources/student.html` — student upload page served locally by Fastify
- `resources/*.svg|*.png` — local branding assets served by the same Fastify server for LAN/offline use

## Implemented features

- Embedded Fastify server on port `3737`
- Local SQLite storage with runtime migrations
- Student upload page with multi-file queue and per-file print settings
- Student-side local persistence for name and default print options
- Student-side `عن UOADrop` section with academic/branding cards
- Pickup PIN generation and dashboard display
- Automatic page counting for `PDF`, `PPTX`, `JPG`, `JPEG`, `PNG`
- React dashboard with search, filters, pagination, pricing, and request actions
- Dashboard tabbed layout with separate `معلومات المشروع` view
- Academic cards for the dean, department head, and supervisors with official profile links
- File drawer in the dashboard to review and edit per-file print options
- Local asset routes for `/uoadrop-logo.png`, `/university-of-anbar.svg`, and `/cs-college.svg`

## Dev

```bash
pnpm --filter @uoadrop/desktop dev
pnpm --filter @uoadrop/desktop build
```
