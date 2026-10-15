import { BaseApiService, type ApiAuthentication } from './BaseApiService'
import { auth } from '../auth'

/** `GET /api/dashboard` payload (`DashboardView` in tkt-core). */
export interface Session {
  id: string
  email: string
  tid: string
  tenantName: string
  firstName: string
  lastName: string
  roles: string[]
  activeProperties: number
  activePropertiesThisMonth: number
  openJobs: number
  completedJobsThisWeek: number
}

class DashboardService extends BaseApiService {
  constructor(authentication: ApiAuthentication) {
    super(authentication)
  }

  async load(): Promise<Session> {
    return this.data<Session>(await this.get('/api/dashboard'), 'Unable to load your session.')
  }
}

export { DashboardService }
export const dashboardService = new DashboardService(auth)
