import { BaseApiService } from './BaseApiService'

export interface TenantRegistration {
  tenantName: string
  firstName: string
  lastName: string
  email: string
  phone: string
  mobile: string
}

/** What the confirmation page shows before the person confirms (`GET /tenant-registrations/{token}`). */
export interface TenantRegistrationView {
  email: string
  tenantName: string
  existingUser: boolean
  expiresAt: string
}

/** Where to sign in once the email is confirmed. A new user has been emailed a PIN; an existing one has not. */
export interface TenantRegistrationResult {
  tenantId: string
  tenantName: string
  /** Host label derived from the tenant name; the workspace lives at `<subdomain>.<app domain>`. */
  subdomain: string
  /** The new workspace's own login page, on its subdomain. */
  loginUrl: string
  email: string
  existingUser: boolean
}

const BAD_LINK = 'This link is invalid or has expired. Start again to get a new one.'

/** Self-service tenant sign-up. Every call is anonymous: the emailed token is the credential. */
class TenantRegistrationService extends BaseApiService {
  constructor() {
    super()
  }

  /** Emails the address a confirmation link (`POST /tenant-registrations`). Nothing is created until it is confirmed. */
  async register(registration: TenantRegistration): Promise<void> {
    const response = await this.post('/api/v1/public/tenant-registrations', registration, { authenticated: false })
    if (!response.ok) throw new Error(await this.errorMessage(response, 'Unable to start your registration.'))
  }

  async view(token: string): Promise<TenantRegistrationView> {
    const response = await this.get(`/api/v1/public/tenant-registrations/${encodeURIComponent(token)}`, { authenticated: false })
    if (response.status === 404) throw new Error(BAD_LINK)
    return this.data<TenantRegistrationView>(response, 'Couldn’t load your registration.')
  }

  /** Creates the tenant and its first admin, and emails a new user their PIN. The token works once. */
  async verify(token: string): Promise<TenantRegistrationResult> {
    const response = await this.post(`/api/v1/public/tenant-registrations/${encodeURIComponent(token)}/verify`, undefined, { authenticated: false })
    if (response.status === 404) throw new Error(BAD_LINK)
    return this.data<TenantRegistrationResult>(response, 'Unable to confirm your email.')
  }
}

export { TenantRegistrationService }
export const tenantRegistrationService = new TenantRegistrationService()
