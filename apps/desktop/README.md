# @uoadrop/desktop

Electron app for the librarian workstation.

## Status: Active app

This package currently contains the running desktop application:

- `src/main/` — Electron main process, IPC handlers, Fastify server, SQLite, printer polling, online sync, announcements
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
- Dashboard source/payment filters and online/offline dashboard statistics
- Request workflow actions: print queue, mark ready, mark delivered, delete, and file review
- Online request mirror sync for price/status/payment changes and online cancel-on-delete
- Dashboard tabbed layout with separate `معلومات المشروع` view
- Academic cards for the dean, department head, and supervisors with official profile links
- File drawer in the dashboard to review and edit per-file print options
- Online-only bulk announcements to Supabase contacts via Email/Telegram
- Local asset routes for `/uoadrop-logo.png`, `/university-of-anbar.svg`, and `/cs-college.svg`

## Dashboard workflow

- `طباعة`: enqueues the request for printing and moves eligible requests into `printing`.
- `جاهز`: requires a confirmed manual price, changes status to `ready`, clears hidden filters, and opens the ready view.
- `تم التسليم`: changes status to `done`, removes it from active selection, and opens the archive view.
- `حذف`: deletes the local request/files. If the request source is `online`, the Supabase mirror is first marked `canceled` so it is not imported again.
- `الملفات`: opens the file drawer for review and per-file option edits.

Online requests are synced through IPC/main-process handlers after price, status, workflow metadata, payment status, print queue, and delete actions.

## Online announcements

The Settings panel includes `إعلان جماعي للأونلاين`.

- Targets **online uploads only** (`print_requests.source = 'online'`).
- Recipient counts are loaded by the secure desktop gateway on the web deployment.
- Sending is delegated to the web API `/api/desktop/announcement`.
- Desktop sends only its activation token. Supabase service-role credentials stay on the web deployment.
- Email delivery requires SMTP variables on the web deployment.
- Telegram delivery requires `TELEGRAM_BOT_TOKEN` on the web deployment.

## Dev

```bash
pnpm --filter @uoadrop/desktop dev
pnpm --filter @uoadrop/desktop build
```

## Packaging

Do not commit production secrets into the repository.

1. Optionally create a runtime config file if you need a custom gateway URL:

```bash
UOADROP_DESKTOP_GATEWAY_URL='https://uoadrop.vercel.app' \
pnpm --filter @uoadrop/desktop runtime-config:write
```

This writes `resources/runtime-config.json` for local packaging only. The file is gitignored. Public builds default to `https://uoadrop.vercel.app`, so no runtime config is required for the standard release.
Online mode stays locked after installation until the librarian enters the activation password in the desktop Settings panel. The server returns a local desktop token for that machine.
Supabase, Telegram, SMTP, and private encryption keys must remain on the web deployment.

2. Build desktop artifacts:

```bash
pnpm --filter @uoadrop/desktop run pack
pnpm --filter @uoadrop/desktop run dist:mac
pnpm --filter @uoadrop/desktop run dist:win
```

Notes:

- `dist:mac` builds both Apple Silicon (`arm64`) and Intel (`x64`) macOS artifacts.
- `dist:win` builds Windows `x64` artifacts. Use `dist:win:arm64` only for Windows ARM devices.
- Packaged desktop builds require only local online activation from Settings. Online workflow calls the secure web gateway.
- Online announcements require the web deployment to have SMTP/Telegram variables configured.
- The app also looks for `runtime-config.json` in `userData`, next to the packaged executable, or under Electron resources.
- Local mac packaging is configured unsigned by default. Production signing/notarization should be added as a separate release step.
