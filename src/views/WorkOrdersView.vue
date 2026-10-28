<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Select from 'primevue/select'
import AppHeader from '../components/AppHeader.vue'
import WorkOrderDrawer from '../components/WorkOrderDrawer.vue'
import { propertyService, type Property } from '../services/PropertyService'
import { workOrderService, type WorkOrder } from '../services/WorkOrderService'
import { userName } from '../services/User'
import { formatDate, jobCount, openJobCount, statusClass } from '../utils/workOrderFormat'

const query = ref('')
const ALL_STATUSES = 'All'
const ALL_PROPERTIES = 'All properties'
const PAGE_SIZE = 50
const statusFilter = ref(ALL_STATUSES)
const propertyFilter = ref(ALL_PROPERTIES)
const loading = ref(false)
const loadError = ref('')
const total = ref(0)
const properties = ref<Property[]>([])
const statusOptions = ref<string[]>([ALL_STATUSES])
const drawerOpen = ref(false)
/** Work order shown in the drawer; null creates a new one. */
const editingId = ref<string | null>(null)
const workOrders = ref<WorkOrder[]>([])

let loadSeq = 0
let searchTimer: number | undefined

/** Fetches a page for the current filters; `append` adds the next page instead of replacing the list. */
async function loadOrders(append = false) {
  const seq = ++loadSeq
  loading.value = true
  loadError.value = ''
  try {
    const page = await workOrderService.list({
      q: query.value,
      propertyId: properties.value.find((item) => item.name === propertyFilter.value)?.id ?? undefined,
      status: statusFilter.value === ALL_STATUSES ? undefined : statusFilter.value,
      limit: PAGE_SIZE,
      offset: append ? workOrders.value.length : 0,
    })
    if (seq !== loadSeq) return
    workOrders.value = append ? [...workOrders.value, ...page.workOrders] : page.workOrders
    total.value = page.total
  } catch (reason) {
    if (seq !== loadSeq) return
    loadError.value = reason instanceof Error ? reason.message : 'Couldn’t load work orders.'
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

onMounted(() => {
  void loadOrders()
  workOrderService.statuses().then((values) => { statusOptions.value = [ALL_STATUSES, ...values] }).catch(() => {})
  propertyService.list().then((view) => { properties.value = view.properties }).catch(() => {})
})
watch([statusFilter, propertyFilter], () => void loadOrders())
watch(query, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => void loadOrders(), 300)
})


const propertyOptions = computed(() => [ALL_PROPERTIES, ...properties.value.map((item) => item.name).sort()])
const openJobs = computed(() => workOrders.value.reduce((sum, item) => sum + openJobCount(item), 0))
const closedJobs = computed(() => workOrders.value.reduce((sum, item) => sum + jobCount(item) - openJobCount(item), 0))

function openOrder(order: WorkOrder) {
  editingId.value = order.id
  drawerOpen.value = true
}

function addOrder() {
  editingId.value = null
  drawerOpen.value = true
}

/** Keeps the list current after the drawer saves: refresh the row, or reload when a new order isn't on the page. */
function onSaved(order: WorkOrder) {
  editingId.value = order.id
  const row = workOrders.value.findIndex((item) => item.id === order.id)
  if (row >= 0) workOrders.value[row] = order
  else void loadOrders()
}

