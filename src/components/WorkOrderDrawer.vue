<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { JOB_STATUSES, StatusEnum } from '../constants/jobStatus'
import { propertyService, type Property, type ServiceItem } from '../services/PropertyService'
import { userName, type User } from '../services/User'
import { workOrderService, type JobAttachment, type JobExtra, type JobNote, type JobStatusEntry, type NewJob, type WorkOrder, type WorkOrderJob, type WorkOrderProperty } from '../services/WorkOrderService'
import { formatDate, formatTimestamp, money, statusClass } from '../utils/workOrderFormat'

/**
 * Slide-out editor for a work order and its jobs. With no `orderId` it creates a new work order
 * (new jobs land in the scheduler's unscheduled queue); with one it loads, edits and adds jobs to it.
 */
const props = defineProps<{ orderId?: string | null }>()
const visible = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ saved: [order: WorkOrder]; deleted: [id: string] }>()

type WorkOrderStatus = string
type JobSection = 'details' | 'notes' | 'items' | 'attachments' | 'history'

/** A job as edited in the drawer: the API's job with empty strings for blanks. */
interface JobDraft {
  /** The job as the API last returned it; null until saved. Updates send it back with the edits applied. */
  source: WorkOrderJob | null
  /** The API id once saved, else a local `new-…` id. */
  id: string
  /** False for a job added in the drawer that hasn't been saved yet. */
  saved: boolean
  serviceItem: WorkOrderJob['serviceItem']
  num: string
  status: WorkOrderStatus
  /** Null while unscheduled. */
  scheduled: Date | null
  assignedTo: User | null
  purchaseOrder: string
  cost: number
  list: number
  dispatched: boolean
  alert: boolean
  techUpdated: boolean
  description: string
  extras: JobExtra[]
  notes: JobNote[]
  attachments: JobAttachment[]
  statuses: JobStatusEntry[]
}

/** A work order as edited in the drawer. */
interface OrderDraft {
  /** The work order as the API last returned it; null until saved. Updates send it back with the edits applied. */
  source: WorkOrder | null
  id: string
  /** Display number (`WO #`); empty for an order not yet saved. */
  num: string
  property: WorkOrderProperty | null
  unit: string
  occupied: boolean
  /** `YYYY-MM-DD`, or empty. */
  moveIn: string
  moveOut: string
  /** Work order status from the API (Open, Complete, Canceled, Archive), or a job status for a local draft. */
  status: string
  reportedBy: User | null
  /** ISO instant. */
  created: string
  jobs: JobDraft[]
}

const properties = ref<Property[]>([])
const orderStatusOptions = ref<string[]>([])
const editing = ref<OrderDraft | null>(null)
const activeJobId = ref<string | 'overview'>('overview')
const activeJobSection = ref<JobSection>('details')
const saved = ref(false)
const saving = ref(false)
const deleting = ref(false)
const deleteOpen = ref(false)
const deleteJobOpen = ref(false)
const detailLoading = ref(false)
const saveError = ref('')
const serviceItemsByProperty = ref<Record<string, ServiceItem[]>>({})
const noteText = ref('')
const entryBusy = ref(false)
const editingNoteId = ref<string | null>(null)
const noteDraft = ref('')
const editingExtraId = ref<string | null>(null)
const extraDraft = ref({ name: '', list: 0, cost: 0 })
const selectedServiceItem = ref('')

let lookupsLoaded = false
let savedTimer: number | undefined

const jobStatuses: WorkOrderStatus[] = JOB_STATUSES
const jobSections: Array<{ value: JobSection; label: string; icon: string }> = [
  { value: 'details', label: 'Details', icon: 'pi-sliders-h' },
  { value: 'notes', label: 'Notes', icon: 'pi-comment' },
  { value: 'items', label: 'Additional items', icon: 'pi-shopping-cart' },
  { value: 'attachments', label: 'Attachments', icon: 'pi-images' },
  { value: 'history', label: 'Status history', icon: 'pi-history' },
]

const isNew = (id: string) => id.startsWith('new-')

const assignee = (job: JobDraft) => userName(job.assignedTo) || 'Unassigned'
const jobName = (job: JobDraft) => job.serviceItem?.name ?? (job.saved ? 'Job' : 'New job')

/** The status's label, whether the API sent the enum's name (`GO_BACK`) or its label (`Go Back`). */
function statusLabel(status: string | null) {
  return Object.values(StatusEnum).find((label) => label === status) ?? StatusEnum[status as keyof typeof StatusEnum] ?? status ?? ''
}

