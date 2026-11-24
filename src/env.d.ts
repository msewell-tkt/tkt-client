/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the tkt-core API including its version, e.g. http://localhost:2112/api/v1. Every service path is appended to it. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
