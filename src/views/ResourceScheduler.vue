<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { auth } from '../auth'

type JobTone = 'scheduled' | 'active' | 'ready' | 'event'

interface ScheduleJob {
  id: string
  resourceId: string | null
  day: number | null
  property: string
  detail: string
  status: string
  tone: JobTone
  alert?: boolean
  dispatched?: boolean
  updatedByTech?: boolean
}

interface Resource {
  id: string
  name: string
  type: string
  color?: string
}

const router = useRouter()
const weekStart = ref(startOfWeek(new Date()))
const resourceType = ref('All')
const hideSunday = ref(localStorage.getItem('scheduler-show-sunday') !== 'true')
const hideSaturday = ref(localStorage.getItem('scheduler-hide-saturday') === 'true')
const settingsOpen = ref(false)
const queueOpen = ref(false)
const eventOpen = ref(false)
const jobOpen = ref(false)
const dispatchNotice = ref(false)
const draggedJobId = ref<string | null>(null)
const selectedJob = ref<ScheduleJob | null>(null)
const eventResource = ref<string | null>(null)
const eventDay = ref<number | null>(null)
const eventNote = ref('')

const resourceTypes = ['All', 'Painter', 'Maintenance', 'Other']

const jobToneClasses: Record<JobTone, string> = {
  active: 'bg-[#72dcad]',
  scheduled: 'bg-[#a9e7ef]',
  ready: 'bg-[#f2e85d]',
  event: 'cursor-default bg-white',
}

function jobClasses(item: ScheduleJob) {
  return [
    'relative mb-[.38rem] block min-h-12 w-full cursor-grab overflow-hidden rounded-[.65rem] border border-[rgba(36,48,71,.7)] px-[.58rem] pt-2 pb-[.45rem] pr-[1.65rem] text-left font-[inherit] text-slate-800 shadow-sm hover:z-[1] hover:-translate-y-px hover:shadow-md active:cursor-grabbing',
    jobToneClasses[item.tone],
    item.alert ? 'border-2 border-[#ff4d4f] pt-[calc(.5rem-1px)]' : '',
    draggedJobId.value === item.id ? 'opacity-35' : '',
  ]
}

const resources = ref<Resource[]>([
  { id: 'carlos-m', name: 'Carlos Martinez', type: 'Painter' },
  { id: 'carlos-r', name: 'Carlos Ramos', type: 'Painter' },
  { id: 'edgar', name: 'Edgar Lopez', type: 'Painter' },
  { id: 'elmis', name: 'Elmis Ruano', type: 'Maintenance', color: '#eef8e9' },
  { id: 'esmeralda', name: 'Esmeralda Larrahanddo', type: 'Other' },
  { id: 'gilbert', name: 'Gilbert H', type: 'Maintenance' },
  { id: 'gino', name: 'Gino Gazzo Cossi', type: 'Painter' },
])

