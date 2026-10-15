<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import AppHeader from '../components/AppHeader.vue'

type WorkOrderStatus = 'New' | 'Scheduled' | 'In progress' | 'Completed' | 'Cancelled'
type JobSection = 'details' | 'notes' | 'items' | 'attachments' | 'history'

interface JobNote {
  id: number
  text: string
  user: string
  timestamp: string
}

interface JobItem {
  id: number
  name: string
  quantity: number
  addedBy: string
  timestamp: string
}

interface JobAttachment {
  id: number
  url: string
  name: string
  phase: 'Before' | 'After'
  technician: string
  timestamp: string
}

interface JobStatusChange {
  id: number
  from: WorkOrderStatus | null
  to: WorkOrderStatus
  user: string
  timestamp: string
}

interface WorkOrderJob {
  id: number
  name: string
  status: WorkOrderStatus
  scheduledDate: string
  assignedTo: string
  po: string
  cost: number
  listPrice: number
  dispatched: boolean
  alert: boolean
  techUpdated: boolean
  description: string
  notes: JobNote[]
  items: JobItem[]
  attachments: JobAttachment[]
  statusChanges: JobStatusChange[]
}

interface WorkOrder {
  id: number
  property: string
  address: string
  unit: string
  occupied: boolean
  contact: string
  contactPhone: string
  status: WorkOrderStatus
  scheduledDate: string
  assignedTo: string
  dispatched: boolean
  jobs: WorkOrderJob[]
}

const query = ref('')
const statusFilter = ref<'All' | WorkOrderStatus>('All')
const propertyFilter = ref('All properties')
const drawerOpen = ref(false)
const editing = ref<WorkOrder | null>(null)
const activeJobId = ref<number | 'overview'>('overview')
const activeJobSection = ref<JobSection>('details')
const saved = ref(false)
const noteText = ref('')
const selectedServiceItem = ref('')
const currentUser = 'Barbara Smrecak'

const statuses: Array<'All' | WorkOrderStatus> = ['All', 'New', 'Scheduled', 'In progress', 'Completed', 'Cancelled']
const jobStatuses: WorkOrderStatus[] = ['New', 'Scheduled', 'In progress', 'Completed', 'Cancelled']
const assignees = ['Unassigned', 'Reyna Cardenas', 'Marcus Hill', 'Tanya Brooks', 'Devon Price', 'BrightClean Team']
const jobTypes = ['Clubhouse Cleaning', 'Full Paint', 'Turn Cleaning', 'Carpet Replacement', 'Drywall Repair', 'Final Inspection']
const serviceItemOptions = ['Touch-up paint · 1 gallon', 'Primer · 1 gallon', 'Drywall patch kit', 'HVAC filter · 20×20', 'Door stop', 'Smoke detector battery', 'Carpet transition strip', 'Cleaning supplies']
const jobSections: Array<{ value: JobSection; label: string; icon: string }> = [
  { value: 'details', label: 'Details', icon: 'pi-sliders-h' },
  { value: 'notes', label: 'Notes', icon: 'pi-comment' },
  { value: 'items', label: 'Additional items', icon: 'pi-shopping-cart' },
  { value: 'attachments', label: 'Attachments', icon: 'pi-images' },
  { value: 'history', label: 'Status history', icon: 'pi-history' },
]

