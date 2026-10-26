<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Drawer from 'primevue/drawer'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import AppHeader from '../components/AppHeader.vue'
import WorkOrderDrawer from '../components/WorkOrderDrawer.vue'
import { INITIAL_STATUS, StatusEnum } from '../constants/jobStatus'
import { schedulerService, type ScheduleJob, type ScheduleUser } from '../services/SchedulerService'

type JobTone = 'scheduled' | 'active' | 'ready' | 'event'

/** One card: a job from the API (scheduled or in the unscheduled queue), or a local note. */
interface ScheduleItem {
  id: string
  /** null while the job sits in the unscheduled queue. */
  resourceId: string | null
  day: number | null
  /** Order within the day (lower first). */
  priority: number
  /** True while a move is being saved. */
  saving: boolean
  property: string
  detail: string
  status: string
  tone: JobTone
  alert: boolean
  dispatched: boolean
  updatedByTech: boolean
  source: ScheduleJob | null
}

interface Resource {
  id: string
  name: string
  roles: string[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const ALL_TYPES = 'All types'
/** Time of day given to a job dropped from the queue when it has no scheduled time yet. */
const DEFAULT_START_HOUR = 8

function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Preferences just won't persist when storage is unavailable.
  }
}

const weekStart = ref(startOfWeek(new Date()))
/** Selected user type name; ALL_TYPES means no filter. Sent to the API as `userType`. */
const userType = ref(ALL_TYPES)
const userTypes = ref<string[]>([])
const hideSunday = ref(readPreference('scheduler-show-sunday') !== 'true')
const hideSaturday = ref(readPreference('scheduler-hide-saturday') === 'true')
const settingsOpen = ref(false)
const eventOpen = ref(false)
const queueOpen = ref(false)
const sending = ref(false)
const notice = ref<{ severity: 'success' | 'error'; text: string } | null>(null)
let noticeTimer: number | undefined
const jobOpen = ref(false)
const orderOpen = ref(false)
/** Work order shown in the drawer; null creates a new one. */
const orderId = ref<string | null>(null)
const draggedJobId = ref<string | null>(null)
const selectedJob = ref<ScheduleItem | null>(null)
const eventResource = ref<string | null>(null)
const eventDay = ref<number | null>(null)
const eventNote = ref('')

const loading = ref(true)
const loadError = ref('')
const resources = ref<Resource[]>([])
const jobs = ref<ScheduleItem[]>([])
/** Notes added in this browser. The API has no endpoint to save them yet. */
const localChanges = ref(0)
let loadSequence = 0

const jobToneClasses: Record<JobTone, string> = {
  active: 'bg-[#72dcad]',
  scheduled: 'bg-[#a9e7ef]',
  ready: 'bg-[#f2e85d]',
  event: 'cursor-default bg-white',
}

function jobClasses(item: ScheduleItem) {
  return [
    'relative mb-[.38rem] block min-h-12 w-full cursor-grab overflow-hidden rounded-[.65rem] border border-[rgba(36,48,71,.7)] px-[.58rem] pt-2 pb-[.45rem] pr-[1.65rem] text-left font-[inherit] text-slate-800 shadow-sm hover:z-[1] hover:-translate-y-px hover:shadow-md active:cursor-grabbing',
    jobToneClasses[item.tone],
    item.alert ? 'border-2 border-[#ff4d4f] pt-[calc(.5rem-1px)]' : '',
    draggedJobId.value === item.id ? 'opacity-35' : '',
    item.saving ? 'animate-pulse cursor-wait' : '',
  ]
}

const userTypeOptions = computed(() => [ALL_TYPES, ...userTypes.value])

const visibleResources = computed(() => resources.value)

const visibleDays = computed(() => {
  const days = []
  if (!hideSunday.value) days.push(0)
  days.push(1, 2, 3, 4, 5)
  if (!hideSaturday.value) days.push(6)
  return days
})

const monthLabel = computed(() => {
  const end = dateForDay(visibleDays.value.at(-1) ?? 6)
  const startMonth = weekStart.value.toLocaleDateString(undefined, { month: 'long' })
  const endMonth = end.toLocaleDateString(undefined, { month: 'long' })
  return startMonth === endMonth ? startMonth : `${startMonth} – ${endMonth}`
})

