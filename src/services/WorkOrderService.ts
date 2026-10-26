import { BaseApiService, type ApiAuthentication } from './BaseApiService'
import { auth } from '../auth'

/** A work order as listed by `GET /api/work-orders` (only the fields the client reads). */
export interface WorkOrderSummary {
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
  property: { id: string; name: string | null; address1?: string | null; city?: string | null; state?: string | null } | null
  reportedBy: { id: string; firstName: string | null; lastName: string | null } | null
  jobCount: number | null
  openJobCount: number | null
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
  workOrders: WorkOrderSummary[]
  /** Total matches across all pages. */
  total: number
  limit: number
  offset: number
}

/** A job of a work order, as returned by the create, detail and update endpoints. */
export interface WorkOrderJobDetail {
  id: string
  num: string | null
  status: string | null
  /** ISO instant. */
  scheduled: string | null
  purchaseOrder: string | null
  cost: number | null
  list: number | null
  dispatched: boolean
  alert: boolean
  techUpdated: boolean
  assignedTo: { id: string; firstName: string | null; lastName: string | null } | null
  serviceItem: { id: string; name: string | null } | null
}

/** A job to create. Leave `assignedTo` and `scheduled` empty to put it in the scheduler's unscheduled queue. */
export interface NewJob {
  serviceItemId: string
  assignedTo?: string | null
  scheduled?: Date | null
  purchaseOrder?: string | null
  /** Defaults to the service item's cost. */
  cost?: number | null
  /** Defaults to the service item's list price. */
  list?: number | null
}

/** A work order to create, with at least one job. Dates are `YYYY-MM-DD`. */
export interface NewWorkOrder {
  propertyId: string
  unit?: string | null
  occupied?: boolean
  moveIn?: string | null
  moveOut?: string | null
  reportedBy?: string | null
  jobs: NewJob[]
}

/** A work order with its jobs: the create, detail and update responses. */
export interface WorkOrderDetail {
  workOrder: WorkOrderSummary
  jobs: WorkOrderJobDetail[]
}

/** Fields saved by `PUT /api/work-orders/{id}`. Dates are `YYYY-MM-DD`; null clears a field. */
export interface WorkOrderChanges {
  unit: string | null
  occupied: boolean
  moveIn: string | null
  moveOut: string | null
  reportedBy: string | null
  /** Open, Complete, Canceled or Archive; omitted keeps the current status. */
  status?: string
}

/** Fields saved by `PUT /api/work-orders/{id}/jobs/{jobId}`. Scheduling and assignment go through the scheduler. */
export interface JobChanges {
  status: string
  purchaseOrder: string | null
  cost: number
  list: number
  dispatched: boolean
  alert: boolean
}

function jobBody(job: NewJob) {
  return {
    serviceItemId: job.serviceItemId,
    assignedTo: job.assignedTo ?? null,
    scheduled: job.scheduled ? job.scheduled.getTime() : null,
    purchaseOrder: job.purchaseOrder ?? null,
    cost: job.cost ?? null,
    list: job.list ?? null,
  }
}

/** The browser's time zone, so a scheduled job lands on the right day for its technician. */
function tzQuery() {
  return `?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`
}

class WorkOrderService extends BaseApiService {
  constructor(authentication: ApiAuthentication) {
    super(authentication)
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
    const workOrders = Array.isArray(payload?.workOrders) ? payload.workOrders : []
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
  async detail(id: string): Promise<WorkOrderDetail> {
    return this.data<WorkOrderDetail>(await this.get(`/api/work-orders/${id}`), 'Couldn’t load the work order.')
  }

  /** Saves a work order's own fields and returns it with its jobs. Requires the Admin or Super Admin role. */
  async update(id: string, changes: WorkOrderChanges): Promise<WorkOrderDetail> {
    return this.data<WorkOrderDetail>(await this.put(`/api/work-orders/${id}`, changes), 'Unable to save the work order.')
  }

  /** Saves a job's status, PO, prices and flags. Requires the Admin or Super Admin role. */
  async updateJob(workOrderId: string, jobId: string, changes: JobChanges): Promise<WorkOrderJobDetail> {
    return this.data<WorkOrderJobDetail>(
      await this.put(`/api/work-orders/${workOrderId}/jobs/${jobId}`, changes),
      'Unable to save the job.',
    )
  }

  /** Creates a work order and its jobs. Requires the Admin or Super Admin role. */
  async create(order: NewWorkOrder): Promise<WorkOrderDetail> {
    return this.data<WorkOrderDetail>(
      await this.post(`/api/work-orders${tzQuery()}`, { ...order, jobs: order.jobs.map(jobBody) }),
      'Unable to create the work order.',
    )
  }

  /** Adds a job to an existing work order. Requires the Admin or Super Admin role. */
  async addJob(workOrderId: string, job: NewJob): Promise<WorkOrderJobDetail> {
    return this.data<WorkOrderJobDetail>(
      await this.post(`/api/work-orders/${workOrderId}/jobs${tzQuery()}`, jobBody(job)),
      'Unable to add the job.',
    )
  }
}

export { WorkOrderService }
export const workOrderService = new WorkOrderService(auth)
