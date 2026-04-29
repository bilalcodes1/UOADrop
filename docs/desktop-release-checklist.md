# Desktop Release Checklist

## Before packaging

- Confirm `pnpm typecheck` and `pnpm build` pass
- Confirm `apps/desktop/resources/runtime-config.json` is **not** committed
- Confirm Supabase production schema/RLS has already been applied
- Confirm the packaged desktop build will run on a **trusted librarian machine**

## Build artifacts

- macOS local build:
  - `pnpm --filter @uoadrop/desktop run dist:mac`
  - Builds both Apple Silicon (`arm64`) and Intel (`x64`) artifacts.
- Windows build:
  - `pnpm --filter @uoadrop/desktop run dist:win`
  - Builds Windows `x64` artifacts by default.
  - Prefer running on Windows or CI for final Windows validation.
  - Use `pnpm --filter @uoadrop/desktop run dist:win:arm64` only for Windows ARM devices.

## After packaging

- Place `runtime-config.json` on the trusted machine using one of these locations:
  - userData directory
  - next to the packaged executable
  - app resources directory
- The file should contain:
  - `supabaseUrl`
  - `supabaseAnonKey`
  - `supabaseServiceRoleKey`

## Validate on the target machine

- App launches successfully
- Online workflow starts without the service-role-key error
- Online request mirror sync works
- Cleanup/repair works
- Local SQLite DB and `online-requests` storage are writable
- Printer queue works with the target printer setup

## Still required for public-grade release

- Proper `.icns` and `.ico` assets
- macOS signing and notarization
- Windows signing
- Final smoke test on both platforms
