import { BaseApiService, type ApiAuthentication } from './BaseApiService'
import { auth } from '../auth'

/** A tenant's primary user: its billing contact, whose email billing notices go to (`PrimaryUserView` in tkt-core). */
export interface PrimaryUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
}

class BillingService extends BaseApiService {
  constructor(authentication: ApiAuthentication) {
    super(authentication)
  }

  /** The signed-in tenant's primary user, or null when it has none (`GET /billing/primary-user`). Admin or Super Admin only. */
  async primaryUser(): Promise<PrimaryUser | null> {
    const response = await this.get('/billing/primary-user')
    if (response.status === 404) return null
    return this.data<PrimaryUser>(response, 'Couldn’t load the primary user.')
  }

  /** Makes a user of the signed-in tenant its primary user (`POST /billing/primary-user`). They must be an active Admin. */
  async setPrimaryUser(userId: string): Promise<PrimaryUser> {
    return this.data<PrimaryUser>(await this.post('/billing/primary-user', { userId }), 'Unable to set the primary user.')
  }
}

export { BillingService }
export const billingService = new BillingService(auth)
