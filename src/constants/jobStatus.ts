/** Work order job statuses. A new job starts as {@link StatusEnum.NEW}. Keep in sync with tkt-core. */
export enum StatusEnum {
  NEW = 'New',
  ASSIGNED = 'Assigned',
  CONFIRMED = 'Confirmed',
  HOLD = 'Hold',
  DECLINED = 'Declined',
  DONE = 'Done',
  GO_BACK = 'Go Back',
  SERVICED = 'Serviced',
  REVIEWED = 'Reviewed',
  READY_TO_BILL = 'Ready to Bill',
  INVOICED = 'Invoiced',
  COMPLETE = 'Complete',
  CANCELED = 'Canceled',
}

/** Status given to newly created jobs. */
export const INITIAL_STATUS = StatusEnum.NEW

/**
 * Statuses where the job is no longer waiting on scheduling or its technician; such jobs don't count as open.
 * Declined is not closed: the dispatcher reassigns a declined job. Keep in sync with tkt-core.
 */
export const CLOSED_STATUSES: string[] = [StatusEnum.DONE, StatusEnum.SERVICED, StatusEnum.REVIEWED, StatusEnum.READY_TO_BILL, StatusEnum.INVOICED, StatusEnum.COMPLETE, StatusEnum.CANCELED]

/** True for a closed status; a missing or unknown status counts as open. */
export const isClosedStatus = (status: string | null | undefined) => CLOSED_STATUSES.includes(status ?? '')

/** All statuses, in workflow order (for selects). */
export const JOB_STATUSES: StatusEnum[] = Object.values(StatusEnum)
