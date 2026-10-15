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
| `VITE_TENANT_ID` | Optional fallback tenant for local development when the login link has no `tenantId`. |

The client calls the API cross-origin; tkt-core's CORS config allows `http://localhost:5173` and `http://127.0.0.1:5173` with credentials. There is no Vite proxy.

## Sign-in

Open `http://localhost:5173/login?tenantId=TENANT_UUID`. The tenant is never typed by the user. It is resolved, in order, from the `tenantId` query parameter, the `tenantId` on the redirect target, the tenant this browser last signed in to, and finally `VITE_TENANT_ID`.

The login flow posts the email and tenant ID to `/login/pin`, then posts the emailed PIN to `/login`.

The access token exists only in JavaScript memory. The refresh token is held in an HttpOnly cookie and is sent automatically to `/auth/refresh`. A protected API response with status 401 triggers one refresh attempt and one retry; if the refresh fails, the router sends the user to the login route, keeping the page they were on as the redirect.

## Project layout

- `src/services/` — `BaseApiService` (fetch, auth, refresh) and one service per API area (`DashboardService`, `PropertyService`).
- `src/components/AppHeader.vue` — shared top navigation and sign-out.
- `src/views/` — one file per route. Scheduler, Work orders and Users still use sample data.
