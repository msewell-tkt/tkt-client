<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { JOB_STATUSES } from '../constants/jobStatus'
import { propertyService, type Property, type ServiceItem } from '../services/PropertyService'
import { workOrderService, type NewJob, type WorkOrderDetail, type WorkOrderJobDetail, type WorkOrderSummary } from '../services/WorkOrderService'
import { formatDate, formatTimestamp, money, statusClass } from '../utils/workOrderFormat'

/**
 * Slide-out editor for a work order and its jobs. With no `orderId` it creates a new work order
 * (new jobs land in the scheduler's unscheduled queue); with one it loads, edits and adds jobs to it.
 */
const props = defineProps<{ orderId?: string | null }>()
const visible = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ saved: [detail: WorkOrderDetail] }>()

type WorkOrderStatus = string
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
  /** The API id once saved, else a local `new-…` id. */
  id: string
  /** False for a job added in the drawer that hasn't been saved yet. */
  saved: boolean
  serviceItemId: string
  num: string
  /** The service item's name. */
  name: string
  status: WorkOrderStatus
  /** ISO instant, or empty while unscheduled. */
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
  id: string
  /** Display number (`WO #`); empty for an order not yet saved. */
  num: string
  propertyId: string
  property: string
  address: string
  unit: string
  occupied: boolean
  /** `YYYY-MM-DD`, or empty. */
  moveIn: string
  moveOut: string
  /** Work order status from the API (Open, Complete, Canceled, Archive), or a job status for a local draft. */
  status: string
  scheduledDate: string
  assignedTo: string
  dispatched: boolean
  reportedBy: string
  reportedById: string | null
  /** ISO instant. */
  created: string
  jobCount: number
  openJobCount: number
  jobs: WorkOrderJob[]
}

const properties = ref<Property[]>([])
const orderStatusOptions = ref<string[]>([])
const editing = ref<WorkOrder | null>(null)
const activeJobId = ref<string | 'overview'>('overview')
const activeJobSection = ref<JobSection>('details')
const saved = ref(false)
const saving = ref(false)
const detailLoading = ref(false)
const saveError = ref('')
const serviceItemsByProperty = ref<Record<string, ServiceItem[]>>({})
const noteText = ref('')
const selectedServiceItem = ref('')
const currentUser = 'Barbara Smrecak'
let lookupsLoaded = false
let savedTimer: number | undefined

const jobStatuses: WorkOrderStatus[] = JOB_STATUSES
const serviceItemOptions = ['Touch-up paint · 1 gallon', 'Primer · 1 gallon', 'Drywall patch kit', 'HVAC filter · 20×20', 'Door stop', 'Smoke detector battery', 'Carpet transition strip', 'Cleaning supplies']
const jobSections: Array<{ value: JobSection; label: string; icon: string }> = [
  { value: 'details', label: 'Details', icon: 'pi-sliders-h' },
  { value: 'notes', label: 'Notes', icon: 'pi-comment' },
  { value: 'items', label: 'Additional items', icon: 'pi-shopping-cart' },
  { value: 'attachments', label: 'Attachments', icon: 'pi-images' },
  { value: 'history', label: 'Status history', icon: 'pi-history' },
]

const isNew = (id: string) => id.startsWith('new-')

function blankJob(): WorkOrderJob {
  return { id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, saved: false, serviceItemId: '', num: '', name: 'New job', status: 'New', scheduledDate: '', assignedTo: 'Unassigned', po: '', cost: 0, listPrice: 0, dispatched: false, alert: false, techUpdated: false, description: '', notes: [], items: [], attachments: [], statusChanges: [] }
}

function fromJob(job: WorkOrderJobDetail): WorkOrderJob {
  return {
    ...blankJob(),
    id: job.id,
    saved: true,
    serviceItemId: job.serviceItem?.id ?? '',
    num: job.num ?? '',
    name: job.serviceItem?.name ?? 'Job',
    status: job.status ?? 'New',
    scheduledDate: job.scheduled ?? '',
    assignedTo: [job.assignedTo?.firstName, job.assignedTo?.lastName].filter(Boolean).join(' ') || 'Unassigned',
    po: job.purchaseOrder ?? '',
    cost: job.cost ?? 0,
    listPrice: job.list ?? 0,
    dispatched: job.dispatched,
    alert: job.alert,
    techUpdated: job.techUpdated,
  }
}

function makeOrder(id: string, jobs: WorkOrderJob[]): WorkOrder {
  return { id, num: '', propertyId: '', property: '', address: '', unit: '', occupied: false, moveIn: '', moveOut: '', status: 'Open', scheduledDate: '', assignedTo: 'Unassigned', dispatched: false, reportedBy: '', reportedById: null, created: '', jobCount: jobs.length, openJobCount: jobs.length, jobs }
}

