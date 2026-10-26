import { BaseApiService, type ApiAuthentication } from './BaseApiService'
import { auth } from '../auth'

/** Shapes returned by tkt-core `GET /scheduler/weekly` (only the fields the client reads). */
export interface ScheduleRole {
  id: string
  name: string
}

/** A tenant user type (e.g. Painter), the value of the weekly endpoint's `userType` filter. */
export interface UserType {
  id: string
  name: string
}

export interface ScheduleProperty {
  id: string
  name: string
}

export interface ScheduleWorkOrder {
  id: string
  num: string | null
  unit: string | null
  status: string | null
  property: ScheduleProperty | null
}

export interface ScheduleServiceItem {
  id: string
  name: string | null
}

export interface ScheduleJob {
  id: string
  num: string | null
  /** ISO instant. */
  scheduled: string | null
  status: string | null
  priority: number
  purchaseOrder: string | null
  dispatched: boolean
  alert: boolean
  techUpdated: boolean
  workOrder: ScheduleWorkOrder | null
  serviceItem: ScheduleServiceItem | null
}

export interface ScheduleUser {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  image: string | null
  roles: ScheduleRole[] | null
  workOrderJobs: ScheduleJob[] | null
}

export interface JobMove {
  /** Team member the job is assigned to; null leaves it unassigned. */
  assignedTo: string | null
  /** New scheduled time. The API uses its local calendar day (in `tz`) to find the day's jobs. */
  scheduled: Date
  /** 0-based position within that day; omitted means last. */
  priority?: number
}

/** `PUT /scheduler/jobs/{jobId}` response (`ScheduleMoveResult` in tkt-core). */
export interface JobMoveResult {
  jobId: string
  assignedTo: string | null
  /** Epoch milliseconds. */
  scheduled: number
  priority: number
  /** A job that changes day or assignee is no longer dispatched. */
  dispatched: boolean
  /** New priority of every job in the target day, including this one. */
  dayOrder: Array<{ jobId: string; priority: number }>
}

class SchedulerService extends BaseApiService {
  constructor(authentication: ApiAuthentication) {
    super(authentication)
  }

  /**
   * Technicians and QA users with their jobs for the 7 days starting at `weekStart`
   * (local midnight). The browser's time zone is sent so the API computes the same week end.
   */
  async weekly(weekStart: Date, userType?: string): Promise<ScheduleUser[]> {
    const params = new URLSearchParams({
      startDate: String(weekStart.getTime()),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    if (userType) params.set('userType', userType)
    const payload = await this.data<ScheduleUser[] | null>(
      await this.get(`/scheduler/weekly?${params}`),
      'Couldn’t load the schedule.',
    )
    return Array.isArray(payload) ? payload : []
  }

  /** User types of the tenant, sorted by name (`GET /api/user-types`). */
  async userTypes(): Promise<UserType[]> {
    const payload = await this.data<UserType[] | null>(await this.get('/api/user-types'), 'Couldn’t load user types.')
    return Array.isArray(payload) ? payload : []
  }

  /** Moves a job to another day, team member or position. Requires the Admin or Super Admin role. */
  async moveJob(jobId: string, move: JobMove): Promise<JobMoveResult> {
    return this.data<JobMoveResult>(
      await this.put(`/scheduler/jobs/${jobId}`, {
        assignedTo: move.assignedTo,
        scheduled: move.scheduled.getTime(),
        priority: move.priority,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      'Unable to move the job.',
    )
  }

  /**
   * Open jobs missing a date or a technician (`GET /scheduler/unscheduled`), for the unscheduled queue.
   * Alerted jobs come first, then oldest first; the API returns at most `limit` (default 200, max 1000).
   */
  async unscheduled(limit?: number): Promise<ScheduleJob[]> {
    const query = limit ? `?limit=${limit}` : ''
    const payload = await this.data<ScheduleJob[] | null>(
      await this.get(`/scheduler/unscheduled${query}`),
      'Couldn’t load unscheduled jobs.',
    )
    return Array.isArray(payload) ? payload : []
  }

  /**
   * Sends the week's schedule to the given team members (`userIds`), for the 7 days starting at `weekStart`.
   * TODO: call the tkt-core endpoint once it exists; until then the scheduler shows this error.
   */
  async send(weekStart: Date, userIds: string[]): Promise<void> {
    void weekStart
    void userIds
    throw new Error('Sending schedules isn’t available yet.')
  }
}

export { SchedulerService }
export const schedulerService = new SchedulerService(auth)
