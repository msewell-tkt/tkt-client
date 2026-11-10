import { BaseApiService, type ApiAuthentication } from './BaseApiService'
import { auth } from '../auth'

export type InvitationStatus = 'INVITED' | 'ALREADY_MEMBER' | 'INVALID_EMAIL' | 'SEND_FAILED'

export interface InvitationResult {
  email: string
  status: InvitationStatus
}

/** What the registration page shows before the person fills in the form (`GET /invitations/{token}`). */
export interface InvitationView {
  email: string
  tenantId: string
  tenantName: string
  existingUser: boolean
  expiresAt: string
}

export interface Registration {
  firstName: string
  lastName: string
  phone: string
  mobile: string
}

class InvitationService extends BaseApiService {
  constructor(authentication: ApiAuthentication) {
    super(authentication)
  }

  /** Emails each address a registration link (`POST /api/invitations`, up to 50). Requires the Admin or Super Admin role. */
  async invite(emails: string[]): Promise<InvitationResult[]> {
    const payload = await this.data<InvitationResult[] | null>(await this.post('/api/v1/invitations', { emails }), 'Unable to send the invitations.')
    return Array.isArray(payload) ? payload : []
  }

  /** The invitation behind a registration link. Anonymous: an unknown, used or expired token answers 404. */
  async view(token: string): Promise<InvitationView> {
    const response = await this.get(`/api/v1/public/invitations/${encodeURIComponent(token)}`, { authenticated: false })
    if (response.status === 404) throw new Error('This invitation link is invalid or has expired. Ask your admin to send a new one.')
    return this.data<InvitationView>(response, 'Couldn’t load the invitation.')
  }

  /** Registers the user for the tenant and, for a new user, emails them a PIN. The token works once. */
  async accept(token: string, registration: Registration): Promise<void> {
    const response = await this.post(`/api/v1/public/invitations/${encodeURIComponent(token)}/accept`, registration, { authenticated: false })
    if (response.status === 404) throw new Error('This invitation link is invalid or has expired. Ask your admin to send a new one.')
    if (!response.ok) throw new Error(await this.errorMessage(response, 'Unable to complete your registration.'))
  }
}

export { InvitationService }
export const invitationService = new InvitationService(auth)
