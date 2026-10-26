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

/** All statuses, in workflow order (for selects). */
export const JOB_STATUSES: StatusEnum[] = Object.values(StatusEnum)
