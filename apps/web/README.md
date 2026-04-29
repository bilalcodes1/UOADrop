# @uoadrop/web

Online web application for student uploads (outside the library LAN).

## Status: Active

Contains:

- Online upload page for requests outside the library network
- Request tracking and pickup flow for cloud-backed requests
- PIN verification and Telegram linking flow
- Supabase-backed APIs and storage integration
- Optional browser-side online file encryption before Supabase Storage upload

## Online file encryption

Set `NEXT_PUBLIC_UOADROP_ENCRYPTION_PUBLIC_KEY` in Vercel to enable encryption for new online uploads.

- The value must be an RSA public key in SPKI PEM format, or base64 DER.
- Each uploaded file gets a random AES-256-GCM key.
- The AES key is encrypted with the configured RSA-OAEP-SHA256 public key.
- The matching private key must be configured only in the trusted desktop app.