function fromSummary(order: WorkOrderSummary, jobs: WorkOrderJob[] = []): WorkOrder {
  return {
    ...makeOrder(order.id, jobs),
    num: order.num ?? '',
    propertyId: order.property?.id ?? '',
    property: order.property?.name ?? 'Unknown property',
    address: [order.property?.address1, order.property?.city, order.property?.state].filter(Boolean).join(', '),
    unit: order.unit ?? '',
    occupied: order.occupied ?? false,
    moveIn: order.moveIn ?? '',
    moveOut: order.moveOut ?? '',
    status: order.status ?? '',
    reportedBy: [order.reportedBy?.firstName, order.reportedBy?.lastName].filter(Boolean).join(' '),
    reportedById: order.reportedBy?.id ?? null,
    created: order.created ?? '',
    jobCount: order.jobCount ?? 0,
    openJobCount: order.openJobCount ?? 0,
  }
}

function fromDetail(detail: WorkOrderDetail): WorkOrder {
  return fromSummary(detail.workOrder, detail.jobs.map(fromJob))
}

const activeJob = computed(() => editing.value?.jobs.find((job) => job.id === activeJobId.value) ?? null)
const jobTypeOptions = computed(() => (serviceItemsByProperty.value[editing.value?.propertyId ?? ''] ?? []).filter((item) => !item.extra))
const jobTypePlaceholder = computed(() => {
  const propertyId = editing.value?.propertyId
  if (!propertyId) return 'Choose a property first'
  if (!serviceItemsByProperty.value[propertyId]) return 'Loading job types…'
  return jobTypeOptions.value.length ? 'Choose a job type' : 'No job types for this property'
})
const selectableProperties = computed(() => properties.value.filter((item) => !item.archived))

function loadLookups() {
  if (lookupsLoaded) return
  lookupsLoaded = true
  propertyService.list().then((view) => { properties.value = view.properties }).catch(() => { lookupsLoaded = false })
  workOrderService.statuses().then((values) => { orderStatusOptions.value = values }).catch(() => { lookupsLoaded = false })
}

function loadServiceItems(propertyId: string) {
  if (!propertyId || serviceItemsByProperty.value[propertyId]) return
  propertyService.serviceItems(propertyId)
    .then((items) => { serviceItemsByProperty.value[propertyId] = items })
    .catch((reason) => { saveError.value = reason instanceof Error ? reason.message : 'Couldn’t load service items.' })
}

function showOrder(order: WorkOrder, jobId?: string) {
  editing.value = order
  activeJobId.value = jobId && order.jobs.some((job) => job.id === jobId) ? jobId : order.jobs[0]?.id ?? 'overview'
  activeJobSection.value = 'details'
  loadServiceItems(order.propertyId)
}

/** Starts a blank draft, or loads `orderId` from the API. */
async function begin() {
  loadLookups()
  saved.value = false
  saveError.value = ''
  noteText.value = ''
  selectedServiceItem.value = ''
  const id = props.orderId
  if (!id) {
    detailLoading.value = false
    showOrder(makeOrder(`new-${Date.now()}`, [blankJob()]))
    activeJobId.value = 'overview'
    return
  }
  editing.value = null
  detailLoading.value = true
  try {
    const detail = await workOrderService.detail(id)
    if (visible.value && props.orderId === id) showOrder(fromDetail(detail))
  } catch (reason) {
    if (props.orderId === id) saveError.value = reason instanceof Error ? reason.message : 'Couldn’t load the work order.'
  } finally {
    if (props.orderId === id) detailLoading.value = false
  }
}

watch(() => visible.value, (open) => { if (open) void begin() }, { immediate: true })

function addJob() {
  if (!editing.value) return
  const job = blankJob()
  editing.value.jobs.push(job)
  activeJobId.value = job.id
  activeJobSection.value = 'details'
}

function pickProperty(propertyId: string) {
  if (!editing.value) return

  const property = properties.value.find((item) => item.id === propertyId)
  editing.value.propertyId = propertyId
  editing.value.property = property?.name ?? ''
  editing.value.address = [property?.address1, property?.city, property?.state].filter(Boolean).join(', ')
  editing.value.jobs.forEach((job) => { job.serviceItemId = ''; job.name = 'New job' })
  loadServiceItems(propertyId)
}

