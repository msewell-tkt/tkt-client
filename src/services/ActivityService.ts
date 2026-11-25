import { BaseApiService, type ApiAuthentication } from './BaseApiService'
import { auth } from '../auth'

/** One piece of recent work (`ActivityView` in tkt-core). */
export interface Activity {
  id: string
  /** e.g. `job.status`; see tkt-core's README for the list. */
  type: string
  summary: string
  /** ISO instant. */
  created: string
  userId: string
  userName?: string | null
  /** Null once the work order has been deleted, like the three fields after it. */
  workOrderId?: string | null
  workOrderNum?: string | null
  propertyName?: string | null
  unit?: string | null
}

class ActivityService extends BaseApiService {
  constructor(authentication: ApiAuthentication) {
    super(authentication)
  }

  /** The latest work, newest first (`GET /activity`). Admins get everyone's, other users their own. */
  async recent(limit = 10): Promise<Activity[]> {
    const payload = await this.data<Activity[] | null>(await this.get(`/activity?limit=${limit}`), 'Couldn’t load recent activity.')
    return Array.isArray(payload) ? payload : []
  }
}

export { ActivityService }
export const activityService = new ActivityService(auth)
