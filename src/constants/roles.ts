/** What a user may do in a tenant. The values are the texts the API sends and takes. Keep in sync with tkt-core. */
export enum RoleEnum {
  ADMIN = 'Admin',
  SUPER_ADMIN = 'Super Admin',
  QA = 'QA',
  DISPATCHER = 'Dispatcher',
  PROPERTY = 'Property',
  TECHNICIAN = 'Technician',
}

/** All roles, in display order (for selects). */
export const ROLES: RoleEnum[] = Object.values(RoleEnum)

/** True when the roles include Admin or Super Admin. */
export const hasAdminRole = (roles: readonly string[] | null | undefined) =>
  (roles ?? []).some((role) => role === RoleEnum.ADMIN || role === RoleEnum.SUPER_ADMIN)