/** Each status entry with the status before it, newest first. */
function statusChanges(job: JobDraft) {
  const entries = [...job.statuses].sort((a, b) => (a.created ?? '').localeCompare(b.created ?? ''))
  return entries.map((entry, index) => ({
    id: entry.id,
    from: index > 0 ? statusLabel(entries[index - 1].status) : null,
    to: statusLabel(entry.status),
    user: entry.user,
    created: entry.created,
  })).reverse()
}

/** The attachment's image source: its data when that is a URL, else the data as base64 of its type. */
function attachmentSrc(attachment: JobAttachment) {
  return /^(https?:|data:|blob:)/.test(attachment.data) ? attachment.data : `data:${attachment.type};base64,${attachment.data}`
}

const isImage = (attachment: JobAttachment) => attachment.type.startsWith('image/')

function blankJob(): JobDraft {
  return { source: null, id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, saved: false, serviceItem: null, num: '', status: 'New', scheduled: null, assignedTo: null, purchaseOrder: '', cost: 0, list: 0, dispatched: false, alert: false, techUpdated: false, description: '', extras: [], notes: [], attachments: [], statuses: [] }
}

function fromJob(job: WorkOrderJob): JobDraft {
  return {
    ...blankJob(),
    source: job,
    id: job.id,
    saved: true,
    serviceItem: job.serviceItem,
    num: job.num ?? '',
    status: job.status ?? 'New',
    scheduled: job.scheduled,
    assignedTo: job.assignedTo,
    purchaseOrder: job.purchaseOrder ?? '',
    cost: job.cost ?? 0,
    list: job.list ?? 0,
    dispatched: job.dispatched,
    alert: job.alert,
    techUpdated: job.techUpdated,
    extras: job.extras,
    notes: job.notes,
    attachments: job.attachments,
    statuses: job.statuses,
  }
}

function makeOrder(id: string, jobs: JobDraft[]): OrderDraft {
  return { source: null, id, num: '', property: null, unit: '', occupied: false, moveIn: '', moveOut: '', status: 'Open', reportedBy: null, created: '', jobs }
}

function fromOrder(order: WorkOrder): OrderDraft {
  return {
    ...makeOrder(order.id, order.jobs.map(fromJob)),
    source: order,
    num: order.num ?? '',
    property: order.property,
    unit: order.unit ?? '',
    occupied: order.occupied ?? false,
    moveIn: order.moveIn ?? '',
    moveOut: order.moveOut ?? '',
    status: order.status ?? '',
    reportedBy: order.reportedBy,
    created: order.created ?? '',
  }
}

