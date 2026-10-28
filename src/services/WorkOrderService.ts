import { BaseApiService, type ApiAuthentication } from './BaseApiService'
import { auth } from '../auth'
import type { User } from './User'

export interface WorkOrderProperty {
  id: string
  name: string | null
  address1?: string | null
  city?: string | null
  state?: string | null
}

/** A work order with its jobs (only the fields the client reads). The list endpoint may leave `jobs` out. */
export interface WorkOrder {
  id: string
  num: string | null
  unit: string | null
  /** Open, Complete, Canceled or Archive. */
  status: string | null
  occupied: boolean | null
  /** `YYYY-MM-DD`. */
  moveIn?: string | null
  moveOut?: string | null
  /** ISO instant. */
  created: string | null
  property: WorkOrderProperty | null
  reportedBy: User | null
  jobs: WorkOrderJob[]
}

export interface WorkOrderQuery {
  /** Matches number, unit, property name/address/city or reporter. */
  q?: string
  propertyId?: string
  /** One of {@link WorkOrderService.statuses}. */
  status?: string
  /** Page size (API default 50, max 200). */
  limit?: number
  offset?: number
}

export interface WorkOrderPage {
  workOrders: WorkOrder[]
  /** Total matches across all pages. */
  total: number
  limit: number
  offset: number
}

/** A note on a job. */
export interface JobNote {
  id: string
  user: User | null
  data: string | null
  type: string | null
  /** ISO instant. */
  created: string | null
}

/** A file on a job: `data` is the file's content or location, `type` its kind. */
export interface JobAttachment {
  id: string
  user: User | null
  data: string
  type: string
  /** ISO instant. */
  created: string | null
}

/** An additional item (an "extra") added to a job, beyond its service item. */
export interface JobExtra {
  id: string
  user: User | null
  name: string
  list: number | null
  cost: number | null
  /** ISO instant. */
  created: string | null
}

/** One entry of a job's status history: the status it was given, and by whom. */
export interface JobStatusEntry {
  id: string
  user: User | null
  /** The status enum's name (`GO_BACK`) or its label (`Go Back`). */
  status: string | null
  data: string | null
  /** ISO instant. */
  created: string | null
}

/** A job of a work order. The collections come with the detail endpoint. */
export interface WorkOrderJob {
  id: string
  num: string | null
  status: string | null
  /** Null while unscheduled. */
  scheduled: Date | null
  purchaseOrder: string | null
  cost: number | null
  list: number | null
  dispatched: boolean
  alert: boolean
  techUpdated: boolean
  assignedTo: User | null
  serviceItem: { id: string; name: string | null } | null
  extras: JobExtra[]
  notes: JobNote[]
  attachments: JobAttachment[]
  statuses: JobStatusEntry[]
}

/** A domain object being created: the fields in `K` are required, the rest are filled in by the API. */
type Draft<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>

/** A job to create. Leave `assignedTo` and `scheduled` empty to put it in the scheduler's unscheduled queue. */
export type NewJob = Draft<WorkOrderJob, 'serviceItem'>

/** A work order to create, with at least one job. Dates are `YYYY-MM-DD`. */
export type NewWorkOrder = Omit<Draft<WorkOrder, 'property'>, 'jobs'> & { jobs: NewJob[] }

/** The API sends scheduled instants as ISO strings. */
function reviveJob(job: WorkOrderJob): WorkOrderJob {
  return {
    ...job,
    scheduled: job.scheduled ? new Date(job.scheduled) : null,
    extras: job.extras ?? [],
    notes: job.notes ?? [],
    attachments: job.attachments ?? [],
    statuses: job.statuses ?? [],
  }
}

function reviveOrder(order: WorkOrder): WorkOrder {
  return { ...order, jobs: (order.jobs ?? []).map(reviveJob) }
}

function jobBody(job: NewJob) {
  return {
    serviceItem: job.serviceItem ? { id: job.serviceItem.id } : null,
    assignedTo: job.assignedTo ? { id: job.assignedTo.id } : null,
    scheduled: job.scheduled ? job.scheduled.getTime() : null,
    purchaseOrder: job.purchaseOrder ?? null,
    cost: job.cost ?? null,
    list: job.list ?? null,
  }
}

const jobPath = (workOrderId: string, jobId: string) => `/api/work-orders/${workOrderId}/jobs/${jobId}`

/** The browser's time zone, so a scheduled job lands on the right day for its technician. */
function tzQuery() {
  return `?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`
}

class WorkOrderService extends BaseApiService {
  constructor(authentication: ApiAuthentication) {
    super(authentication)
  }

  private async deleteAt(path: string, fallback: string): Promise<void> {
    const response = await this.delete(path)
    if (!response.ok) throw new Error(await this.errorMessage(response, fallback))
  }

