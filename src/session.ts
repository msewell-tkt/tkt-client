import { watch } from 'vue'
import { auth } from './auth'
import { RoleEnum } from './constants/roles'
import { dashboardService, type Session } from './services/DashboardService'

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

export async function isSuperAdmin(): Promise<boolean> {
  try {
    return (await loadSession()).roles.includes(RoleEnum.SUPER_ADMIN)
  } catch {
    return false
  }
}