const jobs = ref<ScheduleJob[]>([
  job('cr-1', 'carlos-r', 1, 'Gentry Buckhead', '917 · 2x2 Full Paint', 'Scheduled', 'active', true, true),
  job('cr-2', 'carlos-r', 1, 'Gentry Buckhead', '1518 · Prime and Paint after', 'Scheduled', 'active', true),
  job('cr-3', 'carlos-r', 2, 'Tailor O4W', '925 · 2x2 Full Paint', 'Scheduled', 'active', false, true),
  job('cr-4', 'carlos-r', 3, 'Gentry Buckhead', '2020 · 1x1 Full Penthouse', 'Scheduled', 'active', true, true),
  job('cr-5', 'carlos-r', 3, 'Gentry Buckhead', '1315 · Repair/patch and paint', 'Scheduled', 'active', true),
  job('cr-6', 'carlos-r', 4, 'The Mill at New Holland', '1102 · 2x2 Full Paint', 'Scheduled', 'active', false, true),
  job('cr-7', 'carlos-r', 4, 'The Mill at New Holland', '5109 · 2x2 Full Paint', 'Scheduled', 'active', false, true),
  job('cr-8', 'carlos-r', 5, 'Gentry Buckhead', '1919 · 1x1 Full Paint', 'Ready', 'ready'),
  job('cr-9', 'carlos-r', 5, 'Tailor O4W', '309 · 1x1 Full Paint', 'Ready', 'ready'),
  job('el-1', 'edgar', 1, 'Dagney Apartments', '2614 · 1x1 Full Paint', 'Scheduled', 'scheduled', true, true),
  job('el-2', 'edgar', 1, 'Dagney Apartments', '2816 · Go Back Painter', 'Scheduled', 'scheduled', true),
  job('el-3', 'edgar', 1, 'Dagney Apartments', '1917 · 1x1 Full Paint', 'Scheduled', 'scheduled', false, false, true),
  job('el-4', 'edgar', 1, 'Modera Parkside', '2713 · 1x1 Full Paint', 'Scheduled', 'scheduled', false, true),
  job('el-5', 'edgar', 2, 'Link Apartments Canvas', '301-218 · 1x1 Full Paint', 'Scheduled', 'scheduled', true),
  job('el-6', 'edgar', 2, 'Vireo Atlanta', '1212 · Repair and touch up', 'Scheduled', 'scheduled', true),
  job('el-7', 'edgar', 2, 'Link Apartments Canvas', '275-208 · 2x2 Full Paint', 'Scheduled', 'scheduled', false, true),
  job('el-8', 'edgar', 3, 'Dagney Apartments', '2403 · 1x1 Full Paint', 'Scheduled', 'active', true),
  job('el-9', 'edgar', 3, 'Dagney Apartments', '3005 · Go Back Painter', 'Scheduled', 'scheduled', true),
  job('el-10', 'edgar', 3, 'Emmi Midtown', '30E · 2x2 Full Paint', 'Scheduled', 'scheduled', false, true),
  job('el-11', 'edgar', 4, 'Local Sugar Hill', '1123 · Paint Touch Up', 'Scheduled', 'active', false, true),
  job('el-12', 'edgar', 4, 'Local Sugar Hill', '3319 · 1x1 Full Paint', 'Scheduled', 'active'),
  job('el-13', 'edgar', 5, 'Vireo Atlanta', 'concierge · Paint Areas', 'Ready', 'ready', true),
  job('el-14', 'edgar', 5, 'Vireo Atlanta', '1914 · 1x1 Full Paint', 'Ready', 'ready'),
  job('el-15', 'edgar', 5, 'NO MORE WORK', ' ', 'Event', 'event'),
  job('er-1', 'elmis', 1, 'Auden Apartments', '146 · 2x2 TH Full Paint', 'Scheduled', 'scheduled', false, true),
  job('er-2', 'elmis', 2, 'District at Parkview', '5205 · 1x1 Full Paint', 'Scheduled', 'scheduled', false, true),
  job('er-3', 'elmis', 3, 'District at Parkview', '4309 · 1x1 Full Paint', 'Scheduled', 'scheduled', false, true),
  job('er-4', 'elmis', 4, 'Modera Parkside', '1003 · 1x1 Full Paint', 'Scheduled', 'active', false, true),
  job('er-5', 'elmis', 4, 'Modera Parkside', '1806 · 1x1 Full Paint', 'Scheduled', 'active'),
  job('es-1', 'esmeralda', 3, 'Do Not Schedule', ' ', 'Event', 'event'),
  job('es-2', 'esmeralda', 4, 'Do Not Schedule', ' ', 'Event', 'event'),
  job('es-3', 'esmeralda', 5, 'Do Not Schedule', ' ', 'Event', 'event'),
  job('es-4', 'esmeralda', 6, 'Do Not Schedule', ' ', 'Event', 'event'),
  job('gg-1', 'gino', 1, 'Ansley Forest', 'I-02 · Prime and Paint after', 'Scheduled', 'scheduled', true),
  job('gg-2', 'gino', 1, 'Ansley Forest', 'S-07 · Paint Touch Up', 'Scheduled', 'scheduled', true),
  job('gg-3', 'gino', 2, 'Ansley Forest', 'L-2 · 2x2 TH Full Paint', 'Scheduled', 'active', false, true),
  job('gg-4', 'gino', 5, 'Ansley Forest', 'L-2 · Paint Touch Up', 'Ready', 'ready'),
  job('q-1', null, null, 'The Kirkwood', '204 · 1x1 Full Paint', 'Unscheduled', 'scheduled'),
  job('q-2', null, null, 'Juniper Apartments', '3B · Drywall Repair', 'Unscheduled', 'scheduled'),
  job('q-3', null, null, 'Modera Decatur', '411 · Paint Touch Up', 'Unscheduled', 'scheduled'),
])

