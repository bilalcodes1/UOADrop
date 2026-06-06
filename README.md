# UOADrop 📎

A **desktop-first, local-first print request management system** for registered print offices and libraries.

The current version is designed mainly for local desktop use inside a print office, with an optional online workflow. Students can upload files either through the office’s local network or through the online website, while the office owner manages all requests from an Electron desktop application linked to a specific office.

---

## The Problem

In many university print offices, students usually send their files in inefficient ways:

* **Telegram**: the student sends the file manually, then the office owner has to ask for the name, quantity, print type, and other details.
* **Bluetooth or cable transfer**: this is slow, unreliable, and especially problematic for iPhone users.
* **Manual handling**: files, names, quantities, and payment status can easily become mixed up.

This causes delays, mistakes, repeated questions, and an unorganized printing workflow.

---

## The Solution

UOADrop provides a structured workflow between students and print offices.

The system consists of two connected parts:

* **Student Upload Page**
  A browser-based upload page that works on the same local network or through the online website.

* **Office Dashboard**
  An Electron desktop dashboard used by the office owner to manage requests, files, pricing, status, and delivery.

---

## Implemented Features

* Upload multiple files within the same request.
* Support for multiple offices/libraries.
* Each office has its own activation code, upload link, and QR code.
* Public upload link allows the student to choose the office.
* Office-specific QR link automatically selects the correct office.
* Student name and default settings are saved locally for repeated use.
* Independent print settings for each file inside the same request.
* Ticket number and pickup PIN are displayed immediately after submission.
* Automatic page counting for supported files:

  * `PDF`
  * `PPTX`
  * `JPG`
  * `PNG`
* Real-time dashboard updates when a new request arrives.
* Review request files and edit print settings from the dashboard.
* Manual price entry by the office owner before marking an order as ready.
* Dashboard filters by:

  * status
  * source: `local` / `online`
  * payment status
  * ticket number
  * name
  * email
  * Telegram username
  * transaction number
* Clear workflow buttons:

  * `Print`
  * `Ready`
  * `Received`
* Automatic movement of requests to the ready section or archive.
* Online requests are synced with Supabase when status, price, or payment changes.
* Online mirror is removed when an online request is deleted locally, preventing re-import.
* Bulk announcement system for online requests using Email/Telegram.
* Live recipient count from Supabase before sending announcements.
* Project information tab inside the dashboard.
* Developer, academic, and official page cards inside the dashboard.
* “About UOADrop” section inside the student page.
* University and college branding inside the student page.
* Local serving of logos and UI assets from the Fastify server to ensure the system works inside the local network without depending on external internet access.

---

## User Roles

| Role           | Description                       | Device/Access                         |
| -------------- | --------------------------------- | ------------------------------------- |
| Office Owner   | Manages print requests            | Laptop/PC + router + printer          |
| Local Student  | Uploads inside the office network | Browser connected to the office Wi-Fi |
| Online Student | Uploads remotely                  | Public website or office QR link      |

---

## Architecture Overview

```txt
                 Student Device
                       │
               Browser on Local Network
                       │
              http://<LAN-IP>:3737/
                       │
              ┌────────▼────────┐
              │ Electron Desktop │
              │  Fastify Server  │
              │  SQLite Database │
              └────────┬────────┘
                       │
                React Dashboard
                 for Office Owner
```

---

## Tech Stack

| Layer            | Technology                                                                |
| ---------------- | ------------------------------------------------------------------------- |
| Language         | TypeScript                                                                |
| Student Page     | Standalone HTML/CSS/JS inside `apps/desktop/resources/student.html`       |
| Dashboard UI     | React + Vite inside Electron renderer                                     |
| Desktop App      | Electron                                                                  |
| Local Server     | Fastify                                                                   |
| Local Database   | better-sqlite3                                                            |
| Local Assets     | Logos and UI files served locally from `resources/`                       |
| Page Counting    | pdf-lib + local PPTX analysis + images as one page                        |
| Online Web App   | Next.js on Vercel                                                         |
| Online Backend   | Supabase Storage + Supabase Postgres                                      |
| Monorepo         | pnpm workspaces + Turborepo                                               |
| Notifications    | Local Electron system notifications + online Email/Telegram notifications |
| Scheduled Alerts | Supabase `pg_cron` for delay notifications                                |

