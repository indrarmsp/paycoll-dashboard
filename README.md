# Payment Collective Dashboard (Next.js)

Internal dashboard application built with Next.js (App Router) for two roles:
- **Admin**: main billing dashboard, update tools, and shortcuts manager.
- **AR**: AR visit dashboard.

Data is fetched from Google Sheets in two ways:
- Google Visualization API endpoints (for main and AR dashboards).
- Google Sheets API (service account) for update/sync write operations.

The app includes XLSX export, role-based auth, and protected route navigation.

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Chart.js
- ExcelJS
- Google APIs (`googleapis`, `google-auth-library`)
- Lucide React icons

## Features

- Role-based login (`admin` and `ar`) with server-side cookie session.
- Middleware-based route protection and role checks.
- Main dashboard (`/dashboard`):
  - Search, filtering, sorting, pagination.
  - Category and payment status charts.
  - Selectable-column XLSX export via API.
  - Server bootstrap + client warm-cache refresh flow.
- AR dashboard (`/dashboard-ar`):
  - Agent filtering and pagination.
  - Per-row Google Maps action.
  - Selectable-column XLSX export via API.
  - SessionStorage warm cache.
- Update page (`/update`, admin only):
  - **Sync Report PRQ** from PRITI DATA (incremental append only).
  - **Upload VISEEPRO** from XLS/XLSX (append newer timestamped rows only).
- Shortcuts page (`/shortcuts`, admin only):
  - LocalStorage-backed categories and shortcut cards.
  - Supports emoji or image URL icons with globe fallback.

## Project Structure

```text
app/
├── api/
│   ├── auth/
│   │   ├── login/route.ts                 # Login endpoint (sets session cookie)
│   │   └── logout/route.ts                # Logout endpoint (clears session cookie)
│   ├── export/
│   │   └── dashboard/route.ts             # XLSX export endpoint (ExcelJS)
│   ├── sheets/
│   │   ├── ar/route.ts                    # AR dashboard data API
│   │   ├── main/route.ts                  # Main dashboard data API
│   │   └── update/
│   │       ├── sync-prq/route.ts          # Incremental sync to Report PRQ
│   │       └── upload-viseepro/route.ts   # XLS/XLSX upload to VISEEPRO sheet
│   └── shortcut-logo/
│       └── route.ts                       # Website logo resolver/proxy utility
├── dashboard/
│   ├── loading.tsx                        # Loading skeleton/state for admin dashboard route
│   └── page.tsx                           # Admin dashboard page (server bootstrap + shell)
├── dashboard-ar/
│   ├── loading.tsx                        # Loading skeleton/state for AR dashboard route
│   └── page.tsx                           # AR dashboard page (role-aware shell and nav)
├── login/
│   └── page.tsx                           # Login page entry (redirects away when already authed)
├── update/
│   └── page.tsx                           # Admin update tools page (PRQ sync + VISEEPRO upload)
├── globals.css                            # Global Tailwind/theme styles
├── layout.tsx                             # Root layout, metadata, and font setup
└── page.tsx                               # Root entry: redirects by current server session
components/
├── app-shell.tsx                          # Shared app frame (sidebar, topbar, logout)
├── dashboard-client.tsx                   # Main dashboard client UI (filters/charts/table/export)
├── dashboard-ar-client.tsx                # AR visit dashboard client UI (filter/table/maps/export)
├── login-client.tsx                       # Login form client logic for admin/ar modes
├── logout-button.tsx                      # Reusable logout action button
├── shortcuts-client.tsx                   # Shortcuts CRUD UI with LocalStorage persistence
└── update-client.tsx                      # Update actions UI for PRQ sync and XLS/XLSX upload
lib/
├── auth.ts                                # Session helpers, credential mapping, fingerprint checks
├── google-sheets-api.ts                   # Google Sheets API read/append/format helpers
├── nav-items.ts                           # Role-aware sidebar navigation builders
├── pagination.ts                          # Pagination helper utilities for visible page ranges
├── server-auth.ts                         # Server-side auth guards and redirects
├── sheets.ts                              # Visualization API parsing + dashboard cache helpers
├── shortcuts.ts                           # Shortcut normalization, defaults, and storage key
└── types.ts                               # Shared TypeScript types/interfaces
middleware.ts                              # Global route protection and role-based access middleware
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill values:

```bash
# Visualization API endpoints (dashboard read)
MAIN_SHEET_URL=
AR_SHEET_URL=

