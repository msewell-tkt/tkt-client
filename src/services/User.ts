/** A user as the API returns it (`User` in tkt-core). */
export interface User {
  id: string
  firstName: string | null
  lastName: string | null
  /** The fields below come with `GET /api/users`; other endpoints send users with just a name or id. */
  email?: string | null
  phone?: string | null
  mobile?: string | null
  image?: string | null
  address?: string | null
  address2?: string | null
  city?: string | null
  state?: string | null
  postal?: string | null
  /** False until the user has signed in with their PIN (an invited user). */
  valid?: boolean
  archived?: boolean
  /** ISO instants. */
  lastLogin?: string | null
  created?: string | null
  /** The user's roles in the tenant. */
  roles?: Array<{ id: string; name: string }> | null
}

export type UserStatus = 'Active' | 'Invited' | 'Inactive' | 'Archived'

/** Archived when archived; otherwise Active when `valid`, else Invited until the user has first signed in, or Inactive after. */
export const userStatus = (user: User): UserStatus => (user.archived ? 'Archived' : user.valid ? 'Active' : user.lastLogin ? 'Inactive' : 'Invited')

export const userInitials = (user: User) => [user.firstName, user.lastName].map((part) => part?.[0] ?? '').join('').toUpperCase() || '?'

const AVATAR_COLORS = ['#5962d8', '#0f9279', '#b87417', '#a04f80', '#34789b', '#7656a8', '#687386']

/** A steady avatar color for the user, picked from their id. */
export const userColor = (user: User) => AVATAR_COLORS[[...user.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length]

export const userRoleNames = (user: User) => (user.roles ?? []).map((role) => role.name)

/** The user's full name, or an empty string when there is no user or no name. */
export function userName(user: User | null | undefined) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ')
}
