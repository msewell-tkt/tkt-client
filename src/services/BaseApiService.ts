export interface ApiAuthentication {
  getAccessToken(): string | null
  refresh(): Promise<boolean>
  /** Called when a protected request is still unauthorized after a refresh attempt. */
  onSessionExpired?(): void
}

export interface RequestOptions {
  authenticated?: boolean
  retryUnauthorized?: boolean
}

export abstract class BaseApiService {
  private readonly baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

  protected constructor(private readonly authentication?: ApiAuthentication) {}

  protected get(path: string, options?: RequestOptions): Promise<Response> {
    return this.request(path, { method: 'GET' }, options)
  }

  protected post(path: string, body?: unknown, options?: RequestOptions): Promise<Response> {
    return this.request(path, {
      method: 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, options)
  }

  protected put(path: string, body?: unknown, options?: RequestOptions): Promise<Response> {
    return this.request(path, {
      method: 'PUT',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, options)
  }

  protected delete(path: string, options?: RequestOptions): Promise<Response> {
    return this.request(path, { method: 'DELETE' }, options)
  }

  protected async json<T>(response: Response): Promise<T> {
    return response.json() as Promise<T>
  }

  /** Parses a JSON body, or throws an Error carrying the API's message. */
  protected async data<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) throw new Error(await this.errorMessage(response, fallback))
    return this.json<T>(response)
  }

  protected async errorMessage(response: Response, fallback: string): Promise<string> {
    const body = await response.text()
    if (!body.trim()) return fallback

    try {
      const parsed = JSON.parse(body) as unknown
      if (typeof parsed === 'string' && parsed.trim()) return parsed
      if (parsed && typeof parsed === 'object' && 'message' in parsed) {
        const message = (parsed as { message?: unknown }).message
        if (typeof message === 'string' && message.trim()) return message
      }
    } catch {
      // Plain-text API errors are displayed as-is.
    }
    return body.trim()
  }

  private async request(path: string, init: RequestInit, options: RequestOptions = {}): Promise<Response> {
    const authenticated = options.authenticated ?? true
    const retryUnauthorized = options.retryUnauthorized ?? true
    const headers = new Headers(init.headers)
    const accessToken = authenticated ? this.authentication?.getAccessToken() : null
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

    const response = await fetch(this.url(path), {
      ...init,
      headers,
      credentials: 'include',
    })

    if (response.status === 401 && authenticated && retryUnauthorized && this.authentication) {
      if (await this.authentication.refresh()) {
        return this.request(path, init, { ...options, retryUnauthorized: false })
      }
      this.authentication.onSessionExpired?.()
    }
    return response
  }

  private url(path: string): string {
    if (/^https?:\/\//.test(path)) return path
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  }
}