const weekRange = computed(() => {
  const start = dateForDay(visibleDays.value[0] ?? 0)
  const end = dateForDay(visibleDays.value.at(-1) ?? 6)
  return `${formatShortDate(start)} – ${formatShortDate(end)}, ${end.getFullYear()}`
})

const jobCount = computed(() => jobs.value.filter((item) => item.source && item.resourceId !== null).length)
const unscheduledJobs = computed(() => jobs.value.filter((item) => item.resourceId === null))

function startOfWeek(value: Date) {
  const result = new Date(value)
  result.setHours(0, 0, 0, 0)
  result.setDate(result.getDate() - result.getDay())
  return result
}

function dateForDay(day: number) {
  const result = new Date(weekStart.value)
  result.setDate(result.getDate() + day)
  return result
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatDateTime(iso: string | null) {
  if (!iso) return 'Not scheduled'
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function dayName(day: number) {
  return dateForDay(day).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()
}

function isToday(day: number) {
  return dateForDay(day).toDateString() === new Date().toDateString()
}

/** Index 0–6 of the job's local calendar day within the current week, or null if outside it. */
function dayIndex(iso: string | null): number | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  const index = Math.round((date.getTime() - weekStart.value.getTime()) / DAY_MS)
  return index >= 0 && index < 7 ? index : null
}

/** Card colour per status: blue until confirmed, green once confirmed, yellow when the work is done. */
const STATUS_TONES: Partial<Record<string, JobTone>> = {
  [StatusEnum.CONFIRMED]: 'active',
  [StatusEnum.DONE]: 'ready',
  [StatusEnum.REVIEW]: 'ready',
  [StatusEnum.INVOICED]: 'ready',
  [StatusEnum.COMPLETE]: 'ready',
}

function toneFor(status: string): JobTone {
  return STATUS_TONES[status] ?? 'scheduled'
}

function personName(user: ScheduleUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Unnamed user'
}

function toItem(job: ScheduleJob, resourceId: string | null): ScheduleItem | null {
  const day = resourceId === null ? null : dayIndex(job.scheduled)
  if (resourceId !== null && day === null) return null
  const status = job.status?.trim() || INITIAL_STATUS
  const detail = [job.workOrder?.unit, job.serviceItem?.name].filter(Boolean).join(' · ')
  return {
    id: job.id,
    resourceId,
    day,
    property: job.workOrder?.property?.name || 'Unknown property',
    detail: detail || (job.num ? `Job ${job.num}` : ''),
    status,
    tone: toneFor(status),
    priority: job.priority ?? 0,
    saving: false,
    alert: job.alert,
    dispatched: job.dispatched,
    updatedByTech: job.techUpdated,
    source: job,
  }
}

async function loadWeek() {
  const sequence = ++loadSequence
  loading.value = true
  loadError.value = ''
  try {
    const [users, unscheduled] = await Promise.all([
      schedulerService.weekly(weekStart.value, userType.value === ALL_TYPES ? undefined : userType.value),
      schedulerService.unscheduled(),
    ])
    if (sequence !== loadSequence) return
    resources.value = users.map((user) => ({
      id: user.id,
      name: personName(user),
      roles: (user.roles ?? []).map((role) => role.name).filter(Boolean),
    }))
    jobs.value = users.flatMap((user) => (user.workOrderJobs ?? [])
      .map((job) => toItem(job, user.id))
      .filter((item): item is ScheduleItem => item !== null))
    jobs.value.push(...unscheduled
      .map((job) => toItem(job, null))
      .filter((item): item is ScheduleItem => item !== null))
    localChanges.value = 0
  } catch (reason) {
    if (sequence !== loadSequence) return
    loadError.value = reason instanceof Error ? reason.message : 'Couldn’t load the schedule.'
    resources.value = []
    jobs.value = []
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function jobsFor(resourceId: string, day: number) {
  return jobs.value
    .filter((item) => item.resourceId === resourceId && item.day === day)
    .sort((a, b) => a.priority - b.priority)
}

function showNotice(severity: 'success' | 'error', text: string) {
  window.clearTimeout(noticeTimer)
  notice.value = { severity, text }
  noticeTimer = window.setTimeout(() => { notice.value = null }, 5000)
}

function shiftWeek(amount: number) {
  notice.value = null
  const next = new Date(weekStart.value)
  next.setDate(next.getDate() + amount * 7)
  weekStart.value = next
}

function goToToday() {
  const today = startOfWeek(new Date())
  if (today.getTime() !== weekStart.value.getTime()) weekStart.value = today
}

function startDrag(item: ScheduleItem, event: DragEvent) {
  if (item.tone === 'event' || item.saving) {
    event.preventDefault()
    return
  }
  draggedJobId.value = item.id
  event.dataTransfer?.setData('text/plain', item.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

/** The job's existing time of day on the target day, or DEFAULT_START_HOUR when it has none. */
function scheduledFor(item: ScheduleItem, day: number): Date {
  const result = dateForDay(day)
  const current = item.source?.scheduled ? new Date(item.source.scheduled) : null
  if (current && !Number.isNaN(current.getTime())) result.setHours(current.getHours(), current.getMinutes(), 0, 0)
  else result.setHours(DEFAULT_START_HOUR, 0, 0, 0)
  return result
}

/**
 * Drops the dragged job on a day, before the card `beforeId` (or last), and saves it with
 * PUT /scheduler/jobs/{id}. The grid updates right away and rolls back if the save fails.
 */
async function dropJob(resourceId: string, day: number, beforeId?: string) {
  const jobId = draggedJobId.value
  draggedJobId.value = null
  const item = jobs.value.find((candidate) => candidate.id === jobId)
  if (!item?.source || item.saving) return

  const cell = jobsFor(resourceId, day)
  const others = cell.filter((other) => other.id !== item.id)
  const beforeIndex = beforeId ? others.findIndex((other) => other.id === beforeId) : -1
  const position = beforeIndex >= 0 ? beforeIndex : others.length
  const sameCell = item.resourceId === resourceId && item.day === day
  if (sameCell && cell.findIndex((other) => other.id === item.id) === position) return

  const previous = {
    resourceId: item.resourceId, day: item.day, priority: item.priority,
    status: item.status, tone: item.tone, dispatched: item.dispatched,
  }
  const previousOrder = new Map(others.map((other) => [other, other.priority]))
  const scheduled = scheduledFor(item, day)

  others.splice(position, 0, item)
  others.forEach((other, index) => { other.priority = index })
  if (item.resourceId === null) {
    item.status = item.source.status?.trim() || INITIAL_STATUS
    item.tone = toneFor(item.status)
  }
  item.resourceId = resourceId
  item.day = day
  item.saving = true

  try {
    const result = await schedulerService.moveJob(item.id, { assignedTo: resourceId, scheduled, priority: position })
    const order = new Map(result.dayOrder.map((entry) => [entry.jobId, entry.priority]))
    for (const job of jobs.value) {
      const priority = order.get(job.id)
      if (priority !== undefined) job.priority = priority
    }
    item.dispatched = result.dispatched
    item.source.scheduled = new Date(result.scheduled).toISOString()
    item.source.priority = result.priority
    item.source.dispatched = result.dispatched
  } catch (reason) {
    Object.assign(item, previous)
    previousOrder.forEach((priority, other) => { other.priority = priority })
    showNotice('error', reason instanceof Error ? reason.message : 'Unable to move the job.')
  } finally {
    item.saving = false
  }
}

function openJob(item: ScheduleItem) {
  if (!item.source) return
  selectedJob.value = item
  jobOpen.value = true
}

function newWorkOrder() {
  orderId.value = null
  orderOpen.value = true
}

function editWorkOrder() {
  const id = selectedJob.value?.source?.workOrder?.id
  if (!id) return
  orderId.value = id
  jobOpen.value = false
  orderOpen.value = true
}

/** Jobs of a new or edited work order show up in the unscheduled queue (or move on the grid), so reload. */
function onOrderSaved() {
  void loadWeek()
}

function openEventDialog() {
  eventResource.value = visibleResources.value[0]?.id ?? null
  eventDay.value = visibleDays.value[0] ?? 1
  eventNote.value = ''
  eventOpen.value = true
}

function saveEvent() {
  if (!eventResource.value || eventDay.value === null || !eventNote.value.trim()) return
  jobs.value.push({
    id: `note-${Date.now()}`, resourceId: eventResource.value, day: eventDay.value, priority: Number.MAX_SAFE_INTEGER, saving: false, property: eventNote.value.trim(),
    detail: '', status: 'Note', tone: 'event', alert: false, dispatched: false, updatedByTech: false, source: null,
  })
  localChanges.value += 1
  eventOpen.value = false
}

async function sendSchedule() {
  const userIds = visibleResources.value.map((resource) => resource.id)
  if (!userIds.length) return
  sending.value = true
  try {
    await schedulerService.send(weekStart.value, userIds)
    showNotice('success', `Schedule sent to ${userIds.length} ${userIds.length === 1 ? 'team member' : 'team members'}.`)
  } catch (reason) {
    showNotice('error', reason instanceof Error ? reason.message : 'Unable to send the schedule.')
  } finally {
    sending.value = false
  }
}

function savePreferences() {
  writePreference('scheduler-show-sunday', String(!hideSunday.value))
  writePreference('scheduler-hide-saturday', String(hideSaturday.value))
  settingsOpen.value = false
}

async function loadUserTypes() {
  try {
    userTypes.value = (await schedulerService.userTypes()).map((type) => type.name).filter(Boolean)
  } catch {
    // The filter just offers "All types" if the list can't be loaded.
    userTypes.value = []
  }
}

watch([weekStart, userType], loadWeek)
onMounted(() => {
  void loadUserTypes()
  void loadWeek()
})
</script>

<template>
  <div class="min-h-screen bg-[#f5f7fb]">
    <AppHeader />

    <main class="px-[clamp(1rem,3vw,2.5rem)] pt-7 pb-12 max-[600px]:px-[.65rem] max-[600px]:pt-4 max-[600px]:pb-8">
      <section class="mx-auto mb-[1.35rem] flex max-w-[1800px] items-end justify-between gap-4 max-[600px]:items-start">
        <div>
          <p class="mb-[.35rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">Resource planning</p>
          <div class="flex items-baseline gap-4 max-[600px]:flex-col max-[600px]:items-start max-[600px]:gap-[.35rem]"><h1 class="m-0 text-[2rem] leading-none tracking-[-.04em] text-[#172033] max-[600px]:text-[1.6rem]">{{ monthLabel }}</h1><span class="text-[.9rem] text-[#7a8498]">{{ weekRange }}</span></div>
        </div>
        <Tag v-if="!loading && !loadError" class="max-[600px]:hidden" :value="`${jobCount} ${jobCount === 1 ? 'job' : 'jobs'} this week`" severity="secondary" icon="pi pi-briefcase" />
      </section>

      <section class="mx-auto flex min-h-[58px] max-w-[1800px] items-center justify-between gap-4 rounded-t-2xl border border-b-0 border-[#e2e6ef] bg-white px-[.7rem] py-[.55rem] max-[900px]:flex-col max-[900px]:items-stretch" aria-label="Schedule controls">
        <div class="flex items-center gap-1">
          <Button label="Today" severity="secondary" outlined @click="goToToday" />
          <Button icon="pi pi-chevron-left" severity="secondary" text rounded aria-label="Previous week" @click="shiftWeek(-1)" />
          <Button icon="pi pi-chevron-right" severity="secondary" text rounded aria-label="Next week" @click="shiftWeek(1)" />
        </div>
        <div class="flex items-center gap-1 max-[900px]:flex-wrap max-[900px]:[&_.p-button:last-child]:flex-1">
          <Select v-model="userType" :options="userTypeOptions" class="w-40" aria-label="Filter by user type" />
          <Button icon="pi pi-refresh" severity="secondary" text rounded aria-label="Reload schedule" :loading="loading" @click="loadWeek" />
          <Button icon="pi pi-cog" severity="secondary" text rounded aria-label="Preferences" @click="settingsOpen = true" />
          <Button icon="pi pi-plus" label="New work order" severity="secondary" outlined @click="newWorkOrder" />
          <Button icon="pi pi-file-edit" severity="secondary" text rounded aria-label="Add schedule note" @click="openEventDialog" />
          <Button icon="pi pi-inbox" severity="secondary" text rounded aria-label="Open unscheduled queue" :badge="unscheduledJobs.length ? String(unscheduledJobs.length) : undefined" @click="queueOpen = true" />
          <Button icon="pi pi-send" label="Send schedule" :loading="sending" :disabled="loading || !visibleResources.length" @click="sendSchedule" />
        </div>
      </section>

      <div v-if="localChanges" class="mx-auto flex max-w-[1800px] items-center justify-between gap-4 border border-b-0 border-[#f1d9a6] bg-[#fff8e8] px-4 py-[.55rem] text-[.86rem] font-semibold text-[#8a5a00]" role="status">
        <span><i class="pi pi-exclamation-triangle mr-[.4rem]" />{{ localChanges }} unsaved {{ localChanges === 1 ? 'note' : 'notes' }}. Notes stay in this browser; the API can’t save them yet.</span>
        <Button label="Discard" size="small" severity="secondary" text @click="loadWeek" />
      </div>
      <div v-if="notice" :class="['mx-auto max-w-[1800px] border border-b-0 px-4 py-[.7rem] text-[.86rem] font-semibold', notice.severity === 'success' ? 'border-[#afe2d7] bg-[#e8faf5] text-[#08745f]' : 'border-[#f0c7c7] bg-[#fff7f7] text-[#9c3f3f]']" role="status"><i :class="['pi mr-[.4rem]', notice.severity === 'success' ? 'pi-check-circle' : 'pi-exclamation-circle']" />{{ notice.text }}</div>
      <Message v-if="loadError" severity="error" :closable="false" class="mx-auto max-w-[1800px]">{{ loadError }}</Message>

      <section class="relative mx-auto max-w-[1800px] overflow-hidden rounded-b-2xl border border-[#e2e6ef] bg-white shadow-[0_12px_35px_rgba(30,41,75,.05)]">
        <div v-if="loading" class="absolute inset-0 z-10 grid place-items-center bg-white/70" role="status" aria-label="Loading schedule"><ProgressSpinner stroke-width="4" class="!h-10 !w-10" /></div>
        <div v-if="!loading && !loadError && !visibleResources.length" class="px-6 py-16 text-center text-[#7f899b]"><i class="pi pi-users text-2xl" /><p class="mb-0">No technicians or QA users to schedule.</p></div>
        <div v-else class="overflow-x-auto">
          <div class="grid min-w-[calc(210px+var(--day-count)*180px)] [grid-template-columns:210px_repeat(var(--day-count),minmax(180px,1fr))] max-[600px]:min-w-[calc(160px+var(--day-count)*170px)] max-[600px]:[grid-template-columns:160px_repeat(var(--day-count),minmax(170px,1fr))]" :style="{ '--day-count': visibleDays.length }">
            <div class="sticky top-0 left-0 z-4 flex min-h-[68px] flex-col justify-center border-r border-b border-[#dfe4ec] bg-[#f8f9fc] px-4"><span class="text-[.76rem] font-extrabold tracking-[.04em] text-[#414b60] uppercase">Team member</span><small class="mt-[.22rem] text-[#9098a8]">{{ visibleResources.length }} resources</small></div>
            <div v-for="day in visibleDays" :key="`header-${day}`" class="sticky top-0 z-3 flex min-h-[68px] items-center justify-center gap-2 border-r border-b border-[#e5e8ef] bg-[#f8f9fc] text-[#7c8598]">
              <span class="text-[.72rem] font-extrabold tracking-[.08em]">{{ dayName(day) }}</span><strong :class="['grid h-8 w-8 place-items-center text-[.95rem]', isToday(day) ? 'rounded-full bg-[#5d66da] text-white' : 'text-[#30394c]']">{{ dateForDay(day).getDate() }}</strong>
            </div>

            <template v-for="resource in visibleResources" :key="resource.id">
              <div class="sticky left-0 z-2 flex min-h-28 items-start gap-[.7rem] border-r border-b border-[#dfe4ec] bg-[#fbfcfe] px-[.85rem] py-4">
                <span class="grid h-8 w-8 shrink-0 place-items-center rounded-[.6rem] bg-[#e9ebff] text-[.68rem] font-extrabold text-[#4e58c4]">{{ resource.name.split(' ').map((part) => part[0]).slice(0, 2).join('') }}</span>
                <div class="min-w-0"><strong class="block overflow-hidden text-[.84rem] text-ellipsis whitespace-nowrap text-[#2d374b]">{{ resource.name }}</strong><small class="mt-1 block text-[.7rem] text-[#8a93a5]">{{ resource.roles.join(' · ') || 'Team member' }}</small></div>
              </div>
              <div v-for="day in visibleDays" :key="`${resource.id}-${day}`" :class="['min-h-28 border-r border-b border-[#e2e6ed] p-[.38rem] transition-colors has-[.dragging]:bg-[#f0f2ff]', isToday(day) ? 'bg-[#fafaff]' : 'bg-white']" @dragover.prevent @drop.prevent="dropJob(resource.id, day)">
                <button
                  v-for="item in jobsFor(resource.id, day)" :key="item.id"
                  :class="jobClasses(item)"
                  :draggable="item.tone !== 'event'" :title="`${item.property}\n${item.detail}\nStatus: ${item.status}`" type="button"
                  @dragstart="startDrag(item, $event)" @dragend="draggedJobId = null" @click="openJob(item)"
                  @dragover.prevent @drop.prevent.stop="dropJob(resource.id, day, item.id)"
                >
                  <span class="block overflow-hidden text-[.74rem] font-extrabold text-ellipsis whitespace-nowrap">{{ item.property }}</span>
                  <span v-if="item.detail.trim()" class="mt-[.18rem] block overflow-hidden text-[.68rem] font-semibold text-ellipsis whitespace-nowrap">{{ item.detail }}</span>
                  <i v-if="item.dispatched" class="pi pi-send absolute top-[.43rem] right-[.42rem] text-[.68rem] text-red-500" aria-label="Dispatched" />
                  <i v-if="item.updatedByTech" class="pi pi-info-circle absolute right-[.42rem] bottom-[.38rem] text-[.68rem] text-[#335cff]" aria-label="Updated by technician" />
                </button>
              </div>
            </template>
          </div>
        </div>
      </section>
    </main>

    <Drawer v-model:visible="queueOpen" header="Unscheduled jobs" position="right" :modal="false">
      <p class="mt-0 mb-4 leading-6 text-[#778195]">Drag a job from this queue onto a team member’s day.</p>
      <div v-if="unscheduledJobs.length" class="grid gap-[.65rem]">
        <article v-for="item in unscheduledJobs" :key="item.id" class="grid cursor-grab gap-[.2rem] rounded-xl border border-[#dfe4ed] bg-slate-50 p-[.85rem]" draggable="true" @dragstart="startDrag(item, $event)" @dragend="draggedJobId = null" @click="openJob(item)">
          <span class="text-[.72rem] font-extrabold text-[#5962d8] uppercase">{{ item.property }}</span><strong class="text-[.88rem]">{{ item.detail }}</strong><small class="text-[#8b94a6]">{{ item.status }}</small>
        </article>
      </div>
      <div v-else class="grid justify-items-center px-4 py-12 text-[#7f899b] [&_i]:text-[1.8rem] [&_i]:text-[#18a286]"><i class="pi pi-check-circle" /><p>No unscheduled jobs.</p></div>
    </Drawer>

    <Dialog v-model:visible="settingsOpen" modal header="Scheduler preferences" :style="{ width: '28rem' }">
      <div class="flex items-center justify-between gap-8 border-b border-[#edf0f5] py-4 [&_strong]:block [&_small]:mt-1 [&_small]:block [&_small]:text-[#7d8799]"><div><strong>Hide Sunday</strong><small>Start the visible week on Monday.</small></div><ToggleSwitch v-model="hideSunday" /></div>
      <div class="flex items-center justify-between gap-8 border-b border-[#edf0f5] py-4 [&_strong]:block [&_small]:mt-1 [&_small]:block [&_small]:text-[#7d8799]"><div><strong>Hide Saturday</strong><small>Show weekdays only.</small></div><ToggleSwitch v-model="hideSaturday" /></div>
      <template #footer><Button label="Cancel" severity="secondary" text @click="settingsOpen = false" /><Button label="Save preferences" @click="savePreferences" /></template>
    </Dialog>

    <Dialog v-model:visible="eventOpen" modal header="Add schedule note" :style="{ width: '32rem' }">
      <div class="grid gap-4 [&_label]:grid [&_label]:gap-[.45rem] [&_label]:text-[.8rem] [&_label]:font-bold [&_label]:text-[#3c465a] [&_.p-inputtext]:w-full [&_.p-select]:w-full [&_.p-textarea]:w-full">
        <label>Team member<Select v-model="eventResource" :options="visibleResources" option-label="name" option-value="id" /></label>
        <label>Day<Select v-model="eventDay" :options="visibleDays.map((day) => ({ label: `${dayName(day)} · ${formatShortDate(dateForDay(day))}`, value: day }))" option-label="label" option-value="value" /></label>
        <label>Note<Textarea v-model="eventNote" rows="4" placeholder="Vacation, training, no more work…" /></label>
      </div>
      <template #footer><Button label="Cancel" severity="secondary" text @click="eventOpen = false" /><Button label="Add note" :disabled="!eventResource || eventDay === null || !eventNote.trim()" @click="saveEvent" /></template>
    </Dialog>

    <Dialog v-model:visible="jobOpen" modal header="Schedule item" :style="{ width: '32rem' }">
      <dl v-if="selectedJob?.source" class="m-0 grid grid-cols-2 gap-x-6 gap-y-4 text-sm max-[520px]:grid-cols-1 [&_dt]:mb-1 [&_dt]:text-xs [&_dt]:font-bold [&_dt]:tracking-[.06em] [&_dt]:text-[#8a93a5] [&_dt]:uppercase [&_dd]:m-0 [&_dd]:font-semibold [&_dd]:text-[#2d374b]">
        <div class="col-span-2 max-[520px]:col-span-1"><dt>Property</dt><dd>{{ selectedJob.property }}</dd></div>
        <div><dt>Unit</dt><dd>{{ selectedJob.source.workOrder?.unit || '—' }}</dd></div>
        <div><dt>Service</dt><dd>{{ selectedJob.source.serviceItem?.name || '—' }}</dd></div>
        <div><dt>Status</dt><dd>{{ selectedJob.status }}</dd></div>
        <div><dt>Scheduled</dt><dd>{{ formatDateTime(selectedJob.source.scheduled) }}</dd></div>
        <div><dt>Work order</dt><dd>{{ selectedJob.source.workOrder?.num ? `#${selectedJob.source.workOrder.num}` : '—' }}</dd></div>
        <div><dt>Job</dt><dd>{{ selectedJob.source.num ? `#${selectedJob.source.num}` : '—' }}</dd></div>
        <div><dt>Purchase order</dt><dd>{{ selectedJob.source.purchaseOrder || '—' }}</dd></div>
        <div><dt>Flags</dt><dd class="flex flex-wrap gap-1.5"><Tag v-if="selectedJob.dispatched" value="Dispatched" severity="info" /><Tag v-if="selectedJob.alert" value="Alert" severity="danger" /><Tag v-if="selectedJob.updatedByTech" value="Updated by tech" severity="secondary" /><span v-if="!selectedJob.dispatched && !selectedJob.alert && !selectedJob.updatedByTech">—</span></dd></div>
      </dl>
      <template #footer><Button v-if="selectedJob?.source?.workOrder" label="Open work order" icon="pi pi-external-link" severity="secondary" text @click="editWorkOrder" /><Button label="Done" @click="jobOpen = false" /></template>
    </Dialog>

    <WorkOrderDrawer v-model:visible="orderOpen" :order-id="orderId" @saved="onOrderSaved" />
  </div>
</template>
