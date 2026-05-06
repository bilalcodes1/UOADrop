# Desktop Release Checklist

## Before packaging

- Confirm `pnpm typecheck` and `pnpm build` pass
- Confirm `apps/desktop/resources/runtime-config.json` is **not** committed
- Confirm Supabase production schema/RLS has already been applied
- Confirm Vercel has the required admin/desktop/token/encryption/notification environment variables
- Confirm the packaged desktop build will run on a **trusted print office machine**
- Confirm every office/library has a generated activation code from `/admin`

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

- Public builds do not require `runtime-config.json`; the app defaults to `https://uoadrop.vercel.app`.
- Public builds are activated per office/library using an activation code, and the online upload URL includes the selected office slug.
- If a custom gateway is needed, place `runtime-config.json` on the trusted machine using one of these locations:
  - userData directory
  - next to the packaged executable
  - app resources directory
- The file should contain only:
  - `desktopGatewayUrl`
- Supabase, Telegram, SMTP, and encryption private keys must stay in Vercel environment variables.

## Validate on the target machine

- App launches successfully
- Online workflow activates from Settings using an office/library activation code and starts through the Gateway without local service-role keys
- The Settings panel displays the linked office/library name and the correct online upload URL
- The online wall sign QR points to `https://uoadrop.vercel.app/?library=<slug>`
- Encrypted online uploads import successfully when encryption is enabled
- Online request mirror sync works
- Cleanup/repair works
- Local SQLite DB and `online-requests` storage are writable
- Printer queue works with the target printer setup

## Still required for public-grade release

- Proper `.icns` and `.ico` assets
- macOS signing and notarization
- Windows signing
- Final smoke test on both platforms
- Auto-update and signed installers