function onDeleted(id: string) {
  editingId.value = null
  workOrders.value = workOrders.value.filter((item) => item.id !== id)
  total.value = Math.max(0, total.value - 1)
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
        <div v-for="stat in [{ icon: 'pi-briefcase', value: total, label: 'Work orders', color: 'bg-[#eceeff] text-[#5962d8]' }, { icon: 'pi-clock', value: openJobs, label: 'Open jobs', color: 'bg-[#fff2d8] text-[#b87814]' }, { icon: 'pi-check-circle', value: closedJobs, label: 'Closed jobs', color: 'bg-[#e2f7f1] text-[#138c74]' }]" :key="stat.label" class="flex items-center gap-4 rounded-2xl border border-[#e3e7ef] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(30,41,75,.035)]"><span :class="['grid h-10 w-10 place-items-center rounded-xl', stat.color]"><i :class="['pi', stat.icon]" /></span><div><strong class="block text-xl tracking-[-.03em]">{{ stat.value }}</strong><small class="text-[#7d8698]">{{ stat.label }}</small></div></div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-[#e2e6ef] bg-white shadow-[0_12px_35px_rgba(30,41,75,.045)]">
        <div class="flex items-center gap-3 border-b border-[#e8ebf1] px-5 py-4 max-[760px]:flex-col max-[760px]:items-stretch">
          <div class="relative min-w-0 flex-1"><i class="pi pi-search absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-[#8a93a5]" /><InputText v-model="query" class="w-full !pl-10" placeholder="Search order, unit, property, reporter…" /></div>
          <Select v-model="propertyFilter" :options="propertyOptions" class="w-60 max-[760px]:w-full" aria-label="Filter by property" />
          <Select v-model="statusFilter" :options="statusOptions" class="w-45 max-[760px]:w-full" aria-label="Filter by status" />
        </div>
        <div class="grid grid-cols-[minmax(200px,1.3fr)_140px_150px_140px_minmax(150px,1fr)_110px_36px] gap-4 border-b border-[#e8ebf1] bg-[#fafbfc] px-5 py-3 text-[.68rem] font-extrabold tracking-[.08em] text-[#80899a] uppercase max-[960px]:hidden"><span>Property</span><span>Created</span><span>Unit</span><span>Status</span><span>Reported by</span><span>Open jobs</span><span></span></div>
        <Message v-if="loadError" severity="error" :closable="false" class="m-4">{{ loadError }}</Message>
        <div v-if="loading && !workOrders.length" class="grid min-h-64 place-items-center" role="status" aria-label="Loading work orders"><ProgressSpinner stroke-width="4" class="!h-10 !w-10" /></div>
        <div v-else-if="workOrders.length">
          <button v-for="order in workOrders" :key="order.id" type="button" class="group grid w-full grid-cols-[minmax(200px,1.3fr)_140px_150px_140px_minmax(150px,1fr)_110px_36px] items-center gap-4 border-0 border-b border-[#edf0f4] bg-white px-5 py-4 text-left text-inherit last:border-b-0 hover:bg-[#fafbff] max-[960px]:grid-cols-[1fr_auto]" @click="openOrder(order)">
            <span class="min-w-0"><span class="block overflow-hidden text-[.9rem] font-bold text-ellipsis whitespace-nowrap text-[#293246]">{{ order.property?.name || 'Unknown property' }}</span><small class="mt-1 block text-[#8a93a4]">WO #{{ order.num || '—' }} · {{ jobCount(order) }} job{{ jobCount(order) === 1 ? '' : 's' }}</small></span>
            <span class="text-[.84rem] text-[#4e586d] max-[960px]:hidden">{{ order.created ? formatDate(order.created) : '—' }}</span><span class="text-[.84rem] font-semibold text-[#4e586d] max-[960px]:hidden">{{ order.unit }}</span>
            <span class="max-[960px]:row-start-2"><span :class="['inline-flex rounded-full px-2.5 py-1 text-[.72rem] font-bold', statusClass(order.status ?? '')]">{{ order.status }}</span></span>
            <span class="overflow-hidden text-[.84rem] text-ellipsis whitespace-nowrap text-[#4e586d] max-[960px]:hidden"><i class="pi pi-user mr-2 text-xs text-[#9aa2b0]" />{{ userName(order.reportedBy) || '—' }}</span>
            <span class="max-[960px]:hidden"><span class="text-[.8rem] font-semibold text-[#596276]">{{ openJobCount(order) }} of {{ jobCount(order) }}</span></span>
            <span class="grid h-8 w-8 place-items-center rounded-full text-[#a1a8b5] group-hover:bg-[#eceeff] group-hover:text-[#5962d8] max-[960px]:col-start-2 max-[960px]:row-span-2 max-[960px]:row-start-1"><i class="pi pi-chevron-right text-xs" /></span>
          </button>
        </div>
        <div v-else-if="!loadError" class="grid min-h-64 place-items-center px-6 py-12 text-center"><div><span class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f0f2f7] text-[#7e8799]"><i class="pi pi-filter-slash" /></span><strong class="mt-4 block">No work orders found</strong><p class="mt-1 text-sm text-[#858ea0]">Try a different search, property or status.</p></div></div>
        <div v-if="workOrders.length && workOrders.length < total" class="flex justify-center border-t border-[#e8ebf1] p-4"><Button type="button" label="Load more" severity="secondary" text :loading="loading" @click="loadOrders(true)" /></div>
      </section>
    </main>


    <WorkOrderDrawer v-model:visible="drawerOpen" :order-id="editingId" @saved="onSaved" @deleted="onDeleted" />
  </div>
</template>
