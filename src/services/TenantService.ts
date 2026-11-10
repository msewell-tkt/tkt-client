import { BaseApiService } from './BaseApiService'

/** What the login page needs to know about a workspace (`GET /tenants/by-subdomain/{subdomain}`). */
export interface TenantSummary {
  id: string
  name: string
  subdomain: string
}

class TenantService extends BaseApiService {
  constructor() {
    super()
  }

  /** The tenant served from `subdomain`, or null when there is none. Anonymous. */
  async bySubdomain(subdomain: string): Promise<TenantSummary | null> {
    const response = await this.get(`/api/v1/public/tenants/by-subdomain/${encodeURIComponent(subdomain)}`, { authenticated: false })
    if (response.status === 404) return null
    return this.data<TenantSummary>(response, 'Couldn’t look up this workspace.')
  }
}

export { TenantService }
export const tenantService = new TenantService()
