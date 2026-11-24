import { BaseApiService, type ApiAuthentication } from './BaseApiService'
import { auth } from '../auth'
import type { RoleEnum } from '../constants/roles'
import type { User } from './User'
import type { TenantSummary } from './TenantService'

/** A scheduling user type of the tenant, as `GET /api/user-types` returns it. */
export interface UserType {
  id: string
  name: string
}

/** A property a user is linked to (only the fields the client reads). */
export interface UserProperty {
  id: string
  name: string | null
}

class UserService extends BaseApiService {
  constructor(authentication: ApiAuthentication) {
    super(authentication)
  }

  private async send(request: Promise<Response>, fallback: string): Promise<void> {
    const response = await request
    if (!response.ok) throw new Error(await this.errorMessage(response, fallback))
  }

  /** Users of the tenant, each with their roles (`GET /api/users`); `archived` lists only the archived ones instead. Requires the Admin or Super Admin role. */
  async list(archived = false): Promise<User[]> {
    const payload = await this.data<User[] | { users?: User[] } | null>(await this.get(archived ? '/users?archived=true' : '/users'), 'Couldn’t load users.')
    const users = Array.isArray(payload) ? payload : payload?.users
    return Array.isArray(users) ? users : []
  }

  /** The tenant's properties the user is linked to (`GET /api/users/{id}/properties`). */
  async properties(userId: string): Promise<UserProperty[]> {
    const payload = await this.data<UserProperty[] | null>(await this.get(`/users/${userId}/properties`), 'Couldn’t load the user’s properties.')
    return Array.isArray(payload) ? payload : []
  }

  /**
   * Saves the user's profile (`POST /api/users/{id}`). The API saves only the name, phone, mobile, address and `valid` fields; pass the
   * user as loaded with the edits applied. Requires the Admin or Super Admin role.
   */
  async update(user: User): Promise<User> {
    const { roles: _roles, ...profile } = user
    return this.data<User>(await this.post(`/users/${user.id}`, profile), 'Unable to save the user.')
  }

  /** Archives the user (`POST /api/users/{id}/archive`); they can no longer sign in. You can't archive yourself. */
  async archive(userId: string): Promise<User> {
    return this.data<User>(await this.post(`/users/${userId}/archive`), 'Unable to archive the user.')
  }

  /** Restores an archived user (`DELETE /api/users/{id}/archive`). */
  async unarchive(userId: string): Promise<User> {
    return this.data<User>(await this.delete(`/users/${userId}/archive`), 'Unable to restore the user.')
  }

  /** The tenant's user types (`GET /api/user-types`). */
  async userTypes(): Promise<UserType[]> {
    const payload = await this.data<UserType[] | null>(await this.get('/user-types'), 'Couldn’t load user types.')
    return Array.isArray(payload) ? payload : []
  }

  /** The user types the user belongs to (`GET /api/users/{id}/user-types`). */
  async userTypesOf(userId: string): Promise<UserType[]> {
    const payload = await this.data<UserType[] | null>(await this.get(`/users/${userId}/user-types`), 'Couldn’t load the user’s types.')
    return Array.isArray(payload) ? payload : []
  }

  /** Puts the user in a user type. Repeating it is harmless. */
  addToUserType(userId: string, userTypeId: string): Promise<void> {
    return this.send(this.post(`/users/${userId}/user-types/${userTypeId}`), 'Unable to add the user type.')
  }

  removeFromUserType(userId: string, userTypeId: string): Promise<void> {
    return this.send(this.delete(`/users/${userId}/user-types/${userTypeId}`), 'Unable to remove the user type.')
  }

  /** Gives the user a role, named in the path. Repeating it is harmless. */
  addRole(userId: string, role: RoleEnum): Promise<void> {
    return this.send(this.post(`/users/${userId}/roles/${encodeURIComponent(role)}`), 'Unable to add the role.')
  }

  removeRole(userId: string, role: RoleEnum): Promise<void> {
    return this.send(this.delete(`/users/${userId}/roles/${encodeURIComponent(role)}`), 'Unable to remove the role.')
  }

  /** The tenants a user belongs to (`GET /users/{id}/tenants`). Super Admin only. */
  async tenantsOf(userId: string): Promise<TenantSummary[]> {
    const payload = await this.data<TenantSummary[] | null>(await this.get(`/users/${userId}/tenants`), 'Couldn’t load the user’s workspaces.')
    return Array.isArray(payload) ? payload : []
  }

  /** Adds the user to any tenant (`POST /tenants/{tenantId}/users/{userId}`). Super Admin only; repeating it is harmless. */
  associateWithTenant(userId: string, tenantId: string): Promise<void> {
    return this.send(this.post(`/tenants/${tenantId}/users/${userId}`), 'Unable to add the user to the workspace.')
  }

  /** Removes the user from any tenant. Super Admin only. */
  dissociateFromTenant(userId: string, tenantId: string): Promise<void> {
    return this.send(this.delete(`/tenants/${tenantId}/users/${userId}`), 'Unable to remove the user from the workspace.')
  }

  /** Adds an existing user to the tenant. */
  addToTenant(userId: string): Promise<void> {
    return this.send(this.post(`/users/${userId}/tenant`), 'Unable to add the user to the tenant.')
  }

  /** Removes the user from the tenant, along with their roles and property links there. You can't remove yourself. */
  removeFromTenant(userId: string): Promise<void> {
    return this.send(this.delete(`/users/${userId}/tenant`), 'Unable to remove the user.')
  }

  addToProperty(userId: string, propertyId: string): Promise<void> {
    return this.send(this.post(`/users/${userId}/properties/${propertyId}`), 'Unable to add the property.')
  }

  removeFromProperty(userId: string, propertyId: string): Promise<void> {
    return this.send(this.delete(`/users/${userId}/properties/${propertyId}`), 'Unable to remove the property.')
  }
}

export { UserService }
export const userService = new UserService(auth)
