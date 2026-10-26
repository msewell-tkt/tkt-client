/** `YYYY-MM-DD` dates are shown as calendar dates (UTC, no shift); ISO instants in the viewer's time zone. */
export function formatDate(value: string) {
  if (!value) return 'Not scheduled'
  const date = value.length > 10 ? new Date(value) : new Date(`${value}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: value.length > 10 ? undefined : 'UTC' }).format(date)
}

export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)
}

export function statusClass(status: string) {
  return ({
    New: 'bg-[#eef0ff] text-[#5962d8]',
    Open: 'bg-[#e8f4ff] text-[#2876ae]',
    Assigned: 'bg-[#e8f4ff] text-[#2876ae]',
    Confirmed: 'bg-[#e8f4ff] text-[#2876ae]',
    Hold: 'bg-[#fff2d8] text-[#a76708]',
    'Go Back': 'bg-[#fff2d8] text-[#a76708]',
    Done: 'bg-[#e2f7f1] text-[#13836e]',
    Review: 'bg-[#e2f7f1] text-[#13836e]',
    Invoiced: 'bg-[#e2f7f1] text-[#13836e]',
    Scheduled: 'bg-[#e8f4ff] text-[#2876ae]',
    'In progress': 'bg-[#fff2d8] text-[#a76708]',
    Completed: 'bg-[#e2f7f1] text-[#13836e]',
    Complete: 'bg-[#e2f7f1] text-[#13836e]',
  } as Record<string, string>)[status] ?? 'bg-[#f1f2f5] text-[#727b8d]'
}
