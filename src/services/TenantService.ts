import { BaseApiService, type ApiAuthentication } from './BaseApiService'
import { auth } from '../auth'
import type { InvitationResult } from './InvitationService'
import type { User } from './User'

/** What the login page needs to know about a workspace (`GET /tenants/by-subdomain/{subdomain}`). */
export interface TenantSummary {
  id: string
  name: string
  subdomain: string
  /** When the logo was set; null when the tenant has none. */
  logoUpdated?: string | null
}

/** The biggest logo the API accepts, and the types it accepts. */
export const MAX_LOGO_BYTES = 512 * 1024
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

/** A tenant as the Super Admin pages see it (`GET /tenants`). */
export interface TenantDetail extends TenantSummary {
  archived: boolean
  created: string | null
  userCount: number
}

class TenantService extends BaseApiService {
  constructor(authentication?: ApiAuthentication) {
    super(authentication)
  }

  /** The tenant served from `subdomain`, or null when there is none. Anonymous. */
  /** The active tenants, or only the archived ones (`GET /tenants`). Super Admin only. */
  async list(archived = false): Promise<TenantDetail[]> {
    const payload = await this.data<TenantDetail[] | null>(await this.get(archived ? '/tenants?archived=true' : '/tenants'), 'Couldn’t load workspaces.')
    return Array.isArray(payload) ? payload : []
  }

  /** One tenant (`GET /tenants/{id}`). Super Admin only. */
  async detail(tenantId: string): Promise<TenantDetail> {
    return this.data<TenantDetail>(await this.get(`/tenants/${tenantId}`), 'Couldn’t load the workspace.')
  }

  /**
   * Where the tenant's logo image is served (anonymous, so it also works on the login page). `version` (the logo's
   * `logoUpdated`) makes the browser fetch a new image right after an upload instead of reusing the old one.
   */
  logoUrl(tenantId: string, version?: string | null): string {
    return this.url(`/public/tenants/${tenantId}/logo${version ? `?v=${encodeURIComponent(version)}` : ''}`)
  }

  /** Sets the tenant's logo (`POST /tenants/{id}/logo`, multipart). Super Admin only. */
  async uploadLogo(tenantId: string, file: File): Promise<TenantDetail> {
    const form = new FormData()
    form.append('file', file)
    return this.data<TenantDetail>(await this.post(`/tenants/${tenantId}/logo`, form), 'Unable to upload the logo.')
  }

  async removeLogo(tenantId: string): Promise<TenantDetail> {
    return this.data<TenantDetail>(await this.delete(`/tenants/${tenantId}/logo`), 'Unable to remove the logo.')
  }

  /** Changes the tenant's name and/or archived flag (`POST /tenants/{id}`). Super Admin only. */
  async update(tenantId: string, changes: { name?: string; subdomain?: string; archived?: boolean }): Promise<TenantDetail> {
    return this.data<TenantDetail>(await this.post(`/tenants/${tenantId}`, changes), 'Unable to save the workspace.')
  }

  /** The tenant's users with their roles there (`GET /tenants/{id}/users`). Super Admin only. */
  async users(tenantId: string): Promise<User[]> {
    const payload = await this.data<User[] | null>(await this.get(`/tenants/${tenantId}/users`), 'Couldn’t load the workspace’s users.')
    return Array.isArray(payload) ? payload : []
  }

  /** Emails each address a registration link for the tenant (`POST /tenants/{id}/invitations`). Super Admin only. */
  async invite(tenantId: string, emails: string[]): Promise<InvitationResult[]> {
    const payload = await this.data<InvitationResult[] | null>(await this.post(`/tenants/${tenantId}/invitations`, { emails }), 'Unable to send the invitations.')
    return Array.isArray(payload) ? payload : []
  }

  async bySubdomain(subdomain: string): Promise<TenantSummary | null> {
    const response = await this.get(`/public/tenants/by-subdomain/${encodeURIComponent(subdomain)}`, { authenticated: false })
    if (response.status === 404) return null
    return this.data<TenantSummary>(response, 'Couldn’t look up this workspace.')
  }
}

export { TenantService }
export const tenantService = new TenantService(auth)