const activeJob = computed(() => editing.value?.jobs.find((job) => job.id === activeJobId.value) ?? null)
const extraOptions = computed(() => (serviceItemsByProperty.value[editing.value?.property?.id ?? ''] ?? []).filter((item) => item.extra))
const jobTypeOptions = computed(() => (serviceItemsByProperty.value[editing.value?.property?.id ?? ''] ?? []).filter((item) => !item.extra))
const jobTypePlaceholder = computed(() => {
  const propertyId = editing.value?.property?.id
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
  propertyService.availableServiceItems(propertyId)
    .then((items) => { serviceItemsByProperty.value[propertyId] = items })
    .catch((reason) => { saveError.value = reason instanceof Error ? reason.message : 'Couldn’t load service items.' })
}

function showOrder(order: OrderDraft, jobId?: string) {
  editing.value = order
  activeJobId.value = jobId && order.jobs.some((job) => job.id === jobId) ? jobId : order.jobs[0]?.id ?? 'overview'
  activeJobSection.value = 'details'
  loadServiceItems(order.property?.id ?? '')
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
    if (visible.value && props.orderId === id) showOrder(fromOrder(detail))
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
  editing.value.property = { id: propertyId, name: property?.name ?? null, address1: property?.address1, city: property?.city, state: property?.state }
  editing.value.jobs.forEach((job) => { job.serviceItem = null })
  loadServiceItems(propertyId)
}

function pickServiceItem(job: JobDraft, serviceItemId: string) {
  const item = jobTypeOptions.value.find((option) => option.id === serviceItemId)
  if (!item) return
  job.serviceItem = { id: serviceItemId, name: item.name }
  job.cost = item.cost ?? 0
  job.list = item.list ?? 0
}

function selectJob(id: string | 'overview') {
  activeJobId.value = id
  activeJobSection.value = 'details'
  noteText.value = ''
  selectedServiceItem.value = ''
}

function dropJob(jobId: string) {
  if (!editing.value) return
  const index = editing.value.jobs.findIndex((job) => job.id === jobId)
  if (index < 0) return
  editing.value.jobs.splice(index, 1)
  activeJobId.value = editing.value.jobs[Math.max(0, index - 1)]?.id ?? 'overview'
}

/** An unsaved job is just dropped; a saved one is deleted through the API once confirmed. */
function removeJob() {
  if (!editing.value || !activeJob.value || editing.value.jobs.length === 1) return
  if (activeJob.value.saved) deleteJobOpen.value = true
  else dropJob(activeJob.value.id)
}

async function deleteJob() {
  const order = editing.value
  const job = activeJob.value
  if (!order || !job || !job.saved || deleting.value) return
  deleting.value = true
  saveError.value = ''
  try {
    await workOrderService.removeJob(order.id, job.id)
    dropJob(job.id)
    // let the list or scheduler behind the drawer pick up the change; the job is already gone either way
    workOrderService.detail(order.id).then((detail) => emit('saved', detail)).catch(() => {})
  } catch (reason) {
    saveError.value = reason instanceof Error ? reason.message : 'Unable to delete the job.'
  } finally {
    deleteJobOpen.value = false
    deleting.value = false
  }
}

function newJobBody(job: JobDraft): NewJob {
  return { serviceItem: job.serviceItem, purchaseOrder: job.purchaseOrder.trim() || null, cost: job.cost ?? 0, list: job.list ?? 0 }
}

/** The whole work order with the drawer's edits applied. */
function orderBody(order: OrderDraft, source: WorkOrder): WorkOrder {
  return {
    ...source,
    unit: order.unit.trim() || null,
    occupied: order.occupied,
    moveIn: order.moveIn || null,
    moveOut: order.moveOut || null,
    reportedBy: order.reportedBy,
    status: order.status || source.status,
  }
}

/** The whole job with the drawer's edits applied. */
function jobBody(job: JobDraft, source: WorkOrderJob): WorkOrderJob {
  return {
    ...source,
    status: job.status,
    purchaseOrder: job.purchaseOrder.trim() || null,
    cost: job.cost ?? 0,
    list: job.list ?? 0,
    dispatched: job.dispatched,
    alert: job.alert,
    extras: job.extras,
    notes: job.notes,
    attachments: job.attachments,
    statuses: job.statuses,
  }
}

async function saveOrder() {
  const order = editing.value
  if (!order || saving.value || detailLoading.value) return
  saveError.value = ''
  const property = order.property
  if (!property?.id) {
    activeJobId.value = 'overview'
    saveError.value = 'Choose a property.'
    return
  }
  const incomplete = order.jobs.find((job) => !job.serviceItem)
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
        property: { id: property.id, name: property.name },
        unit: order.unit.trim() || null,
        occupied: order.occupied,
        moveIn: order.moveIn || null,
        moveOut: order.moveOut || null,
        jobs: order.jobs.map(newJobBody),
      })
      id = created.id
    } else {
      if (!order.source) throw new Error('Reload the work order and try again.')
      await workOrderService.update(orderBody(order, order.source))
      for (const job of order.jobs) {
        if (job.source) {
          await workOrderService.updateJob(id, jobBody(job, job.source))
        } else {
          // mark it saved straight away so a retry after a later failure doesn't add it twice
          const added = await workOrderService.addJob(id, newJobBody(job))
          if (activeJobId.value === job.id) activeJobId.value = added.id
          job.id = added.id
          job.source = added
          job.saved = true
        }
      }
    }
    const detail = await workOrderService.detail(id)
    const keepJob = activeJobId.value
    showOrder(fromOrder(detail), keepJob)
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

async function deleteOrder() {
  const order = editing.value
  if (!order || deleting.value || isNew(order.id)) return
  deleting.value = true
  saveError.value = ''
  try {
    await workOrderService.remove(order.id)
    deleteOpen.value = false
    visible.value = false
    emit('deleted', order.id)
  } catch (reason) {
    deleteOpen.value = false
    saveError.value = reason instanceof Error ? reason.message : 'Unable to delete the work order.'
  } finally {
    deleting.value = false
  }
}

/** Runs a change to the active saved job's notes, additional items or attachments, reporting any error. */
async function changeEntries(change: (orderId: string, job: JobDraft) => Promise<void>, fallback: string) {
  const order = editing.value
  const job = activeJob.value
  if (!order || !job?.saved || entryBusy.value) return
  entryBusy.value = true
  saveError.value = ''
  try {
    await change(order.id, job)
  } catch (reason) {
    saveError.value = reason instanceof Error ? reason.message : fallback
  } finally {
    entryBusy.value = false
  }
}

async function addNote() {
  const text = noteText.value.trim()
  if (!text) return
  await changeEntries(async (orderId, job) => {
    job.notes.unshift(await workOrderService.saveNote(orderId, job.id, { data: text, type: 'text' }))
    noteText.value = ''
  }, 'Unable to save the note.')
}

function startNoteEdit(note: JobNote) {
  editingNoteId.value = note.id
  noteDraft.value = note.data ?? ''
}

