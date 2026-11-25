# Turnkey Tracker Vue client

Vue 3 + PrimeVue client for the tkt-core Micronaut API (`../tkt-core`).

## Development

Start PostgreSQL and the API from the tkt-core repository:

```bash
cd ../tkt-core
docker compose up -d postgres
./gradlew run          # API listens on http://localhost:2112
```

In another terminal, from this repository:

```bash
npm install
npm run dev            # http://localhost:5173
```

### Configuration

`.env.development` sets:

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the API, e.g. `http://localhost:2112`. Leave empty to call the API on the same origin. |

The client calls the API cross-origin; tkt-core's CORS config allows `http://localhost:5173` and `http://127.0.0.1:5173` with credentials. There is no Vite proxy.

## Sign-in

Open `http://localhost:5173/login`. The user never types a tenant: after the PIN is verified, a user with one workspace is signed in to it and a user with several picks one. A user with none can’t sign in. A `tenantId` hint (from the query parameter, the redirect target, or the tenant this browser last signed in to) shows that workspace’s logo and preselects it.

The login flow posts the email to `/login/pin`, posts the email and PIN to `/login/tenants` to list the user’s workspaces, then posts the email, PIN and chosen tenant ID to `/login`.

The access token exists only in JavaScript memory. The refresh token is held in an HttpOnly cookie and is sent automatically to `/auth/refresh`. A protected API response with status 401 triggers one refresh attempt and one retry; if the refresh fails, the router sends the user to the login route, keeping the page they were on as the redirect.

A user with more than one workspace gets a switcher in the header. It calls `/auth/switch`, which replaces the refresh cookie without a new PIN, then reloads the app on the home page. Other open tabs reload too.

## Project layout

- `src/services/` — `BaseApiService` (fetch, auth, refresh) and one service per API area (`DashboardService`, `ActivityService`, `PropertyService`, …).
- `src/components/AppHeader.vue` — shared top navigation and sign-out.
- `src/components/RecentActivity.vue` — the home page’s latest work (`GET /activity`); an entry opens its work order (`/work-orders?order=ID`).
- `src/components/UserDetail.vue` — a user’s profile, roles, user types and properties; the user page and the scheduler’s team member panel (Admins) both show it.
- `src/views/` — one file per route. Scheduler, Work orders and Users still use sample data.
