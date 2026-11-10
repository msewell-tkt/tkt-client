/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the tkt-core API, e.g. http://localhost:2112. Empty means same origin. */
  readonly VITE_API_BASE_URL?: string
  /** Optional tenant used when the login URL carries no tenantId (local development). */
  readonly VITE_TENANT_ID?: string
  /** Apex domain tenants are served under, e.g. app.example.com or localhost. A host of `<label>.<this>` is a tenant subdomain. */
  readonly VITE_APP_DOMAIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