/** Saves the edited text; the whole note goes back so the update keeps its other fields. */
async function saveNoteEdit(note: JobNote) {
  const text = noteDraft.value.trim()
  if (!text) return
  await changeEntries(async (orderId, job) => {
    const updated = await workOrderService.saveNote(orderId, job.id, { ...note, data: text })
    job.notes = job.notes.map((item) => (item.id === updated.id ? updated : item))
    editingNoteId.value = null
  }, 'Unable to save the note.')
}

async function removeNote(id: string) {
  await changeEntries(async (orderId, job) => {
    await workOrderService.removeNote(orderId, job.id, id)
    job.notes = job.notes.filter((note) => note.id !== id)
  }, 'Unable to delete the note.')
}

async function addServiceItem() {
  const item = extraOptions.value.find((option) => option.id === selectedServiceItem.value)
  if (!item) return
  await changeEntries(async (orderId, job) => {
    job.extras.unshift(await workOrderService.saveExtra(orderId, job.id, { name: item.name, list: item.list, cost: item.cost }))
    selectedServiceItem.value = ''
  }, 'Unable to save the item.')
}

function startExtraEdit(extra: JobExtra) {
  editingExtraId.value = extra.id
  extraDraft.value = { name: extra.name, list: extra.list ?? 0, cost: extra.cost ?? 0 }
}

async function saveExtraEdit(extra: JobExtra) {
  const { name, list, cost } = extraDraft.value
  if (!name.trim()) return
  await changeEntries(async (orderId, job) => {
    const updated = await workOrderService.saveExtra(orderId, job.id, { ...extra, name: name.trim(), list, cost })
    job.extras = job.extras.map((item) => (item.id === updated.id ? updated : item))
    editingExtraId.value = null
  }, 'Unable to save the item.')
}

async function removeServiceItem(id: string) {
  await changeEntries(async (orderId, job) => {
    await workOrderService.removeExtra(orderId, job.id, id)
    job.extras = job.extras.filter((extra) => extra.id !== id)
  }, 'Unable to delete the item.')
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error(`Couldn’t read ${file.name}.`))
    reader.readAsDataURL(file)
  })
}

async function handleAttachments(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  await changeEntries(async (orderId, job) => {
    for (const file of files) {
      const saved = await workOrderService.saveAttachment(orderId, job.id, { data: await readAsDataUrl(file), type: file.type })
      job.attachments.unshift(saved)
    }
  }, 'Unable to save the attachment.')
}

/** Swaps an attachment's file for another one. */
async function replaceAttachment(attachment: JobAttachment, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  await changeEntries(async (orderId, job) => {
    const updated = await workOrderService.saveAttachment(orderId, job.id, { ...attachment, data: await readAsDataUrl(file), type: file.type })
    job.attachments = job.attachments.map((item) => (item.id === updated.id ? updated : item))
  }, 'Unable to save the attachment.')
}

async function removeAttachment(id: string) {
  await changeEntries(async (orderId, job) => {
    await workOrderService.removeAttachment(orderId, job.id, id)
    job.attachments = job.attachments.filter((attachment) => attachment.id !== id)
  }, 'Unable to delete the attachment.')
}
</script>

