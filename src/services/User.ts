/** A user as the API returns it (`User` in tkt-core). */
export interface User {
  id: string
  firstName: string | null
  lastName: string | null
}

/** The user's full name, or an empty string when there is no user or no name. */
export function userName(user: User | null | undefined) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ')
}
