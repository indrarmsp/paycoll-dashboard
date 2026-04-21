# Payment Collective Dashboard (Next.js)

Internal dashboard application built with Next.js (App Router) for two roles:
- **Admin**: main billing dashboard and shortcuts manager.
- **AR**: AR visit dashboard.

Data is fetched from Google Sheets (Visualization API response format) and rendered as tables/charts, with XLSX export support.

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Chart.js
- xlsx

## Features

- Role-based login (`admin` and `ar`) with server-side cookie session.
- Middleware-based route protection and role checks.
- Main dashboard:
  - Filters, search, pagination, sorting.
  - Chart visualizations.
  - XLSX export.
- AR dashboard:
  - Agent filtering and pagination.
  - XLSX export.
- Shortcuts page (admin):
  - LocalStorage-backed categories and shortcut cards.
  - Manual icon support (emoji or image URL), with default globe fallback.
- Client-side warm cache for dashboard payloads to improve perceived load speed.

## Project Structure

```text
app/
├── api/
│   ├── auth/
│   │   ├── login/route.ts    # Login endpoint, validates credentials and sets session cookie
│   │   └── logout/route.ts   # Logout endpoint, clears session cookie
│   └── sheets/
│       ├── ar/route.ts       # AR dashboard data API
│       └── main/route.ts     # Main dashboard data API
├── dashboard/
│   ├── loading.tsx           # Loading state for admin dashboard
│   └── page.tsx              # Admin dashboard page
├── dashboard-ar/
│   ├── loading.tsx           # Loading state for AR dashboard
│   └── page.tsx              # AR dashboard page
├── login/
│   └── page.tsx              # Login page
├── shortcuts/
│   └── page.tsx              # Shortcuts management page
├── globals.css               # Global styles
├── layout.tsx                # Root layout and metadata
└── page.tsx                  # Entry page with auth-based redirect
components/
├── app-shell.tsx             # Shared shell/header layout
├── dashboard-client.tsx      # Main dashboard client logic (charts, table, filters, export)
├── dashboard-ar-client.tsx   # AR dashboard client logic (table, filter, export)
├── login-client.tsx          # Login form and mode switch (admin/ar)
├── logout-button.tsx         # Logout action button
└── shortcuts-client.tsx      # Shortcuts CRUD UI with localStorage persistence
lib/
├── auth.ts                   # Session/auth helpers and credential resolution
├── server-auth.ts            # Server-side auth guards and redirect helpers
├── sheets.ts                 # Google Sheets fetch/parsing, cache, and stats utilities
├── shortcuts.ts              # Shortcuts normalization and defaults
└── types.ts                  # Shared TypeScript types
middleware.ts                 # Route protection and role-based access control
```

## Environment Variables

Create a `.env.local` file (or copy from `.env.example`) and fill:

```bash
MAIN_SHEET_URL=
AR_SHEET_URL=
PC_ADMIN_USERNAME=
PC_ADMIN_PASSWORD=
PC_AR_USERNAME=
PC_AR_PASSWORD=
```

### Notes

- `MAIN_SHEET_URL` and `AR_SHEET_URL` should be Google Sheets query endpoints compatible with the Visualization API response wrapper.
- If a sheet URL is empty, related API routes return empty payloads.

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
  - `/shortcuts`
- `ar` can access:
  - `/dashboard-ar`
- Unauthorized attempts are redirected to `/login?reason=unauthorized`.

## API Endpoints

- `POST /api/auth/login` - authenticate and set session cookie.
- `POST /api/auth/logout` - clear session cookie.
- `GET /api/sheets/main` - main dashboard data (`?limit=` optional).
- `GET /api/sheets/ar` - AR dashboard rows.

## Security Model (Current)

- Session stored in an HTTP-only cookie (`pc_session`).
- Session includes role, username, expiration, and request fingerprint.
- Fingerprint is derived from headers (`user-agent`, `accept-language`, `sec-ch-ua-platform`) and validated on each request.

## Troubleshooting

- **Login returns "Login credentials are not configured"**:
  - Ensure all `PC_*` env vars are set.
- **Dashboard is empty**:
  - Verify `MAIN_SHEET_URL` / `AR_SHEET_URL` values.
  - Ensure source sheet endpoints are publicly reachable by the app runtime.
- **Unauthorized redirects despite login**:
  - Browser or device header changes can invalidate fingerprint-bound sessions.
