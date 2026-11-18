import { tenantService, type TenantSummary } from './services/TenantService'

/**
 * Names the platform keeps for itself, never tenants (tkt-core: TenantRegistrationSvc.RESERVED_SUBDOMAINS). The app's own
 * pages (registration, invitations) can be served from these, so they are not tenant addresses.
 */
const PLATFORM_SUBDOMAINS = new Set(['www', 'api', 'app', 'admin', 'mail', 'email', 'static', 'assets', 'login', 'register', 'client', 'support', 'help', 'status', 'localhost'])

/** The tenant label of the host (`acme` for acme.<VITE_APP_DOMAIN>), or '' on any other host, including the platform's own. */
export function hostSubdomain(): string {
  const domain = (import.meta.env.VITE_APP_DOMAIN ?? '').toLowerCase().replace(/^\./, '')
  const host = window.location.hostname.toLowerCase()
  if (!domain || !host.endsWith(`.${domain}`)) return ''
  const label = host.slice(0, -domain.length - 1)
  return label.includes('.') || PLATFORM_SUBDOMAINS.has(label) ? '' : label
}

/** The platform's own address (the app domain without a tenant), for leaving a dead-end page. */
export function platformUrl(): string {
  const domain = (import.meta.env.VITE_APP_DOMAIN ?? '').replace(/^\./, '')
  return domain ? `${window.location.protocol}//${domain}` : '/'
}

let cached: Promise<TenantSummary | null> | null = null
let failed = false

/** Whether the last lookup failed (as opposed to finding that the address belongs to no tenant). */
export function hostLookupFailed(): boolean {
  return failed
}

/**
 * The tenant this address belongs to, or null when it is not a tenant address (the app's own host, localhost, an
 * unknown or archived subdomain) or the lookup fails. Looked up once per page load.
 */
export function resolveHostTenant(): Promise<TenantSummary | null> {
  if (!cached) {
    const subdomain = hostSubdomain()
    cached = subdomain ? tenantService.bySubdomain(subdomain).catch(() => {
      failed = true
      return null
    }) : Promise.resolve(null)
  }
  return cached
}
