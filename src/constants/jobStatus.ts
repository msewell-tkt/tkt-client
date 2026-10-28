/** Work order job statuses. A new job starts as {@link StatusEnum.NEW}. Keep in sync with tkt-core. */
export enum StatusEnum {
  NEW = 'New',
  ASSIGNED = 'Assigned',
  CONFIRMED = 'Confirmed',
  HOLD = 'Hold',
  DECLINE = 'Decline',
  DONE = 'Done',
  GO_BACK = 'Go Back',
  REVIEW = 'Review',
  INVOICED = 'Invoiced',
  COMPLETE = 'Complete',
}

/** Status given to newly created jobs. */
export const INITIAL_STATUS = StatusEnum.NEW

/** Statuses where the job's work is finished; such jobs don't count as open. Keep in sync with tkt-core. */
export const CLOSED_STATUSES: string[] = [StatusEnum.DECLINE, StatusEnum.DONE, StatusEnum.REVIEW, StatusEnum.INVOICED, StatusEnum.COMPLETE]

/** True for a closed status; a missing or unknown status counts as open. */
export const isClosedStatus = (status: string | null | undefined) => CLOSED_STATUSES.includes(status ?? '')

/** All statuses, in workflow order (for selects). */
export const JOB_STATUSES: StatusEnum[] = Object.values(StatusEnum)