const workOrders = ref<WorkOrder[]>([
  makeOrder(16548, 'One White Oak', '2080 One White Oak Lane, Cumming, GA 30041', 'Clubhouse', 'Scheduled', '2026-11-23', 'Reyna Cardenas', true, [
    makeJob(1, 'Clubhouse Cleaning', 'Scheduled', '2026-11-23', 'Reyna Cardenas', 150, 240, true),
    makeJob(2, 'Final Inspection', 'New', '2026-11-24', 'Marcus Hill', 75, 110, false),
  ]),
  makeOrder(16547, 'Ansley Forest', '1616 Piedmont Avenue NE, Atlanta, GA 30324', '14B', 'In progress', '2026-10-09', 'Marcus Hill', true, [
    makeJob(3, 'Full Paint', 'In progress', '2026-10-09', 'Marcus Hill', 725, 1020, true),
    makeJob(4, 'Turn Cleaning', 'Scheduled', '2026-10-10', 'BrightClean Team', 185, 275, true),
    makeJob(5, 'Final Inspection', 'New', '2026-10-11', 'Tanya Brooks', 65, 95, false),
  ]),
  makeOrder(16546, 'Auden Apartments', '3300 Overton Park Drive SE, Atlanta, GA 30339', '207', 'New', '2026-10-13', 'Unassigned', false, [
    makeJob(6, 'Carpet Replacement', 'New', '2026-10-13', 'Unassigned', 480, 690, false),
  ]),
  makeOrder(16545, 'Avonlea Westside', '2788 Defoors Ferry Road NW, Atlanta, GA 30318', '312', 'Completed', '2026-10-07', 'Devon Price', true, [
    makeJob(7, 'Drywall Repair', 'Completed', '2026-10-07', 'Devon Price', 210, 340, true),
    makeJob(8, 'Full Paint', 'Completed', '2026-10-07', 'Marcus Hill', 640, 920, true),
  ]),
  makeOrder(16544, 'Dagney Apartments', '888 Juniper Street NE, Atlanta, GA 30309', 'PH2', 'Scheduled', '2026-10-12', 'Tanya Brooks', false, [
    makeJob(9, 'Final Inspection', 'Scheduled', '2026-10-12', 'Tanya Brooks', 65, 95, false),
  ]),
  makeOrder(16543, 'District at Parkview', '5141 Stone Mountain Highway, Stone Mountain, GA 30087', '6C', 'Cancelled', '2026-10-06', 'Unassigned', false, [
    makeJob(10, 'Turn Cleaning', 'Cancelled', '2026-10-06', 'Unassigned', 175, 260, false),
  ]),
  makeOrder(16542, 'Emmi Midtown', '1405 Spring Street NW, Atlanta, GA 30309', '1108', 'Scheduled', '2026-10-15', 'BrightClean Team', true, [
    makeJob(11, 'Turn Cleaning', 'Scheduled', '2026-10-15', 'BrightClean Team', 190, 285, true),
    makeJob(12, 'Final Inspection', 'New', '2026-10-16', 'Tanya Brooks', 65, 95, false),
  ]),
])

function makeJob(id: number, name: string, status: WorkOrderStatus, scheduledDate: string, assignedTo: string, cost: number, listPrice: number, dispatched: boolean): WorkOrderJob {
  const day = String(6 + (id % 3)).padStart(2, '0')
  const notes: JobNote[] = [
    { id: id * 100 + 1, text: 'Confirmed access instructions with the leasing office.', user: 'Barbara Smrecak', timestamp: `2026-10-${day}T09:14:00` },
    { id: id * 100 + 2, text: 'Materials are staged in the maintenance storage room.', user: 'Reyna Cardenas', timestamp: `2026-10-${day}T11:32:00` },
    { id: id * 100 + 3, text: 'Technician reviewed the scope and will upload before photos on arrival.', user: assignedTo === 'Unassigned' ? 'Marcus Hill' : assignedTo, timestamp: `2026-10-${day}T14:08:00` },
  ]
  const items: JobItem[] = [
    { id: id * 100 + 4, name: id % 2 ? 'Touch-up paint · 1 gallon' : 'Cleaning supplies', quantity: 1, addedBy: 'Reyna Cardenas', timestamp: `2026-10-${day}T10:05:00` },
    { id: id * 100 + 5, name: id % 2 ? 'Drywall patch kit' : 'Smoke detector battery', quantity: id % 2 ? 1 : 2, addedBy: 'Marcus Hill', timestamp: `2026-10-${day}T13:41:00` },
  ]
  const tech = assignedTo === 'Unassigned' ? 'Marcus Hill' : assignedTo
  const attachments: JobAttachment[] = [
    { id: id * 100 + 6, url: samplePhoto('#d6e2eb', '#879eae', 'BEFORE'), name: 'Living area before work', phase: 'Before', technician: tech, timestamp: `2026-10-${day}T08:46:00` },
    { id: id * 100 + 7, url: samplePhoto('#dce8dd', '#78927c', 'AFTER'), name: 'Completed work area', phase: 'After', technician: tech, timestamp: `2026-10-${day}T16:22:00` },
  ]
  const statusChanges: JobStatusChange[] = [
    { id: id * 100 + 8, from: null, to: 'New', user: 'Barbara Smrecak', timestamp: `2026-10-${day}T08:15:00` },
    ...(status !== 'New' ? [{ id: id * 100 + 9, from: 'New' as WorkOrderStatus, to: 'Scheduled' as WorkOrderStatus, user: 'Reyna Cardenas', timestamp: `2026-10-${day}T09:02:00` }] : []),
    ...(!['New', 'Scheduled'].includes(status) ? [{ id: id * 100 + 10, from: 'Scheduled' as WorkOrderStatus, to: status, user: tech, timestamp: `2026-10-${day}T15:48:00` }] : []),
  ]
  return { id, name, status, scheduledDate, assignedTo, cost, listPrice, dispatched, po: '', alert: false, techUpdated: false, description: '', notes, items, attachments, statusChanges }
}

