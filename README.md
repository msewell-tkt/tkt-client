# Turnkey Tracker Vue client

Vue 3 + PrimeVue client for the Micronaut API.

## Development

Start PostgreSQL and the API from the repository root:

```bash
docker compose up -d postgres
./gradlew run
```

In another terminal:

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173/login?tenantId=TENANT_UUID`. The tenant ID is taken from the URL and is not entered by the user. The login flow first posts the email and tenant ID to `/login/pin`, then posts the emailed PIN to `/login` for verification. Vite proxies `/login`, `/auth`, and `/api` to the API on port 8080.

The access token exists only in JavaScript memory. The refresh token is held in an HttpOnly cookie and is sent automatically to `/auth/refresh`. A protected API response with status 401 triggers one refresh attempt and one retry. A failed refresh returns the user to the login route.
