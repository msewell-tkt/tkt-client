import { computed, reactive } from 'vue'
import { BaseApiService, type ApiAuthentication } from './services/BaseApiService'

interface TokenResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
}

interface TenantEmailRequest {
  email: string
  tenantId: string
}

interface LoginRequest extends TenantEmailRequest {
  pin: string
}

const TENANT_STORAGE_KEY = 'tkt-last-tenant-id'

function readStoredTenant(): string | null {
  try {
    return localStorage.getItem(TENANT_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeTenant(tenantId: string) {
  try {
    localStorage.setItem(TENANT_STORAGE_KEY, tenantId)
  } catch {
    // Storage can be unavailable (private mode); the tenant just won't be remembered.
  }
}

class AuthService extends BaseApiService implements ApiAuthentication {
  readonly state = reactive({
    accessToken: null as string | null,
    initialized: false,
  })

  readonly isAuthenticated = computed(() => Boolean(this.state.accessToken))

  private refreshPromise: Promise<boolean> | null = null
  private initializePromise: Promise<void> | null = null
  private sessionExpiredHandler: (() => void) | null = null

  constructor() {
    super()
  }

  getAccessToken(): string | null {
    return this.state.accessToken
  }

  /** The tenant this browser last signed in to, used to rebuild login links. */
  lastTenantId(): string | null {
    return readStoredTenant()
  }

  /** Registers what happens when the session can no longer be refreshed (the router sends the user to login). */
  setSessionExpiredHandler(handler: () => void) {
    this.sessionExpiredHandler = handler
  }

  onSessionExpired(): void {
    this.state.accessToken = null
    this.sessionExpiredHandler?.()
  }

  async requestPin(identity: TenantEmailRequest): Promise<void> {
    const response = await this.post('/login/pin', identity, {
      authenticated: false,
      retryUnauthorized: false,
    })
    if (!response.ok) {
      throw new Error(await this.errorMessage(response, 'Unable to send a PIN. Please try again.'))
    }
  }

  async login(credentials: LoginRequest): Promise<void> {
    const token = await this.tokenRequest('/login', credentials)
    this.state.accessToken = token.accessToken
    this.state.initialized = true
    storeTenant(credentials.tenantId)
  }

  async refresh(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise

    this.refreshPromise = (async () => {
      try {
        const token = await this.tokenRequest('/auth/refresh')
        this.state.accessToken = token.accessToken
        return true
      } catch {
        this.state.accessToken = null
        return false
      } finally {
        this.refreshPromise = null
      }
    })()
    return this.refreshPromise
  }

  async initialize(): Promise<void> {
    if (this.state.initialized) return
    if (!this.initializePromise) {
      this.initializePromise = this.refresh().then(() => {
        this.state.initialized = true
      })
    }
    return this.initializePromise
  }

  async logout(): Promise<void> {
    try {
      await this.delete('/auth/session', {
        authenticated: false,
        retryUnauthorized: false,
      })
    } finally {
      this.state.accessToken = null
      this.state.initialized = true
    }
  }

  private async tokenRequest(path: string, body?: LoginRequest): Promise<TokenResponse> {
    const response = await this.post(path, body, {
      authenticated: false,
      retryUnauthorized: false,
    })
    if (!response.ok) {
      throw new Error(await this.errorMessage(
        response,
        response.status === 401 ? 'The PIN you entered is incorrect.' : 'Authentication failed.',
      ))
    }
    return this.json<TokenResponse>(response)
  }
}

export const auth = new AuthService()

export type { LoginRequest, TenantEmailRequest }