<template>
  <Drawer v-model:visible="visible" position="right" class="!w-[min(980px,100vw)] [&_.p-drawer-content]:!p-0 [&_.p-drawer-header]:!hidden">
    <div v-if="!editing" class="grid min-h-64 place-items-center p-6">
      <ProgressSpinner v-if="detailLoading" stroke-width="4" class="!h-10 !w-10" aria-label="Loading work order" />
      <div v-else class="w-full"><Message severity="error" :closable="false">{{ saveError || 'Couldn’t load the work order.' }}</Message><Button type="button" label="Close" severity="secondary" text class="mt-3" @click="visible = false" /></div>
    </div>
        <template v-else>
          <div class="sticky top-0 z-5 border-b border-[#e4e8ef] bg-white">
            <div class="flex items-start justify-between gap-4 px-6 pt-6 pb-4 max-[540px]:px-4"><div><p class="mb-1 text-[.7rem] font-extrabold tracking-[.1em] text-[#6972ea] uppercase">Work order #{{ editing.num || 'new' }}</p><h2 class="m-0 text-2xl tracking-[-.04em]">{{ editing.property?.name ?? (isNew(editing.id) ? 'New work order' : 'Unknown property') }}</h2><p class="mt-1 mb-0 text-sm text-[#7d8697]">Unit {{ editing.unit || 'not set' }} · {{ editing.jobs.length }} job{{ editing.jobs.length === 1 ? '' : 's' }}</p></div><Button icon="pi pi-times" severity="secondary" text rounded aria-label="Close" @click="visible = false" /></div>
            <nav class="flex gap-1 overflow-x-auto px-6 max-[540px]:px-4" aria-label="Work order jobs"><button type="button" :class="['shrink-0 border-0 border-b-2 bg-transparent px-3 py-3 text-[.8rem] font-bold', activeJobId === 'overview' ? 'border-[#5962d8] text-[#5962d8]' : 'border-transparent text-[#7a8395]']" @click="selectJob('overview')"><i class="pi pi-info-circle mr-2" />Overview</button><button v-for="job in editing.jobs" :key="job.id" type="button" :class="['shrink-0 border-0 border-b-2 bg-transparent px-3 py-3 text-[.8rem] font-bold', activeJobId === job.id ? 'border-[#5962d8] text-[#5962d8]' : 'border-transparent text-[#7a8395]']" @click="selectJob(job.id)"><i class="pi pi-wrench mr-2" />{{ jobName(job) }}</button><button type="button" class="shrink-0 border-0 border-b-2 border-transparent bg-transparent px-3 py-3 text-[.8rem] font-bold text-[#5962d8]" @click="addJob"><i class="pi pi-plus mr-1" /> Add job</button></nav>
          </div>
  
          <form class="p-6 max-[540px]:p-4" @submit.prevent="saveOrder">
            <section v-if="activeJobId === 'overview'" class="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1 [&_label]:grid [&_label]:gap-2 [&_label]:text-[.77rem] [&_label]:font-bold [&_label]:text-[#4c566a] [&_.p-inputtext]:w-full">
              <label>Property<Select v-if="isNew(editing.id)" :model-value="editing.property?.id" :options="selectableProperties" option-label="name" option-value="id" placeholder="Choose a property" filter @update:model-value="pickProperty" /><InputText v-else :model-value="editing.property?.name" disabled /></label><label>Unit<InputText v-model="editing.unit" placeholder="Unit or location" /></label><label>Move in<InputText v-model="editing.moveIn" type="date" /></label><label>Move out<InputText v-model="editing.moveOut" type="date" /></label><label v-if="!isNew(editing.id)" class="col-span-2 max-[620px]:col-span-1">Status<Select v-model="editing.status" :options="orderStatusOptions" /></label>
              <label class="col-span-2 flex !flex-row items-center gap-3 rounded-xl border border-[#e2e6ed] p-4 max-[620px]:col-span-1"><Checkbox v-model="editing.occupied" binary /><span><strong class="block text-[.84rem]">Occupied unit</strong><small class="mt-1 block font-normal text-[#858e9f]">Notify the technician before entry.</small></span></label>
              <div class="col-span-2 mt-2 max-[620px]:col-span-1"><h3 class="mb-3 text-base">Jobs in this order</h3><div class="grid gap-2"><button v-for="job in editing.jobs" :key="job.id" type="button" class="flex items-center justify-between rounded-xl border border-[#e2e6ed] bg-white px-4 py-3 text-left text-inherit hover:border-[#b7bcef] hover:bg-[#fafaff]" @click="selectJob(job.id)"><span><strong class="block text-sm">{{ jobName(job) }}</strong><small class="mt-1 block text-[#858e9f]">{{ assignee(job) }} · {{ formatDate(job.scheduled) }}</small></span><span :class="['rounded-full px-2.5 py-1 text-[.7rem] font-bold', statusClass(job.status)]">{{ job.status }}</span></button></div></div>
            </section>
  
            <section v-else-if="activeJob">
              <div class="mb-5 flex items-start justify-between gap-4"><div><h3 class="m-0 text-xl tracking-[-.03em]">{{ jobName(activeJob) }}</h3><p class="mt-1 mb-0 text-sm text-[#7d8697]">{{ assignee(activeJob) }} · {{ formatDate(activeJob.scheduled) }}</p></div><Button type="button" icon="pi pi-trash" label="Remove job" severity="danger" text size="small" :disabled="editing.jobs.length === 1" @click="removeJob" /></div>
  
              <nav class="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-[#f3f5f8] p-1" aria-label="Job sections">
                <button v-for="section in jobSections" :key="section.value" type="button" :class="['flex shrink-0 items-center gap-2 rounded-lg border-0 px-3 py-2.5 text-[.76rem] font-bold', activeJobSection === section.value ? 'bg-white text-[#5962d8] shadow-sm' : 'bg-transparent text-[#747e91] hover:text-[#3f485b]']" @click="activeJobSection = section.value"><i :class="['pi', section.icon]" />{{ section.label }}<span v-if="section.value === 'notes'" class="rounded-full bg-[#e9ebf2] px-1.5 py-0.5 text-[.62rem] text-[#626b7d]">{{ activeJob.notes.length }}</span><span v-else-if="section.value === 'items'" class="rounded-full bg-[#e9ebf2] px-1.5 py-0.5 text-[.62rem] text-[#626b7d]">{{ activeJob.extras.length }}</span><span v-else-if="section.value === 'attachments'" class="rounded-full bg-[#e9ebf2] px-1.5 py-0.5 text-[.62rem] text-[#626b7d]">{{ activeJob.attachments.length }}</span></button>
              </nav>
  
              <Message v-if="activeJobSection !== 'details' && !activeJob.saved" severity="info" :closable="false" class="mb-5">Save the work order to add notes, additional items and attachments to this job.</Message>
  
              <div v-if="activeJobSection === 'details'" class="grid grid-cols-[1fr_260px] gap-6 max-[760px]:grid-cols-1">
                <div class="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1 [&_label]:grid [&_label]:gap-2 [&_label]:text-[.77rem] [&_label]:font-bold [&_label]:text-[#4c566a] [&_.p-inputtext]:w-full [&_.p-select]:w-full [&_.p-inputnumber]:w-full">
                  <label class="col-span-2 max-[560px]:col-span-1">Job type<Select :model-value="activeJob.serviceItem?.id" :options="jobTypeOptions" option-label="name" option-value="id" filter :placeholder="jobTypePlaceholder" :disabled="activeJob.saved || !editing.property" @update:model-value="pickServiceItem(activeJob, $event)" /></label><label>Status<Select v-model="activeJob.status" :options="jobStatuses" :disabled="!activeJob.saved" /></label><label>PO number<InputText v-model="activeJob.purchaseOrder" /></label><label>Scheduled<InputText :model-value="activeJob.scheduled ? formatDate(activeJob.scheduled) : 'Unscheduled'" disabled /></label><label>Assigned to<InputText :model-value="assignee(activeJob)" disabled /></label><label>Cost<InputNumber v-model="activeJob.cost" mode="currency" currency="USD" locale="en-US" :min="0" /></label><label>List price<InputNumber v-model="activeJob.list" mode="currency" currency="USD" locale="en-US" :min="0" /></label><small class="col-span-2 font-normal text-[#858e9f] max-[560px]:col-span-1">Schedule and assign jobs in the Resource Scheduler.</small>
                </div>
                <aside class="self-start rounded-2xl border border-[#e2e6ed] bg-[#fafbfc] p-5"><p class="mt-0 mb-4 text-[.7rem] font-extrabold tracking-[.1em] text-[#7a8395] uppercase">Dispatch attributes</p><label class="mb-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(20,30,55,.06)]"><span><strong class="block text-sm">Dispatched</strong><small class="text-[#858e9f]">Sent to assignee</small></span><Checkbox v-model="activeJob.dispatched" binary /></label><label class="mb-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(20,30,55,.06)]"><span><strong class="block text-sm">Alert</strong><small class="text-[#858e9f]">Needs attention</small></span><Checkbox v-model="activeJob.alert" binary /></label><label class="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(20,30,55,.06)]"><span><strong class="block text-sm">Tech updated</strong><small class="text-[#858e9f]">Changes reviewed</small></span><Checkbox v-model="activeJob.techUpdated" binary disabled /></label><div class="mt-5 border-t border-[#e2e5eb] pt-4"><div class="mb-2 flex justify-between text-sm text-[#727c8f]"><span>Cost</span><strong class="text-[#30394d]">{{ money(activeJob.cost) }}</strong></div><div class="flex justify-between text-sm text-[#727c8f]"><span>List price</span><strong class="text-[#30394d]">{{ money(activeJob.list) }}</strong></div></div></aside>
              </div>
  
              <div v-else-if="activeJobSection === 'notes'">
                <div class="mb-5 rounded-2xl border border-[#e1e5ed] bg-[#fafbfc] p-4"><Textarea v-model="noteText" rows="3" class="w-full" :disabled="!activeJob.saved" placeholder="Add an update for the team…" /><div class="mt-3 flex items-center justify-between gap-3"><small class="text-[#858e9f]">Notes are saved straight away.</small><Button type="button" icon="pi pi-send" label="Add note" size="small" :disabled="!activeJob.saved || !noteText.trim()" :loading="entryBusy" @click="addNote" /></div></div>
                <div class="relative ml-4 border-l border-[#dfe3ea] pl-6"><article v-for="note in activeJob.notes" :key="note.id" class="relative mb-4 rounded-xl border border-[#e3e7ee] bg-white p-4 last:mb-0"><span class="absolute top-5 -left-[2.05rem] grid h-4 w-4 place-items-center rounded-full border-4 border-white bg-[#6972ea]" /><div class="mb-2 flex flex-wrap items-center justify-between gap-2"><strong class="text-sm">{{ userName(note.user) }}</strong><time class="text-xs text-[#8a93a4]">{{ formatTimestamp(note.created) }}</time></div><div v-if="editingNoteId === note.id"><Textarea v-model="noteDraft" rows="3" class="w-full" /><div class="mt-3 flex justify-end gap-2"><Button type="button" label="Cancel" severity="secondary" text size="small" @click="editingNoteId = null" /><Button type="button" icon="pi pi-check" label="Save" size="small" :disabled="!noteDraft.trim()" :loading="entryBusy" @click="saveNoteEdit(note)" /></div></div><template v-else><p class="m-0 text-sm leading-6 text-[#505a6e]">{{ note.data }}</p><div class="mt-2 flex justify-end"><Button type="button" icon="pi pi-pencil" text rounded size="small" aria-label="Edit note" :disabled="entryBusy" @click="startNoteEdit(note)" /><Button type="button" icon="pi pi-trash" severity="danger" text rounded size="small" aria-label="Delete note" :disabled="entryBusy" @click="removeNote(note.id)" /></div></template></article></div>
              </div>
  
              <div v-else-if="activeJobSection === 'items'">
                <div class="mb-5 flex gap-3 rounded-2xl border border-[#e1e5ed] bg-[#fafbfc] p-4 max-[560px]:flex-col"><Select v-model="selectedServiceItem" :options="extraOptions" option-label="name" option-value="id" class="min-w-0 flex-1" :disabled="!activeJob.saved" :placeholder="extraOptions.length ? 'Select a service item' : 'No additional items for this property'" filter /><Button type="button" icon="pi pi-plus" label="Add item" :disabled="!activeJob.saved || !selectedServiceItem" :loading="entryBusy" @click="addServiceItem" /></div>
                <div class="overflow-hidden rounded-xl border border-[#e2e6ed]"><div class="grid grid-cols-[1fr_80px_180px_44px] gap-3 border-b border-[#e7eaf0] bg-[#fafbfc] px-4 py-3 text-[.68rem] font-extrabold tracking-[.08em] text-[#80899a] uppercase max-[620px]:hidden"><span>Service item</span><span>List</span><span>Added by</span><span></span></div><template v-for="item in activeJob.extras" :key="item.id"><div v-if="editingExtraId === item.id" class="grid grid-cols-[1fr_130px_130px_auto] items-center gap-3 border-b border-[#edf0f4] bg-[#fafbfc] px-4 py-4 last:border-0 max-[620px]:grid-cols-2"><InputText v-model="extraDraft.name" aria-label="Item name" class="max-[620px]:col-span-2" /><InputNumber v-model="extraDraft.list" mode="currency" currency="USD" locale="en-US" :min="0" aria-label="List price" /><InputNumber v-model="extraDraft.cost" mode="currency" currency="USD" locale="en-US" :min="0" aria-label="Cost" /><span class="flex justify-end gap-2 max-[620px]:col-span-2"><Button type="button" label="Cancel" severity="secondary" text size="small" @click="editingExtraId = null" /><Button type="button" icon="pi pi-check" label="Save" size="small" :disabled="!extraDraft.name.trim()" :loading="entryBusy" @click="saveExtraEdit(item)" /></span></div><div v-else class="grid grid-cols-[1fr_80px_180px_44px] items-center gap-3 border-b border-[#edf0f4] px-4 py-4 last:border-0 max-[620px]:grid-cols-[1fr_auto]"><strong class="text-sm">{{ item.name }}</strong><span class="text-sm text-[#596276] max-[620px]:hidden">{{ money(item.list ?? 0) }}</span><span class="max-[620px]:col-start-1"><span class="block text-xs font-semibold text-[#596276]">{{ userName(item.user) }}</span><time class="mt-1 block text-[.7rem] text-[#8a93a4]">{{ formatTimestamp(item.created) }}</time></span><span class="flex"><Button type="button" icon="pi pi-pencil" text rounded size="small" aria-label="Edit item" :disabled="entryBusy" @click="startExtraEdit(item)" /><Button type="button" icon="pi pi-trash" severity="danger" text rounded size="small" aria-label="Remove item" :disabled="entryBusy" @click="removeServiceItem(item.id)" /></span></div></template></div>
              </div>
  
              <div v-else-if="activeJobSection === 'attachments'">
                <label class="mb-5 flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#d6dbe6] bg-[#fafbfc] px-5 py-5 text-center hover:border-[#9ca3ed]"><input class="hidden" type="file" accept="image/*" multiple :disabled="!activeJob.saved || entryBusy" @change="handleAttachments"><span class="grid h-10 w-10 place-items-center rounded-full bg-[#eceeff] text-[#5962d8]"><i class="pi pi-camera" /></span><span class="text-left"><strong class="block text-sm">Upload technician photos</strong><small class="mt-1 block text-[#858e9f]">Images are saved straight away.</small></span></label>
                <div class="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1"><article v-for="attachment in activeJob.attachments" :key="attachment.id" class="overflow-hidden rounded-xl border border-[#e1e5ec] bg-white"><div class="relative"><img v-if="isImage(attachment)" :src="attachmentSrc(attachment)" alt="Job attachment" class="h-44 w-full object-cover"><div v-else class="grid h-44 place-items-center bg-[#f3f5f8] text-[#8a93a4]"><i class="pi pi-file text-3xl" /></div></div><div class="p-4"><div class="flex items-center justify-between gap-3 text-xs text-[#7f8899]"><span><i class="pi pi-user mr-1" />{{ userName(attachment.user) }}</span><span class="flex items-center gap-1"><time>{{ formatTimestamp(attachment.created) }}</time><label :class="['inline-grid h-8 w-8 place-items-center rounded-full text-[#6972ea] hover:bg-[#eceeff]', entryBusy ? 'pointer-events-none opacity-50' : 'cursor-pointer']" title="Replace file" aria-label="Replace file"><i class="pi pi-pencil text-xs" /><input class="hidden" type="file" accept="image/*" :disabled="entryBusy" @change="replaceAttachment(attachment, $event)"></label><Button type="button" icon="pi pi-trash" severity="danger" text rounded size="small" aria-label="Delete attachment" :disabled="entryBusy" @click="removeAttachment(attachment.id)" /></span></div></div></article></div>
              </div>
  
              <div v-else>
                <div class="relative ml-5 border-l-2 border-[#e0e4eb] pl-7"><article v-for="change in statusChanges(activeJob)" :key="change.id" class="relative mb-6 last:mb-0"><span class="absolute top-0 -left-[2.34rem] grid h-5 w-5 place-items-center rounded-full border-4 border-white bg-[#6972ea] shadow-sm" /><div class="rounded-xl border border-[#e2e6ed] bg-white p-4"><div class="flex flex-wrap items-center gap-2"><span v-if="change.from" :class="['rounded-full px-2.5 py-1 text-[.7rem] font-bold', statusClass(change.from)]">{{ change.from }}</span><i v-if="change.from" class="pi pi-arrow-right text-[.65rem] text-[#9aa2af]" /><span :class="['rounded-full px-2.5 py-1 text-[.7rem] font-bold', statusClass(change.to)]">{{ change.to }}</span></div><div class="mt-3 flex flex-wrap items-center justify-between gap-2"><span class="text-xs font-semibold text-[#596276]">Changed by {{ userName(change.user) }}</span><time class="text-xs text-[#8a93a4]">{{ formatTimestamp(change.created) }}</time></div></div></article></div>
              </div>
            </section>
  
            <Message v-if="saveError" severity="error" :closable="false" class="mt-6">{{ saveError }}</Message>
            <div class="mt-8 flex items-center justify-end gap-3 border-t border-[#e8ebf1] pt-5"><span v-if="saved" class="mr-auto text-xs font-bold text-[#138c74]"><i class="pi pi-check-circle mr-1" /> Saved</span><Button v-if="!isNew(editing.id)" type="button" icon="pi pi-trash" label="Delete" severity="danger" text :disabled="saving || detailLoading" @click="deleteOpen = true" /><Button type="button" label="Cancel" severity="secondary" text @click="visible = false" /><Button type="submit" icon="pi pi-check" :label="isNew(editing.id) ? 'Create work order' : 'Save work order'" :loading="saving" :disabled="detailLoading || !editing.property" /></div>
          </form>
        </template>

    <Dialog v-model:visible="deleteJobOpen" modal header="Delete job?" :style="{ width: '28rem' }">
      <p class="mt-0 leading-6 text-[#667085]"><strong>{{ activeJob ? jobName(activeJob) : '' }}</strong> will be permanently deleted from this work order. This can’t be undone.</p>
      <template #footer><Button label="Cancel" severity="secondary" text :disabled="deleting" @click="deleteJobOpen = false" /><Button label="Delete job" severity="danger" :loading="deleting" @click="deleteJob" /></template>
    </Dialog>

    <Dialog v-model:visible="deleteOpen" modal header="Delete work order?" :style="{ width: '28rem' }">
      <p class="mt-0 leading-6 text-[#667085]">Work order #{{ editing?.num }} and its {{ editing?.jobs.length }} job{{ editing?.jobs.length === 1 ? '' : 's' }} will be permanently deleted. This can’t be undone.</p>
      <template #footer><Button label="Cancel" severity="secondary" text :disabled="deleting" @click="deleteOpen = false" /><Button label="Delete work order" severity="danger" :loading="deleting" @click="deleteOrder" /></template>
    </Dialog>
  </Drawer>
</template>
