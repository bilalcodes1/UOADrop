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

## Packaging

Do not commit production secrets into the repository.

1. Create a runtime config file from environment variables:

```bash
VITE_SUPABASE_URL='https://your-project.supabase.co' \
VITE_SUPABASE_ANON_KEY='your-anon-key' \
SUPABASE_SERVICE_ROLE_KEY='your-service-role-key' \
pnpm --filter @uoadrop/desktop runtime-config:write
```

This writes `resources/runtime-config.json` for local packaging only. The file is gitignored.

2. Build desktop artifacts:

```bash
pnpm --filter @uoadrop/desktop run pack
pnpm --filter @uoadrop/desktop run dist:mac
pnpm --filter @uoadrop/desktop run dist:win
```

Notes:

- `dist:mac` builds both Apple Silicon (`arm64`) and Intel (`x64`) macOS artifacts.
- `dist:win` builds Windows `x64` artifacts. Use `dist:win:arm64` only for Windows ARM devices.
- Packaged desktop builds require `SUPABASE_SERVICE_ROLE_KEY` for the online workflow service.
- The app also looks for `runtime-config.json` in `userData`, next to the packaged executable, or under Electron resources.
- Local mac packaging is configured unsigned by default. Production signing/notarization should be added as a separate release step.