function pickServiceItem(job: WorkOrderJob, serviceItemId: string) {
  const item = jobTypeOptions.value.find((option) => option.id === serviceItemId)
  if (!item) return
  job.serviceItemId = serviceItemId
  job.name = item.name
  job.cost = item.cost ?? 0
  job.listPrice = item.list ?? 0
}

function selectJob(id: string | 'overview') {
  activeJobId.value = id
  activeJobSection.value = 'details'
  noteText.value = ''
  selectedServiceItem.value = ''
}

/** Only jobs that haven't been saved can be removed; the API has no way to delete one. */
function removeJob() {
  if (!editing.value || !activeJob.value || activeJob.value.saved || editing.value.jobs.length === 1) return
  const index = editing.value.jobs.findIndex((job) => job.id === activeJob.value?.id)
  editing.value.jobs.splice(index, 1)
  activeJobId.value = editing.value.jobs[Math.max(0, index - 1)]?.id ?? 'overview'
}

function newJobBody(job: WorkOrderJob): NewJob {
  return { serviceItemId: job.serviceItemId, purchaseOrder: job.po.trim() || null, cost: job.cost ?? 0, list: job.listPrice ?? 0 }
}

async function saveOrder() {
  const order = editing.value
  if (!order || saving.value || detailLoading.value) return
  saveError.value = ''
  if (!order.propertyId) {
    activeJobId.value = 'overview'
    saveError.value = 'Choose a property.'
    return
  }
  const incomplete = order.jobs.find((job) => !job.serviceItemId)
  if (incomplete) {
    activeJobId.value = incomplete.id
    activeJobSection.value = 'details'
    saveError.value = 'Choose a job type for every job.'
    return
  }
  saving.value = true
  try {
    let id = order.id
    if (isNew(id)) {
      const created = await workOrderService.create({
        propertyId: order.propertyId,
        unit: order.unit.trim() || null,
        occupied: order.occupied,
        moveIn: order.moveIn || null,
        moveOut: order.moveOut || null,
        jobs: order.jobs.map(newJobBody),
      })
      id = created.workOrder.id
    } else {
      await workOrderService.update(id, {
        unit: order.unit.trim() || null,
        occupied: order.occupied,
        moveIn: order.moveIn || null,
        moveOut: order.moveOut || null,
        reportedBy: order.reportedById,
        status: order.status || undefined,
      })
      for (const job of order.jobs) {
        if (job.saved) {
          await workOrderService.updateJob(id, job.id, { status: job.status, purchaseOrder: job.po.trim() || null, cost: job.cost ?? 0, list: job.listPrice ?? 0, dispatched: job.dispatched, alert: job.alert })
        } else {
          // mark it saved straight away so a retry after a later failure doesn't add it twice
          const added = await workOrderService.addJob(id, newJobBody(job))
          if (activeJobId.value === job.id) activeJobId.value = added.id
          job.id = added.id
          job.saved = true
        }
      }
    }
    const detail = await workOrderService.detail(id)
    const keepJob = activeJobId.value
    showOrder(fromDetail(detail), keepJob)
    emit('saved', detail)
    saved.value = true
    window.clearTimeout(savedTimer)
    savedTimer = window.setTimeout(() => { saved.value = false }, 2200)
  } catch (reason) {
    saveError.value = reason instanceof Error ? reason.message : 'Unable to save the work order.'
  } finally {
    saving.value = false
  }
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
}</script>

