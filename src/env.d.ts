/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the tkt-core API, e.g. http://localhost:2112. Empty means same origin. */
  readonly VITE_API_BASE_URL?: string
  /** Optional tenant used when the login URL carries no tenantId (local development). */
  readonly VITE_TENANT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