---

## Documentation

| File                                               | Purpose                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)     | Full architecture and technical details                          |
| [`docs/SETUP.md`](docs/SETUP.md)                   | Router and laptop setup guide for office owners                  |
| [`docs/RISKS.md`](docs/RISKS.md)                   | Risks, prevention, and response plan                             |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)               | Product roadmap and phases                                       |
| [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md)   | Online notification system using Email and Telegram              |
| [`docs/GAPS.md`](docs/GAPS.md)                     | Critical gap analysis before release                             |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)           | Final product decisions such as PIN, pricing, and queue behavior |
| [`docs/HARDENING.md`](docs/HARDENING.md)           | Phase 0.5 security and reliability fixes                         |
| [`docs/GLOSSARY.md`](docs/GLOSSARY.md)             | Terms, roles, and system vocabulary                              |
| [`docs/RELEASE-v0.1.5.md`](docs/RELEASE-v0.1.5.md) | Current release notes and download files                         |

---

## Quick Start for Developers

### Requirements

* Node.js 20 or higher
* pnpm 8 or higher
* Git

### Install dependencies

```bash
pnpm install
```

### Run the desktop app

```bash
pnpm --filter @uoadrop/desktop dev
```

### Build the desktop app

```bash
pnpm --filter @uoadrop/desktop build
```

---

## Monorepo Structure

```txt
UOADrop/
├── apps/
│   ├── web/         # Next.js online upload app + notification APIs
│   └── desktop/     # Electron + Fastify + SQLite + React dashboard
├── packages/
│   └── shared/      # shared types, constants, and validation helpers
├── docs/            # full documentation
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Current Status

**Current version:** `v0.1.5`

**Download release:**
[GitHub Releases — UOADrop v0.1.5](https://github.com/bilalcodes1/UOADrop/releases/tag/v0.1.5)

Published release files:

* `UOADrop.Setup.0.1.5.exe` — Windows installer
* `UOADrop.0.1.5.exe` — Windows portable version
* `UOADrop-0.1.5.dmg` — macOS Intel
* `UOADrop-0.1.5-mac.zip` — macOS Intel ZIP
* `UOADrop-0.1.5-arm64.dmg` — macOS Apple Silicon
* `UOADrop-0.1.5-arm64-mac.zip` — macOS Apple Silicon ZIP
* `SHA256SUMS.txt` — file checksums

---

## Completed

* [x] Electron app with React dashboard
* [x] Local Fastify server on port `3737`
* [x] Local SQLite database and migrations
* [x] Browser-based student upload page
* [x] Pickup PIN shown in the student page and dashboard
* [x] Page counting for supported file types
* [x] Independent print settings per file
* [x] Project information tab inside the dashboard
* [x] Local visual identity assets served through the local server
* [x] Academic information section inside the student page and dashboard
* [x] Online upload through Next.js/Vercel and Supabase
* [x] Import online requests into the desktop app
* [x] Download online files locally
* [x] Sync online mirror when price, status, payment, or deletion changes
* [x] Ready/Received notifications
* [x] Bulk announcement interface for online recipients through Email/Telegram
* [x] Office selection from the public link
* [x] Automatic office detection from office QR links
* [x] Admin panel for managing offices/libraries
* [x] Activation codes for offices
* [x] Copy activation code buttons
* [x] Delete libraries from the admin panel
* [x] Desktop release builds uploaded through GitHub Releases

---

## Working Workflows

### Desktop Offline MVP

The local-first desktop workflow is working and can be used inside a print office without depending on external internet access.

### Optional Online Workflow

The online workflow is also working:

* Students upload through `https://uoadrop.vercel.app`
* Files are stored in Supabase
* Requests are imported into the desktop app
* Status, price, payment, and deletion changes are synced back

### Multi-Office Workflow

The system supports multiple registered offices/libraries:

* Each office has an activation code
* Each desktop app is linked to a specific office
* Each office has its own upload link and QR code
* The public upload link allows students to choose the correct office

---

## Deferred After Submission

* [ ] Official code signing and notarization
* [ ] Full auto-update system

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for more details.

---

## Project Type

University software project focused on solving a real workflow problem in print offices and libraries using a local-first desktop architecture with optional online support.

---

## License

Private university project — license not specified yet.