<template>
  <Drawer v-model:visible="visible" position="right" class="!w-[min(980px,100vw)] [&_.p-drawer-content]:!p-0 [&_.p-drawer-header]:!hidden">
    <div v-if="!editing" class="grid min-h-64 place-items-center p-6">
      <ProgressSpinner v-if="detailLoading" stroke-width="4" class="!h-10 !w-10" aria-label="Loading work order" />
      <div v-else class="w-full"><Message severity="error" :closable="false">{{ saveError || 'Couldn’t load the work order.' }}</Message><Button type="button" label="Close" severity="secondary" text class="mt-3" @click="visible = false" /></div>
    </div>
        <template v-else>
          <div class="sticky top-0 z-5 border-b border-[#e4e8ef] bg-white">
            <div class="flex items-start justify-between gap-4 px-6 pt-6 pb-4 max-[540px]:px-4"><div><p class="mb-1 text-[.7rem] font-extrabold tracking-[.1em] text-[#6972ea] uppercase">Work order #{{ editing.num || 'new' }}</p><h2 class="m-0 text-2xl tracking-[-.04em]">{{ editing.property || 'New work order' }}</h2><p class="mt-1 mb-0 text-sm text-[#7d8697]">Unit {{ editing.unit || 'not set' }} · {{ editing.jobs.length }} job{{ editing.jobs.length === 1 ? '' : 's' }}</p></div><Button icon="pi pi-times" severity="secondary" text rounded aria-label="Close" @click="visible = false" /></div>
            <nav class="flex gap-1 overflow-x-auto px-6 max-[540px]:px-4" aria-label="Work order jobs"><button type="button" :class="['shrink-0 border-0 border-b-2 bg-transparent px-3 py-3 text-[.8rem] font-bold', activeJobId === 'overview' ? 'border-[#5962d8] text-[#5962d8]' : 'border-transparent text-[#7a8395]']" @click="selectJob('overview')"><i class="pi pi-info-circle mr-2" />Overview</button><button v-for="job in editing.jobs" :key="job.id" type="button" :class="['shrink-0 border-0 border-b-2 bg-transparent px-3 py-3 text-[.8rem] font-bold', activeJobId === job.id ? 'border-[#5962d8] text-[#5962d8]' : 'border-transparent text-[#7a8395]']" @click="selectJob(job.id)"><i class="pi pi-wrench mr-2" />{{ job.name }}</button><button type="button" class="shrink-0 border-0 border-b-2 border-transparent bg-transparent px-3 py-3 text-[.8rem] font-bold text-[#5962d8]" @click="addJob"><i class="pi pi-plus mr-1" /> Add job</button></nav>
          </div>
  
          <form class="p-6 max-[540px]:p-4" @submit.prevent="saveOrder">
            <section v-if="activeJobId === 'overview'" class="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 [&_label]:grid [&_label]:gap-2 [&_label]:text-[.77rem] [&_label]:font-bold [&_label]:text-[#4c566a] [&_.p-inputtext]:w-full">
              <label>Property<Select v-if="isNew(editing.id)" :model-value="editing.propertyId" :options="selectableProperties" option-label="name" option-value="id" placeholder="Choose a property" filter @update:model-value="pickProperty" /><InputText v-else :model-value="editing.property" disabled /></label><label>Unit<InputText v-model="editing.unit" placeholder="Unit or location" /></label><label>Move in<InputText v-model="editing.moveIn" type="date" /></label><label>Move out<InputText v-model="editing.moveOut" type="date" /></label><label v-if="!isNew(editing.id)" class="col-span-2 max-[620px]:col-span-1">Status<Select v-model="editing.status" :options="orderStatusOptions" /></label>
              <label class="col-span-2 flex !flex-row items-center gap-3 rounded-xl border border-[#e2e6ed] p-4 max-[620px]:col-span-1"><Checkbox v-model="editing.occupied" binary /><span><strong class="block text-[.84rem]">Occupied unit</strong><small class="mt-1 block font-normal text-[#858e9f]">Notify the technician before entry.</small></span></label>
              <div class="col-span-2 mt-2 max-[620px]:col-span-1"><h3 class="mb-3 text-base">Jobs in this order</h3><div class="grid gap-2"><button v-for="job in editing.jobs" :key="job.id" type="button" class="flex items-center justify-between rounded-xl border border-[#e2e6ed] bg-white px-4 py-3 text-left text-inherit hover:border-[#b7bcef] hover:bg-[#fafaff]" @click="selectJob(job.id)"><span><strong class="block text-sm">{{ job.name }}</strong><small class="mt-1 block text-[#858e9f]">{{ job.assignedTo }} · {{ formatDate(job.scheduledDate) }}</small></span><span :class="['rounded-full px-2.5 py-1 text-[.7rem] font-bold', statusClass(job.status)]">{{ job.status }}</span></button></div></div>
            </section>
  
            <section v-else-if="activeJob">
              <div class="mb-5 flex items-start justify-between gap-4"><div><h3 class="m-0 text-xl tracking-[-.03em]">{{ activeJob.name }}</h3><p class="mt-1 mb-0 text-sm text-[#7d8697]">{{ activeJob.assignedTo }} · {{ formatDate(activeJob.scheduledDate) }}</p></div><Button type="button" icon="pi pi-trash" label="Remove job" severity="danger" text size="small" :disabled="activeJob.saved || editing.jobs.length === 1" @click="removeJob" /></div>
  
              <nav class="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-[#f3f5f8] p-1" aria-label="Job sections">
                <button v-for="section in jobSections" :key="section.value" type="button" :class="['flex shrink-0 items-center gap-2 rounded-lg border-0 px-3 py-2.5 text-[.76rem] font-bold', activeJobSection === section.value ? 'bg-white text-[#5962d8] shadow-sm' : 'bg-transparent text-[#747e91] hover:text-[#3f485b]']" @click="activeJobSection = section.value"><i :class="['pi', section.icon]" />{{ section.label }}<span v-if="section.value === 'notes'" class="rounded-full bg-[#e9ebf2] px-1.5 py-0.5 text-[.62rem] text-[#626b7d]">{{ activeJob.notes.length }}</span><span v-else-if="section.value === 'items'" class="rounded-full bg-[#e9ebf2] px-1.5 py-0.5 text-[.62rem] text-[#626b7d]">{{ activeJob.items.length }}</span><span v-else-if="section.value === 'attachments'" class="rounded-full bg-[#e9ebf2] px-1.5 py-0.5 text-[.62rem] text-[#626b7d]">{{ activeJob.attachments.length }}</span></button>
              </nav>
  
              <Message v-if="activeJobSection !== 'details'" severity="warn" :closable="false" class="mb-5">Notes, additional items, attachments and history aren’t connected to the API yet, so changes here are not saved.</Message>
  
              <div v-if="activeJobSection === 'details'" class="grid grid-cols-[1fr_260px] gap-6 max-[760px]:grid-cols-1">
                <div class="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1 [&_label]:grid [&_label]:gap-2 [&_label]:text-[.77rem] [&_label]:font-bold [&_label]:text-[#4c566a] [&_.p-inputtext]:w-full [&_.p-select]:w-full [&_.p-inputnumber]:w-full">
                  <label class="col-span-2 max-[560px]:col-span-1">Job type<Select :model-value="activeJob.serviceItemId" :options="jobTypeOptions" option-label="name" option-value="id" filter :placeholder="jobTypePlaceholder" :disabled="activeJob.saved || !editing.propertyId" @update:model-value="pickServiceItem(activeJob, $event)" /></label><label>Status<Select v-model="activeJob.status" :options="jobStatuses" :disabled="!activeJob.saved" /></label><label>PO number<InputText v-model="activeJob.po" /></label><label>Scheduled<InputText :model-value="activeJob.scheduledDate ? formatDate(activeJob.scheduledDate) : 'Unscheduled'" disabled /></label><label>Assigned to<InputText :model-value="activeJob.assignedTo" disabled /></label><label>Cost<InputNumber v-model="activeJob.cost" mode="currency" currency="USD" locale="en-US" :min="0" /></label><label>List price<InputNumber v-model="activeJob.listPrice" mode="currency" currency="USD" locale="en-US" :min="0" /></label><small class="col-span-2 font-normal text-[#858e9f] max-[560px]:col-span-1">Schedule and assign jobs in the Resource Scheduler.</small>
                </div>
                <aside class="self-start rounded-2xl border border-[#e2e6ed] bg-[#fafbfc] p-5"><p class="mt-0 mb-4 text-[.7rem] font-extrabold tracking-[.1em] text-[#7a8395] uppercase">Dispatch attributes</p><label class="mb-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(20,30,55,.06)]"><span><strong class="block text-sm">Dispatched</strong><small class="text-[#858e9f]">Sent to assignee</small></span><Checkbox v-model="activeJob.dispatched" binary /></label><label class="mb-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(20,30,55,.06)]"><span><strong class="block text-sm">Alert</strong><small class="text-[#858e9f]">Needs attention</small></span><Checkbox v-model="activeJob.alert" binary /></label><label class="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(20,30,55,.06)]"><span><strong class="block text-sm">Tech updated</strong><small class="text-[#858e9f]">Changes reviewed</small></span><Checkbox v-model="activeJob.techUpdated" binary disabled /></label><div class="mt-5 border-t border-[#e2e5eb] pt-4"><div class="mb-2 flex justify-between text-sm text-[#727c8f]"><span>Cost</span><strong class="text-[#30394d]">{{ money(activeJob.cost) }}</strong></div><div class="flex justify-between text-sm text-[#727c8f]"><span>List price</span><strong class="text-[#30394d]">{{ money(activeJob.listPrice) }}</strong></div></div></aside>
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
  
            <Message v-if="saveError" severity="error" :closable="false" class="mt-6">{{ saveError }}</Message>
            <div class="mt-8 flex items-center justify-end gap-3 border-t border-[#e8ebf1] pt-5"><span v-if="saved" class="mr-auto text-xs font-bold text-[#138c74]"><i class="pi pi-check-circle mr-1" /> Saved</span><Button type="button" label="Cancel" severity="secondary" text @click="visible = false" /><Button type="submit" icon="pi pi-check" :label="isNew(editing.id) ? 'Create work order' : 'Save work order'" :loading="saving" :disabled="detailLoading || !editing.propertyId" /></div>
          </form>
        </template>
  </Drawer>
</template>