  /** Work orders of the tenant, newest first (`GET /api/work-orders`). */
  async list(query: WorkOrderQuery = {}): Promise<WorkOrderPage> {
    const params = new URLSearchParams()
    if (query.q?.trim()) params.set('q', query.q.trim())
    if (query.propertyId) params.set('propertyId', query.propertyId)
    if (query.status) params.set('status', query.status)
    if (query.limit) params.set('limit', String(query.limit))
    if (query.offset) params.set('offset', String(query.offset))
    const qs = params.toString()
    const payload = await this.data<Partial<WorkOrderPage> | null>(
      await this.get(`/api/work-orders${qs ? `?${qs}` : ''}`),
      'Couldn’t load work orders.',
    )
    const workOrders = Array.isArray(payload?.workOrders) ? payload.workOrders.map(reviveOrder) : []
    return {
      workOrders,
      total: payload?.total ?? workOrders.length,
      limit: payload?.limit ?? workOrders.length,
      offset: payload?.offset ?? 0,
    }
  }

  /** Values for the `status` filter: Open, Complete, Canceled, Archive (`GET /api/work-orders/statuses`). */
  async statuses(): Promise<string[]> {
    const payload = await this.data<string[] | null>(
      await this.get('/api/work-orders/statuses'),
      'Couldn’t load work order statuses.',
    )
    return Array.isArray(payload) ? payload : []
  }

  /** A work order with all its jobs (`GET /api/work-orders/{id}`). */
  async detail(id: string): Promise<WorkOrder> {
    return reviveOrder(await this.data<WorkOrder>(await this.get(`/api/work-orders/${id}`), 'Couldn’t load the work order.'))
  }

  /** Saves the whole work order (the API takes its own fields: unit, occupied, dates, reporter and status) and returns it with its jobs. Requires the Admin or Super Admin role. */
  async update(order: WorkOrder): Promise<WorkOrder> {
    return reviveOrder(await this.data<WorkOrder>(await this.put(`/api/work-orders/${order.id}`, order), 'Unable to save the work order.'))
  }

  /** Deletes a work order and all its jobs. Requires the Admin or Super Admin role. */
  async remove(id: string): Promise<void> {
    await this.deleteAt(`/api/work-orders/${id}`, 'Unable to delete the work order.')
  }

  /** Deletes one job of a work order. Requires the Admin or Super Admin role. */
  async removeJob(workOrderId: string, jobId: string): Promise<void> {
    await this.deleteAt(jobPath(workOrderId, jobId), 'Unable to delete the job.')
  }

  /** Adds a note to a job, or updates it when `note.id` is set. Requires the Admin or Super Admin role. */
  async saveNote(workOrderId: string, jobId: string, note: Partial<JobNote>): Promise<JobNote> {
    return this.data<JobNote>(await this.post(`${jobPath(workOrderId, jobId)}/notes`, note), 'Unable to save the note.')
  }

  async removeNote(workOrderId: string, jobId: string, id: string): Promise<void> {
    await this.deleteAt(`${jobPath(workOrderId, jobId)}/notes/${id}`, 'Unable to delete the note.')
  }

  /** Adds an additional item to a job, or updates it when `extra.id` is set. Requires the Admin or Super Admin role. */
  async saveExtra(workOrderId: string, jobId: string, extra: Partial<JobExtra>): Promise<JobExtra> {
    return this.data<JobExtra>(await this.post(`${jobPath(workOrderId, jobId)}/items`, extra), 'Unable to save the item.')
  }

  async removeExtra(workOrderId: string, jobId: string, id: string): Promise<void> {
    await this.deleteAt(`${jobPath(workOrderId, jobId)}/items/${id}`, 'Unable to delete the item.')
  }

  /** Adds an attachment to a job, or updates it when `attachment.id` is set. Requires the Admin or Super Admin role. */
  async saveAttachment(workOrderId: string, jobId: string, attachment: Partial<JobAttachment>): Promise<JobAttachment> {
    return this.data<JobAttachment>(await this.post(`${jobPath(workOrderId, jobId)}/attachments`, attachment), 'Unable to save the attachment.')
  }

  async removeAttachment(workOrderId: string, jobId: string, id: string): Promise<void> {
    await this.deleteAt(`${jobPath(workOrderId, jobId)}/attachments/${id}`, 'Unable to delete the attachment.')
  }

  /** Saves the whole job (the API takes its status, PO, prices and flags; scheduling and assignment go through the scheduler). Requires the Admin or Super Admin role. */
  async updateJob(workOrderId: string, job: WorkOrderJob): Promise<WorkOrderJob> {
    return reviveJob(await this.data<WorkOrderJob>(
      await this.put(jobPath(workOrderId, job.id), job),
      'Unable to save the job.',
    ))
  }

  /** Creates a work order and its jobs. Requires the Admin or Super Admin role. */
  async create(order: NewWorkOrder): Promise<WorkOrder> {
    return reviveOrder(await this.data<WorkOrder>(
      await this.post(`/api/work-orders${tzQuery()}`, { ...order, jobs: order.jobs.map(jobBody) }),
      'Unable to create the work order.',
    ))
  }

  /** Adds a job to an existing work order. Requires the Admin or Super Admin role. */
  async addJob(workOrderId: string, job: NewJob): Promise<WorkOrderJob> {
    return reviveJob(await this.data<WorkOrderJob>(
      await this.post(`/api/work-orders/${workOrderId}/jobs${tzQuery()}`, jobBody(job)),
      'Unable to add the job.',
    ))
  }
}

export { WorkOrderService }
export const workOrderService = new WorkOrderService(auth)
