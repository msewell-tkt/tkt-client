import { BaseApiService, type ApiAuthentication } from './BaseApiService'
import { auth, type TenantOption } from '../auth'

/** Moving a signed-in user between the workspaces they belong to. */
class TenantSwitchService extends BaseApiService {
  constructor(authentication: ApiAuthentication) {
    super(authentication)
  }

  /** The signed-in user's workspaces (`GET /auth/tenants`). */
  async mine(): Promise<TenantOption[]> {
    const payload = await this.data<{ tenants?: TenantOption[] }>(await this.get('/auth/tenants'), 'Couldn’t load your workspaces.')
    return Array.isArray(payload.tenants) ? payload.tenants : []
  }

  /**
   * Moves the session to another workspace (`POST /auth/switch`). The API replaces the refresh cookie, so load the
   * app afresh afterwards: everything held in memory belongs to the previous workspace.
   */
  async switchTo(tenantId: string): Promise<void> {
    const response = await this.post('/auth/switch', { tenantId })
    if (!response.ok) throw new Error(await this.errorMessage(response, 'Unable to switch workspaces.'))
    auth.rememberTenant(tenantId)
  }
}

export { TenantSwitchService }
export const tenantSwitchService = new TenantSwitchService(auth)