function samplePhoto(sky: string, ground: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="${sky}"/><path d="M0 290L135 185l95 76 105-117 162 146 143-96v226H0z" fill="${ground}"/><rect x="36" y="32" rx="14" width="112" height="40" fill="white" fill-opacity=".88"/><text x="92" y="58" text-anchor="middle" font-family="Arial" font-size="16" font-weight="700" fill="#344054">${label}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function makeOrder(id: number, property: string, address: string, unit: string, status: WorkOrderStatus, scheduledDate: string, assignedTo: string, dispatched: boolean, jobs: WorkOrderJob[]): WorkOrder {
  return { id, property, address, unit, occupied: false, contact: 'Property leasing office', contactPhone: '(470) 555-0148', status, scheduledDate, assignedTo, dispatched, jobs }
}

const propertyOptions = computed(() => ['All properties', ...Array.from(new Set(workOrders.value.map((item) => item.property))).sort()])
const filteredOrders = computed(() => {
  const term = query.value.trim().toLowerCase()
  return workOrders.value.filter((item) => {
    const matchesStatus = statusFilter.value === 'All' || item.status === statusFilter.value
    const matchesProperty = propertyFilter.value === 'All properties' || item.property === propertyFilter.value
    const matchesTerm = !term || `${item.id} ${item.property} ${item.unit} ${item.assignedTo}`.toLowerCase().includes(term)
    return matchesStatus && matchesProperty && matchesTerm
  })
})
const openCount = computed(() => workOrders.value.filter((item) => !['Completed', 'Cancelled'].includes(item.status)).length)
const dispatchedCount = computed(() => workOrders.value.filter((item) => item.dispatched).length)
const dueThisWeek = computed(() => workOrders.value.filter((item) => item.scheduledDate >= '2026-10-08' && item.scheduledDate <= '2026-10-15').length)
const activeJob = computed(() => editing.value?.jobs.find((job) => job.id === activeJobId.value) ?? null)

function cloneOrder(order: WorkOrder): WorkOrder {
  return JSON.parse(JSON.stringify(order)) as WorkOrder
}

function openOrder(order: WorkOrder) {
  editing.value = cloneOrder(order)
  activeJobId.value = order.jobs[0]?.id ?? 'overview'
  activeJobSection.value = 'details'
  saved.value = false
  drawerOpen.value = true
}

function addOrder() {
  const id = Math.max(...workOrders.value.map((item) => item.id)) + 1
  editing.value = makeOrder(id, '', '', '', 'New', '', 'Unassigned', false, [makeJob(Date.now(), 'Turn Cleaning', 'New', '', 'Unassigned', 0, 0, false)])
  activeJobId.value = editing.value.jobs[0].id
  activeJobSection.value = 'details'
  saved.value = false
  drawerOpen.value = true
}

function addJob() {
  if (!editing.value) return
  const job = makeJob(Date.now(), 'Turn Cleaning', 'New', editing.value.scheduledDate, 'Unassigned', 0, 0, false)
  editing.value.jobs.push(job)
  activeJobId.value = job.id
  activeJobSection.value = 'details'
}

function selectJob(id: number | 'overview') {
  activeJobId.value = id
  activeJobSection.value = 'details'
  noteText.value = ''
  selectedServiceItem.value = ''
}

function removeJob() {
  if (!editing.value || !activeJob.value || editing.value.jobs.length === 1) return
  const index = editing.value.jobs.findIndex((job) => job.id === activeJob.value?.id)
  editing.value.jobs.splice(index, 1)
  activeJobId.value = editing.value.jobs[Math.max(0, index - 1)]?.id ?? 'overview'
}

function saveOrder() {
  if (!editing.value || !editing.value.property.trim()) return
  const next = cloneOrder(editing.value)
  const firstActiveJob = next.jobs.find((job) => job.status !== 'Completed' && job.status !== 'Cancelled') ?? next.jobs[0]
  if (firstActiveJob) {
    next.status = firstActiveJob.status
    next.scheduledDate = firstActiveJob.scheduledDate
    next.assignedTo = firstActiveJob.assignedTo
    next.dispatched = next.jobs.some((job) => job.dispatched)
  }
  const index = workOrders.value.findIndex((item) => item.id === next.id)
  if (index >= 0) workOrders.value[index] = next
  else workOrders.value.unshift(next)
  editing.value = cloneOrder(next)
  saved.value = true
  window.setTimeout(() => { saved.value = false }, 2200)
}

function formatDate(value: string) {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function addNote() {
  if (!activeJob.value || !noteText.value.trim()) return
  activeJob.value.notes.unshift({ id: Date.now(), text: noteText.value.trim(), user: currentUser, timestamp: new Date().toISOString() })
  noteText.value = ''
}

function addServiceItem() {
  if (!activeJob.value || !selectedServiceItem.value) return
  activeJob.value.items.unshift({ id: Date.now(), name: selectedServiceItem.value, quantity: 1, addedBy: currentUser, timestamp: new Date().toISOString() })
  selectedServiceItem.value = ''
}

function removeServiceItem(id: number) {
  if (!activeJob.value) return
  activeJob.value.items = activeJob.value.items.filter((item) => item.id !== id)
}

function handleAttachments(event: Event) {
  if (!activeJob.value) return
  const input = event.target as HTMLInputElement
  Array.from(input.files ?? []).forEach((file, index) => {
    activeJob.value?.attachments.unshift({
      id: Date.now() + index,
      url: URL.createObjectURL(file),
      name: file.name,
      phase: 'After',
      technician: activeJob.value.assignedTo === 'Unassigned' ? currentUser : activeJob.value.assignedTo,
      timestamp: new Date().toISOString(),
    })
  })
  input.value = ''
}

function updateJobStatus(job: WorkOrderJob, status: WorkOrderStatus) {
  if (job.status === status) return
  job.statusChanges.unshift({ id: Date.now(), from: job.status, to: status, user: currentUser, timestamp: new Date().toISOString() })
  job.status = status
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)
}

function statusClass(status: WorkOrderStatus) {
  return {
    New: 'bg-[#eef0ff] text-[#5962d8]',
    Scheduled: 'bg-[#e8f4ff] text-[#2876ae]',
    'In progress': 'bg-[#fff2d8] text-[#a76708]',
    Completed: 'bg-[#e2f7f1] text-[#13836e]',
    Cancelled: 'bg-[#f1f2f5] text-[#727b8d]',
  }[status]
}
</script>

<template>
  <div class="min-h-screen bg-[#f5f7fb]">
    <AppHeader />

    <main class="mx-auto w-[min(1500px,calc(100%-2rem))] py-[clamp(1.5rem,4vw,3rem)] max-[560px]:w-[calc(100%-1.25rem)]">
      <section class="mb-7 flex items-end justify-between gap-6 max-[680px]:items-start">
        <div><p class="mb-[.45rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">Operations</p><h1 class="m-0 text-[clamp(2rem,4vw,3rem)] leading-none tracking-[-.05em]">Work orders</h1><p class="mt-3 mb-0 text-[#717b8f] max-[580px]:hidden">Schedule, assign, and dispatch every job from one place.</p></div>
        <Button icon="pi pi-plus" label="New work order" size="large" @click="addOrder" />
      </section>

      <section class="mb-5 grid grid-cols-3 gap-3 max-[680px]:grid-cols-1">
        <div v-for="stat in [{ icon: 'pi-briefcase', value: openCount, label: 'Open work orders', color: 'bg-[#eceeff] text-[#5962d8]' }, { icon: 'pi-calendar', value: dueThisWeek, label: 'Scheduled this week', color: 'bg-[#fff2d8] text-[#b87814]' }, { icon: 'pi-send', value: dispatchedCount, label: 'Dispatched', color: 'bg-[#e2f7f1] text-[#138c74]' }]" :key="stat.label" class="flex items-center gap-4 rounded-2xl border border-[#e3e7ef] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(30,41,75,.035)]"><span :class="['grid h-10 w-10 place-items-center rounded-xl', stat.color]"><i :class="['pi', stat.icon]" /></span><div><strong class="block text-xl tracking-[-.03em]">{{ stat.value }}</strong><small class="text-[#7d8698]">{{ stat.label }}</small></div></div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-[#e2e6ef] bg-white shadow-[0_12px_35px_rgba(30,41,75,.045)]">
        <div class="flex items-center gap-3 border-b border-[#e8ebf1] px-5 py-4 max-[760px]:flex-col max-[760px]:items-stretch">
          <div class="relative min-w-0 flex-1"><i class="pi pi-search absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-[#8a93a5]" /><InputText v-model="query" class="w-full !pl-10" placeholder="Search order, unit, assignee…" /></div>
          <Select v-model="propertyFilter" :options="propertyOptions" class="w-60 max-[760px]:w-full" aria-label="Filter by property" />
          <Select v-model="statusFilter" :options="statuses" class="w-45 max-[760px]:w-full" aria-label="Filter by status" />
        </div>
        <div class="grid grid-cols-[minmax(200px,1.3fr)_140px_150px_140px_minmax(150px,1fr)_110px_36px] gap-4 border-b border-[#e8ebf1] bg-[#fafbfc] px-5 py-3 text-[.68rem] font-extrabold tracking-[.08em] text-[#80899a] uppercase max-[960px]:hidden"><span>Property</span><span>Scheduled date</span><span>Unit</span><span>Status</span><span>Assigned to</span><span>Dispatched</span><span></span></div>
        <div v-if="filteredOrders.length">
          <button v-for="order in filteredOrders" :key="order.id" type="button" class="group grid w-full grid-cols-[minmax(200px,1.3fr)_140px_150px_140px_minmax(150px,1fr)_110px_36px] items-center gap-4 border-0 border-b border-[#edf0f4] bg-white px-5 py-4 text-left text-inherit last:border-b-0 hover:bg-[#fafbff] max-[960px]:grid-cols-[1fr_auto]" @click="openOrder(order)">
            <span class="min-w-0"><span class="block overflow-hidden text-[.9rem] font-bold text-ellipsis whitespace-nowrap text-[#293246]">{{ order.property }}</span><small class="mt-1 block text-[#8a93a4]">WO #{{ order.id }} · {{ order.jobs.length }} job{{ order.jobs.length === 1 ? '' : 's' }}</small></span>
            <span class="text-[.84rem] text-[#4e586d] max-[960px]:hidden">{{ formatDate(order.scheduledDate) }}</span><span class="text-[.84rem] font-semibold text-[#4e586d] max-[960px]:hidden">{{ order.unit }}</span>
            <span class="max-[960px]:row-start-2"><span :class="['inline-flex rounded-full px-2.5 py-1 text-[.72rem] font-bold', statusClass(order.status)]">{{ order.status }}</span></span>
            <span class="overflow-hidden text-[.84rem] text-ellipsis whitespace-nowrap text-[#4e586d] max-[960px]:hidden"><i class="pi pi-user mr-2 text-xs text-[#9aa2b0]" />{{ order.assignedTo }}</span>
            <span class="max-[960px]:hidden"><i :class="['pi mr-2 text-xs', order.dispatched ? 'pi-check-circle text-[#159477]' : 'pi-circle text-[#aab1bd]']" /><span class="text-[.8rem] font-semibold text-[#596276]">{{ order.dispatched ? 'Yes' : 'No' }}</span></span>
            <span class="grid h-8 w-8 place-items-center rounded-full text-[#a1a8b5] group-hover:bg-[#eceeff] group-hover:text-[#5962d8] max-[960px]:col-start-2 max-[960px]:row-span-2 max-[960px]:row-start-1"><i class="pi pi-chevron-right text-xs" /></span>
          </button>
        </div>
        <div v-else class="grid min-h-64 place-items-center px-6 py-12 text-center"><div><span class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f0f2f7] text-[#7e8799]"><i class="pi pi-filter-slash" /></span><strong class="mt-4 block">No work orders found</strong><p class="mt-1 text-sm text-[#858ea0]">Try a different property or status.</p></div></div>
      </section>
    </main>

    <Drawer v-model:visible="drawerOpen" position="right" class="!w-[min(980px,100vw)] [&_.p-drawer-content]:!p-0 [&_.p-drawer-header]:!hidden">
      <template v-if="editing">
        <div class="sticky top-0 z-5 border-b border-[#e4e8ef] bg-white">
          <div class="flex items-start justify-between gap-4 px-6 pt-6 pb-4 max-[540px]:px-4"><div><p class="mb-1 text-[.7rem] font-extrabold tracking-[.1em] text-[#6972ea] uppercase">Work order #{{ editing.id }}</p><h2 class="m-0 text-2xl tracking-[-.04em]">{{ editing.property || 'New work order' }}</h2><p class="mt-1 mb-0 text-sm text-[#7d8697]">Unit {{ editing.unit || 'not set' }} · {{ editing.jobs.length }} job{{ editing.jobs.length === 1 ? '' : 's' }}</p></div><Button icon="pi pi-times" severity="secondary" text rounded aria-label="Close" @click="drawerOpen = false" /></div>
          <nav class="flex gap-1 overflow-x-auto px-6 max-[540px]:px-4" aria-label="Work order jobs"><button type="button" :class="['shrink-0 border-0 border-b-2 bg-transparent px-3 py-3 text-[.8rem] font-bold', activeJobId === 'overview' ? 'border-[#5962d8] text-[#5962d8]' : 'border-transparent text-[#7a8395]']" @click="selectJob('overview')"><i class="pi pi-info-circle mr-2" />Overview</button><button v-for="job in editing.jobs" :key="job.id" type="button" :class="['shrink-0 border-0 border-b-2 bg-transparent px-3 py-3 text-[.8rem] font-bold', activeJobId === job.id ? 'border-[#5962d8] text-[#5962d8]' : 'border-transparent text-[#7a8395]']" @click="selectJob(job.id)"><i class="pi pi-wrench mr-2" />{{ job.name }}</button><button type="button" class="shrink-0 border-0 border-b-2 border-transparent bg-transparent px-3 py-3 text-[.8rem] font-bold text-[#5962d8]" @click="addJob"><i class="pi pi-plus mr-1" /> Add job</button></nav>
        </div>

        <form class="p-6 max-[540px]:p-4" @submit.prevent="saveOrder">
          <section v-if="activeJobId === 'overview'" class="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 [&_label]:grid [&_label]:gap-2 [&_label]:text-[.77rem] [&_label]:font-bold [&_label]:text-[#4c566a] [&_.p-inputtext]:w-full">
            <label>Property<InputText v-model="editing.property" required placeholder="Property name" /></label><label>Unit<InputText v-model="editing.unit" placeholder="Unit or location" /></label><label class="col-span-2 max-[620px]:col-span-1">Address<InputText v-model="editing.address" /></label><label>Property contact<InputText v-model="editing.contact" /></label><label>Contact phone<InputText v-model="editing.contactPhone" /></label><label class="col-span-2 flex !flex-row items-center gap-3 rounded-xl border border-[#e2e6ed] p-4 max-[620px]:col-span-1"><Checkbox v-model="editing.occupied" binary /><span><strong class="block text-[.84rem]">Occupied unit</strong><small class="mt-1 block font-normal text-[#858e9f]">Notify the technician before entry.</small></span></label>
            <div class="col-span-2 mt-2 max-[620px]:col-span-1"><h3 class="mb-3 text-base">Jobs in this order</h3><div class="grid gap-2"><button v-for="job in editing.jobs" :key="job.id" type="button" class="flex items-center justify-between rounded-xl border border-[#e2e6ed] bg-white px-4 py-3 text-left text-inherit hover:border-[#b7bcef] hover:bg-[#fafaff]" @click="selectJob(job.id)"><span><strong class="block text-sm">{{ job.name }}</strong><small class="mt-1 block text-[#858e9f]">{{ job.assignedTo }} · {{ formatDate(job.scheduledDate) }}</small></span><span :class="['rounded-full px-2.5 py-1 text-[.7rem] font-bold', statusClass(job.status)]">{{ job.status }}</span></button></div></div>
          </section>

          <section v-else-if="activeJob">
            <div class="mb-5 flex items-start justify-between gap-4"><div><h3 class="m-0 text-xl tracking-[-.03em]">{{ activeJob.name }}</h3><p class="mt-1 mb-0 text-sm text-[#7d8697]">{{ activeJob.assignedTo }} · {{ formatDate(activeJob.scheduledDate) }}</p></div><Button type="button" icon="pi pi-trash" label="Remove job" severity="danger" text size="small" :disabled="editing.jobs.length === 1" @click="removeJob" /></div>

            <nav class="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-[#f3f5f8] p-1" aria-label="Job sections">
              <button v-for="section in jobSections" :key="section.value" type="button" :class="['flex shrink-0 items-center gap-2 rounded-lg border-0 px-3 py-2.5 text-[.76rem] font-bold', activeJobSection === section.value ? 'bg-white text-[#5962d8] shadow-sm' : 'bg-transparent text-[#747e91] hover:text-[#3f485b]']" @click="activeJobSection = section.value"><i :class="['pi', section.icon]" />{{ section.label }}<span v-if="section.value === 'notes'" class="rounded-full bg-[#e9ebf2] px-1.5 py-0.5 text-[.62rem] text-[#626b7d]">{{ activeJob.notes.length }}</span><span v-else-if="section.value === 'items'" class="rounded-full bg-[#e9ebf2] px-1.5 py-0.5 text-[.62rem] text-[#626b7d]">{{ activeJob.items.length }}</span><span v-else-if="section.value === 'attachments'" class="rounded-full bg-[#e9ebf2] px-1.5 py-0.5 text-[.62rem] text-[#626b7d]">{{ activeJob.attachments.length }}</span></button>
            </nav>

            <div v-if="activeJobSection === 'details'" class="grid grid-cols-[1fr_260px] gap-6 max-[760px]:grid-cols-1">
              <div class="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1 [&_label]:grid [&_label]:gap-2 [&_label]:text-[.77rem] [&_label]:font-bold [&_label]:text-[#4c566a] [&_.p-inputtext]:w-full [&_.p-select]:w-full [&_.p-inputnumber]:w-full">
                <label class="col-span-2 max-[560px]:col-span-1">Job type<Select v-model="activeJob.name" :options="jobTypes" editable /></label><label>Status<Select :model-value="activeJob.status" :options="jobStatuses" @update:model-value="updateJobStatus(activeJob, $event)" /></label><label>PO number<InputText v-model="activeJob.po" /></label><label>Scheduled date<InputText v-model="activeJob.scheduledDate" type="date" /></label><label>Assigned to<Select v-model="activeJob.assignedTo" :options="assignees" /></label><label>Cost<InputNumber v-model="activeJob.cost" mode="currency" currency="USD" locale="en-US" :min="0" /></label><label>List price<InputNumber v-model="activeJob.listPrice" mode="currency" currency="USD" locale="en-US" :min="0" /></label><label class="col-span-2 max-[560px]:col-span-1">Job instructions<Textarea v-model="activeJob.description" rows="5" class="w-full" placeholder="Access details, scope, materials, or technician instructions…" /></label>
              </div>
              <aside class="self-start rounded-2xl border border-[#e2e6ed] bg-[#fafbfc] p-5"><p class="mt-0 mb-4 text-[.7rem] font-extrabold tracking-[.1em] text-[#7a8395] uppercase">Dispatch attributes</p><label class="mb-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(20,30,55,.06)]"><span><strong class="block text-sm">Dispatched</strong><small class="text-[#858e9f]">Sent to assignee</small></span><Checkbox v-model="activeJob.dispatched" binary /></label><label class="mb-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(20,30,55,.06)]"><span><strong class="block text-sm">Alert</strong><small class="text-[#858e9f]">Needs attention</small></span><Checkbox v-model="activeJob.alert" binary /></label><label class="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(20,30,55,.06)]"><span><strong class="block text-sm">Tech updated</strong><small class="text-[#858e9f]">Changes reviewed</small></span><Checkbox v-model="activeJob.techUpdated" binary /></label><div class="mt-5 border-t border-[#e2e5eb] pt-4"><div class="mb-2 flex justify-between text-sm text-[#727c8f]"><span>Cost</span><strong class="text-[#30394d]">{{ money(activeJob.cost) }}</strong></div><div class="flex justify-between text-sm text-[#727c8f]"><span>List price</span><strong class="text-[#30394d]">{{ money(activeJob.listPrice) }}</strong></div></div></aside>
            </div>

            <div v-else-if="activeJobSection === 'notes'">
              <div class="mb-5 rounded-2xl border border-[#e1e5ed] bg-[#fafbfc] p-4"><Textarea v-model="noteText" rows="3" class="w-full" placeholder="Add an update for the team…" /><div class="mt-3 flex items-center justify-between gap-3"><small class="text-[#858e9f]">Posting as {{ currentUser }}</small><Button type="button" icon="pi pi-send" label="Add note" size="small" :disabled="!noteText.trim()" @click="addNote" /></div></div>
              <div class="relative ml-4 border-l border-[#dfe3ea] pl-6"><article v-for="note in activeJob.notes" :key="note.id" class="relative mb-4 rounded-xl border border-[#e3e7ee] bg-white p-4 last:mb-0"><span class="absolute top-5 -left-[2.05rem] grid h-4 w-4 place-items-center rounded-full border-4 border-white bg-[#6972ea]" /><div class="mb-2 flex flex-wrap items-center justify-between gap-2"><strong class="text-sm">{{ note.user }}</strong><time class="text-xs text-[#8a93a4]">{{ formatTimestamp(note.timestamp) }}</time></div><p class="m-0 text-sm leading-6 text-[#505a6e]">{{ note.text }}</p></article></div>
            </div>

            <div v-else-if="activeJobSection === 'items'">
              <div class="mb-5 flex gap-3 rounded-2xl border border-[#e1e5ed] bg-[#fafbfc] p-4 max-[560px]:flex-col"><Select v-model="selectedServiceItem" :options="serviceItemOptions" class="min-w-0 flex-1" placeholder="Select an item from the service item table" filter /><Button type="button" icon="pi pi-plus" label="Add item" :disabled="!selectedServiceItem" @click="addServiceItem" /></div>
              <div class="overflow-hidden rounded-xl border border-[#e2e6ed]"><div class="grid grid-cols-[1fr_80px_180px_44px] gap-3 border-b border-[#e7eaf0] bg-[#fafbfc] px-4 py-3 text-[.68rem] font-extrabold tracking-[.08em] text-[#80899a] uppercase max-[620px]:hidden"><span>Service item</span><span>Qty</span><span>Added by</span><span></span></div><div v-for="item in activeJob.items" :key="item.id" class="grid grid-cols-[1fr_80px_180px_44px] items-center gap-3 border-b border-[#edf0f4] px-4 py-4 last:border-0 max-[620px]:grid-cols-[1fr_auto]"><strong class="text-sm">{{ item.name }}</strong><InputNumber v-model="item.quantity" :min="1" show-buttons button-layout="horizontal" class="max-[620px]:hidden" input-class="!w-10 !p-2 !text-center" /><span class="max-[620px]:col-start-1"><span class="block text-xs font-semibold text-[#596276]">{{ item.addedBy }}</span><time class="mt-1 block text-[.7rem] text-[#8a93a4]">{{ formatTimestamp(item.timestamp) }}</time></span><Button type="button" icon="pi pi-trash" severity="danger" text rounded size="small" aria-label="Remove item" @click="removeServiceItem(item.id)" /></div></div>
            </div>

            <div v-else-if="activeJobSection === 'attachments'">
              <label class="mb-5 flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#d6dbe6] bg-[#fafbfc] px-5 py-5 text-center hover:border-[#9ca3ed]"><input class="hidden" type="file" accept="image/*" multiple @change="handleAttachments"><span class="grid h-10 w-10 place-items-center rounded-full bg-[#eceeff] text-[#5962d8]"><i class="pi pi-camera" /></span><span class="text-left"><strong class="block text-sm">Upload technician photos</strong><small class="mt-1 block text-[#858e9f]">Images are stamped with technician and upload time.</small></span></label>
              <div class="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1"><article v-for="attachment in activeJob.attachments" :key="attachment.id" class="overflow-hidden rounded-xl border border-[#e1e5ec] bg-white"><div class="relative"><img :src="attachment.url" :alt="attachment.name" class="h-44 w-full object-cover"><span :class="['absolute top-3 left-3 rounded-full px-2.5 py-1 text-[.68rem] font-extrabold tracking-wide', attachment.phase === 'Before' ? 'bg-[#fff2d8] text-[#9b620d]' : 'bg-[#ddf7f0] text-[#13745f]']">{{ attachment.phase }}</span></div><div class="p-4"><strong class="block overflow-hidden text-sm text-ellipsis whitespace-nowrap">{{ attachment.name }}</strong><div class="mt-2 flex items-center justify-between gap-3 text-xs text-[#7f8899]"><span><i class="pi pi-user mr-1" />{{ attachment.technician }}</span><time>{{ formatTimestamp(attachment.timestamp) }}</time></div></div></article></div>
            </div>

            <div v-else>
              <div class="relative ml-5 border-l-2 border-[#e0e4eb] pl-7"><article v-for="change in activeJob.statusChanges" :key="change.id" class="relative mb-6 last:mb-0"><span class="absolute top-0 -left-[2.34rem] grid h-5 w-5 place-items-center rounded-full border-4 border-white bg-[#6972ea] shadow-sm" /><div class="rounded-xl border border-[#e2e6ed] bg-white p-4"><div class="flex flex-wrap items-center gap-2"><span v-if="change.from" :class="['rounded-full px-2.5 py-1 text-[.7rem] font-bold', statusClass(change.from)]">{{ change.from }}</span><i v-if="change.from" class="pi pi-arrow-right text-[.65rem] text-[#9aa2af]" /><span :class="['rounded-full px-2.5 py-1 text-[.7rem] font-bold', statusClass(change.to)]">{{ change.to }}</span></div><div class="mt-3 flex flex-wrap items-center justify-between gap-2"><span class="text-xs font-semibold text-[#596276]">Changed by {{ change.user }}</span><time class="text-xs text-[#8a93a4]">{{ formatTimestamp(change.timestamp) }}</time></div></div></article></div>
            </div>
          </section>

          <div class="mt-8 flex items-center justify-end gap-3 border-t border-[#e8ebf1] pt-5"><span v-if="saved" class="mr-auto text-xs font-bold text-[#138c74]"><i class="pi pi-check-circle mr-1" /> Saved</span><Button type="button" label="Cancel" severity="secondary" text @click="drawerOpen = false" /><Button type="submit" icon="pi pi-check" label="Save work order" :disabled="!editing.property.trim()" /></div>
        </form>
      </template>
    </Drawer>
  </div>
</template>
