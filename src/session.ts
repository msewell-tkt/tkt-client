import { watch } from 'vue'
import { auth } from './auth'
import { hostLookupFailed, hostSubdomain, resolveHostTenant } from './hostTenant'
import { dashboardService, type Session } from './services/DashboardService'

export const SUPER_ADMIN_ROLE = 'Super Admin'

let cached: Promise<Session> | null = null

// A new sign-in must not see the previous user's roles.
watch(() => auth.state.accessToken, (token) => {
  if (!token) cached = null
})

/** The signed-in user's session (`GET /dashboard`), loaded once per sign-in. */
export function loadSession(): Promise<Session> {
  if (!cached) {
    cached = dashboardService.load().catch((reason) => {
      cached = null
      throw reason
    })
  }
  return cached
}

/** Forget the cached session, after a sign-in as someone else (a sign-out does this by itself). */
export function resetSession() {
  cached = null
}

/**
 * Whether the signed-in session belongs to the tenant this address serves. The refresh cookie is shared by every
 * tenant subdomain, so opening another tenant's address can restore a session of the first. That session is valid
 * but does not belong here, and neither does any session at a subdomain no tenant uses. Anything we cannot judge (not a
 * tenant address, a failed lookup) counts as matching.
 */
export async function sessionMatchesHost(): Promise<boolean> {
  if (!hostSubdomain()) return true
  const host = await resolveHostTenant()
  // A subdomain no tenant uses has no session that belongs to it; a failed lookup is not an answer, so assume it does.
  if (!host) return hostLookupFailed()
  try {
    return (await loadSession()).tid === host.id
  } catch {
    return true
  }
}

export async function isSuperAdmin(): Promise<boolean> {
  try {
    return (await loadSession()).roles.includes(SUPER_ADMIN_ROLE)
  } catch {
    return false
  }
}