# Optional source URLs used to derive IDs for update actions
REPORT_PRQ_SHEET_URL=
COLLECTION_SHEET_URL=

# Google Sheets API credentials (for update/write operations)
GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SHEETS_PRIVATE_KEY=
GOOGLE_SHEETS_PROJECT_ID=

# Alternative credentials source (path to service account JSON)
GOOGLE_APPLICATION_CREDENTIALS=

# App login credentials
PC_ADMIN_USERNAME=
PC_ADMIN_PASSWORD=
PC_AR_USERNAME=
PC_AR_PASSWORD=
```

### Environment Notes

- `MAIN_SHEET_URL` and `AR_SHEET_URL` should return Google Visualization wrapper responses (`google.visualization.Query.setResponse(...)`).
- Update endpoints require Google Sheets API credentials and target sheet IDs.
- For update endpoints, `*_SHEET_ID` values are preferred. If omitted, IDs are derived from related sheet URLs when possible.
- `GOOGLE_SHEETS_PRIVATE_KEY` should preserve newline formatting (commonly escaped as `\n` in `.env.local`).

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Production

```bash
npm run build
npm run start
```

## Available Scripts

- `npm run dev` - start development server.
- `npm run build` - build production bundle.
- `npm run start` - run production server.
- `npm run lint` - run Next.js lint command.

## Auth and Access Rules

- Unauthenticated users are redirected to `/login`.
- `admin` can access:
  - `/dashboard`
  - `/dashboard-ar`
  - `/update`
  - `/shortcuts`
- `ar` can access:
  - `/dashboard-ar`
- Unauthorized attempts are redirected to `/login?reason=unauthorized`.

## API Endpoints

- `POST /api/auth/login` - authenticate and set session cookie.
- `POST /api/auth/logout` - clear session cookie.
- `GET /api/sheets/main` - main dashboard data (`?limit=` optional).
- `GET /api/sheets/ar` - AR dashboard rows.
- `POST /api/export/dashboard` - generate and download XLSX from submitted JSON rows.
- `POST /api/sheets/update/sync-prq` - sync incremental rows from PRITI DATA (Collection) to Report PRQ.
- `POST /api/sheets/update/upload-viseepro` - upload XLS/XLSX and append newer VISEEPRO rows.
- `GET /api/shortcut-logo?url=...` - fetch/proxy best candidate favicon/logo for a URL.

## Security Model (Current)

- Session stored in an HTTP-only cookie (`pc_session`) with `sameSite=lax`.
- Session includes role, username, expiration, and request fingerprint.
- Fingerprint is derived from request headers (`user-agent`, `accept-language`, `sec-ch-ua-platform`) and validated per request.
- Session TTL is 8 hours.

## Troubleshooting

- **Login returns "Login credentials are not configured"**:
  - Ensure all `PC_*` env vars are set.
- **Dashboard is empty**:
  - Verify `MAIN_SHEET_URL` / `AR_SHEET_URL` values.
  - Ensure source sheet endpoints are publicly reachable by the app runtime.
- **Update endpoints fail with credential errors**:
  - Verify `GOOGLE_SHEETS_*` vars or `GOOGLE_APPLICATION_CREDENTIALS`.
  - Ensure the service account has access to target spreadsheets.
- **Update sync/upload returns sheet ID configuration errors**:
  - Set `PRITI_DATA_SHEET_ID`, `REPORT_PRQ_SHEET_ID`, and `VISEEPRO_SHEET_ID`.
  - Or provide compatible sheet URLs to allow ID extraction.
- **Unauthorized redirects despite login**:
  - Browser/device header changes can invalidate fingerprint-bound sessions.