const visibleResources = computed(() => resourceType.value === 'All'
  ? resources.value
  : resources.value.filter((resource) => resource.type === resourceType.value))

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

const unscheduledJobs = computed(() => jobs.value.filter((item) => item.resourceId === null))

function job(id: string, resourceId: string | null, day: number | null, property: string, detail: string,
  status: string, tone: JobTone, alert = false, dispatched = false, updatedByTech = false): ScheduleJob {
  return { id, resourceId, day, property, detail, status, tone, alert, dispatched, updatedByTech }
}

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

function dayName(day: number) {
  return dateForDay(day).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()
}

function isToday(day: number) {
  return dateForDay(day).toDateString() === new Date().toDateString()
}

function jobsFor(resourceId: string, day: number) {
  return jobs.value.filter((item) => item.resourceId === resourceId && item.day === day)
}

function shiftWeek(amount: number) {
  const next = new Date(weekStart.value)
  next.setDate(next.getDate() + amount * 7)
  weekStart.value = next
  dispatchNotice.value = false
}

function goToToday() {
  weekStart.value = startOfWeek(new Date())
}

function startDrag(item: ScheduleJob, event: DragEvent) {
  if (item.tone === 'event') return
  draggedJobId.value = item.id
  event.dataTransfer?.setData('text/plain', item.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function dropJob(resourceId: string, day: number) {
  if (!draggedJobId.value) return
  const item = jobs.value.find((candidate) => candidate.id === draggedJobId.value)
  if (item) {
    item.resourceId = resourceId
    item.day = day
    item.status = 'Scheduled'
  }
  draggedJobId.value = null
}

function openJob(item: ScheduleJob) {
  if (item.tone === 'event') return
  selectedJob.value = item
  jobOpen.value = true
}

function openEventDialog() {
  eventResource.value = visibleResources.value[0]?.id ?? null
  eventDay.value = visibleDays.value[0] ?? 1
  eventNote.value = ''
  eventOpen.value = true
}

function saveEvent() {
  if (!eventResource.value || eventDay.value === null || !eventNote.value.trim()) return
  jobs.value.push(job(`event-${Date.now()}`, eventResource.value, eventDay.value, eventNote.value.trim(), ' ', 'Event', 'event'))
  eventOpen.value = false
}

function savePreferences() {
  localStorage.setItem('scheduler-show-sunday', String(!hideSunday.value))
  localStorage.setItem('scheduler-hide-saturday', String(hideSaturday.value))
  settingsOpen.value = false
}

function sendSchedule() {
  dispatchNotice.value = true
  window.setTimeout(() => { dispatchNotice.value = false }, 4000)
}

async function signOut() {
  await auth.logout()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen bg-[#f5f7fb]">
    <header class="relative z-10 flex h-[68px] items-center justify-between border-b border-[#e4e7ee] bg-white/90 px-[clamp(1rem,4vw,3.5rem)] backdrop-blur-2xl">
      <RouterLink class="flex items-center gap-3 font-extrabold tracking-[-.02em]" to="/">
        <span class="grid h-8 w-8 place-items-center rounded-[.6rem] bg-[#6972ea] text-[.8rem] text-white shadow-[0_12px_30px_rgba(71,80,190,.35)]"><i class="pi pi-bolt" /></span>
        <span>Turnkey Tracker</span>
      </RouterLink>
      <nav class="mr-auto ml-10 flex self-stretch items-stretch gap-1 max-[900px]:hidden [&_a]:flex [&_a]:items-center [&_a]:border-b-2 [&_a]:border-transparent [&_a]:px-[.8rem] [&_a]:text-[.88rem] [&_a]:font-semibold [&_a]:text-[#667085] [&_a:hover]:text-[#313a51]" aria-label="Primary navigation">
        <RouterLink class="!border-b-[#5962d8] !text-[#5962d8]" to="/scheduler">Scheduler</RouterLink>
        <RouterLink to="/properties">Properties</RouterLink><RouterLink to="/work-orders">Work orders</RouterLink><RouterLink to="/users">Users</RouterLink>
      </nav>
      <div class="flex items-center gap-3 max-[600px]:[&_.p-button-label]:hidden">
        <Button icon="pi pi-sign-out" label="Sign out" severity="secondary" text @click="signOut" />
      </div>
    </header>

    <main class="px-[clamp(1rem,3vw,2.5rem)] pt-7 pb-12 max-[600px]:px-[.65rem] max-[600px]:pt-4 max-[600px]:pb-8">
      <section class="mx-auto mb-[1.35rem] flex max-w-[1800px] items-end justify-between gap-4 max-[600px]:items-start">
        <div>
          <p class="mb-[.35rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">Resource planning</p>
          <div class="flex items-baseline gap-4 max-[600px]:flex-col max-[600px]:items-start max-[600px]:gap-[.35rem]"><h1 class="m-0 text-[2rem] leading-none tracking-[-.04em] text-[#172033] max-[600px]:text-[1.6rem]">{{ monthLabel }}</h1><span class="text-[.9rem] text-[#7a8498]">{{ weekRange }}</span></div>
        </div>
        <Tag class="max-[600px]:hidden" value="Demo schedule" severity="secondary" icon="pi pi-info-circle" />
      </section>

      <section class="mx-auto flex min-h-[58px] max-w-[1800px] items-center justify-between gap-4 rounded-t-2xl border border-b-0 border-[#e2e6ef] bg-white px-[.7rem] py-[.55rem] max-[900px]:flex-col max-[900px]:items-stretch" aria-label="Schedule controls">
        <div class="flex items-center gap-1">
          <Button label="Today" severity="secondary" outlined @click="goToToday" />
          <Button icon="pi pi-chevron-left" severity="secondary" text rounded aria-label="Previous week" @click="shiftWeek(-1)" />
          <Button icon="pi pi-chevron-right" severity="secondary" text rounded aria-label="Next week" @click="shiftWeek(1)" />
        </div>
        <div class="flex items-center gap-1 max-[900px]:flex-wrap max-[900px]:[&_.p-button:last-child]:flex-1">
          <Select v-model="resourceType" :options="resourceTypes" class="w-40" aria-label="Resource type" />
          <Button icon="pi pi-cog" severity="secondary" text rounded aria-label="Preferences" @click="settingsOpen = true" />
          <Button icon="pi pi-file-edit" severity="secondary" text rounded aria-label="Add schedule note" @click="openEventDialog" />
          <Button icon="pi pi-inbox" severity="secondary" text rounded aria-label="Open unscheduled queue" @click="queueOpen = true" />
          <Button icon="pi pi-send" label="Send schedule" @click="sendSchedule" />
        </div>
      </section>

      <div v-if="dispatchNotice" class="mx-auto max-w-[1800px] border border-b-0 border-[#afe2d7] bg-[#e8faf5] px-4 py-[.7rem] text-[.86rem] font-semibold text-[#08745f] [&_i]:mr-[.4rem]" role="status"><i class="pi pi-check-circle" /> Schedule prepared for {{ visibleResources.length }} resources.</div>

      <section class="mx-auto max-w-[1800px] overflow-hidden rounded-b-2xl border border-[#e2e6ef] bg-white shadow-[0_12px_35px_rgba(30,41,75,.05)]">
        <div class="overflow-x-auto">
          <div class="grid min-w-[calc(210px+var(--day-count)*180px)] [grid-template-columns:210px_repeat(var(--day-count),minmax(180px,1fr))] max-[600px]:min-w-[calc(160px+var(--day-count)*170px)] max-[600px]:[grid-template-columns:160px_repeat(var(--day-count),minmax(170px,1fr))]" :style="{ '--day-count': visibleDays.length }">
            <div class="sticky top-0 left-0 z-4 flex min-h-[68px] flex-col justify-center border-r border-b border-[#dfe4ec] bg-[#f8f9fc] px-4"><span class="text-[.76rem] font-extrabold tracking-[.04em] text-[#414b60] uppercase">Team member</span><small class="mt-[.22rem] text-[#9098a8]">{{ visibleResources.length }} resources</small></div>
            <div v-for="day in visibleDays" :key="`header-${day}`" class="sticky top-0 z-3 flex min-h-[68px] items-center justify-center gap-2 border-r border-b border-[#e5e8ef] bg-[#f8f9fc] text-[#7c8598]">
              <span class="text-[.72rem] font-extrabold tracking-[.08em]">{{ dayName(day) }}</span><strong :class="['grid h-8 w-8 place-items-center text-[.95rem]', isToday(day) ? 'rounded-full bg-[#5d66da] text-white' : 'text-[#30394c]']">{{ dateForDay(day).getDate() }}</strong>
            </div>

            <template v-for="resource in visibleResources" :key="resource.id">
              <div class="sticky left-0 z-2 flex min-h-28 items-start gap-[.7rem] border-r border-b border-[#dfe4ec] bg-[#fbfcfe] px-[.85rem] py-4" :style="resource.color ? { background: resource.color } : undefined">
                <span class="grid h-8 w-8 shrink-0 place-items-center rounded-[.6rem] bg-[#e9ebff] text-[.68rem] font-extrabold text-[#4e58c4]">{{ resource.name.split(' ').map((part) => part[0]).slice(0, 2).join('') }}</span>
                <div class="min-w-0"><strong class="block overflow-hidden text-[.84rem] text-ellipsis whitespace-nowrap text-[#2d374b]">{{ resource.name }}</strong><small class="mt-1 block text-[.7rem] text-[#8a93a5]">{{ resource.type }}</small></div>
              </div>
              <div v-for="day in visibleDays" :key="`${resource.id}-${day}`" :class="['min-h-28 border-r border-b border-[#e2e6ed] p-[.38rem] transition-colors has-[.dragging]:bg-[#f0f2ff]', isToday(day) ? 'bg-[#fafaff]' : 'bg-white']" @dragover.prevent @drop.prevent="dropJob(resource.id, day)">
                <button
                  v-for="item in jobsFor(resource.id, day)" :key="item.id"
                  :class="jobClasses(item)"
                  :draggable="item.tone !== 'event'" :title="`${item.property}\n${item.detail}\nStatus: ${item.status}`" type="button"
                  @dragstart="startDrag(item, $event)" @dragend="draggedJobId = null" @dblclick="openJob(item)"
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
        <article v-for="item in unscheduledJobs" :key="item.id" class="grid cursor-grab gap-[.2rem] rounded-xl border border-[#dfe4ed] bg-slate-50 p-[.85rem]" draggable="true" @dragstart="startDrag(item, $event)" @dragend="draggedJobId = null">
          <span class="text-[.72rem] font-extrabold text-[#5962d8] uppercase">{{ item.property }}</span><strong class="text-[.88rem]">{{ item.detail }}</strong><small class="text-[#8b94a6]">{{ item.status }}</small>
        </article>
      </div>
      <div v-else class="grid justify-items-center px-4 py-12 text-[#7f899b] [&_i]:text-[1.8rem] [&_i]:text-[#18a286]"><i class="pi pi-check-circle" /><p>Everything is scheduled.</p></div>
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
      <div v-if="selectedJob" class="grid gap-4 [&_label]:grid [&_label]:gap-[.45rem] [&_label]:text-[.8rem] [&_label]:font-bold [&_label]:text-[#3c465a] [&_.p-inputtext]:w-full [&_.p-select]:w-full">
        <label>Property<InputText v-model="selectedJob.property" /></label>
        <label>Work description<InputText v-model="selectedJob.detail" /></label>
        <label>Status<Select v-model="selectedJob.status" :options="['Scheduled', 'In Progress', 'Ready', 'Complete']" /></label>
      </div>
      <template #footer><Button label="Done" @click="jobOpen = false" /></template>
    </Dialog>
  </div>
</template>
