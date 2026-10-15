<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
import ToggleSwitch from 'primevue/toggleswitch'
import AppHeader from '../components/AppHeader.vue'
import {
  propertyService,
  type Contact,
  type Property,
  type PropertyResource,
  type PropertyView,
  type ServiceItem,
} from '../services/PropertyService'

type EditorTab = 'info' | 'contacts' | 'services' | 'images'

const search = ref('')
const showArchived = ref(false)
const sortDirection = ref<'asc' | 'desc'>('asc')
const editorOpen = ref(false)
const activeTab = ref<EditorTab>('info')
const editing = ref<Property | null>(null)
const archiveOpen = ref(false)
const savedNotice = ref(false)
const saving = ref(false)
const saveError = ref('')
const loading = ref(true)
const loadError = ref('')
const propertyView = ref<PropertyView | null>(null)
const properties = ref<Property[]>([])

// Sub-resources of the property open in the editor, loaded from the API when it opens.
const contacts = ref<Contact[]>([])
const services = ref<ServiceItem[]>([])
const images = ref<PropertyResource[]>([])
const detailsLoading = ref(false)
const detailsError = ref('')
const rowSaving = ref<string | null>(null)
const newImageUrl = ref('')

const states = ['Alabama', 'Florida', 'Georgia', 'North Carolina', 'South Carolina', 'Tennessee']
const tabs: Array<{ value: EditorTab; label: string; icon: string }> = [
  { value: 'info', label: 'Property info', icon: 'pi pi-building' },
  { value: 'contacts', label: 'Contacts', icon: 'pi pi-users' },
  { value: 'services', label: 'Service items', icon: 'pi pi-wrench' },
  { value: 'images', label: 'Images', icon: 'pi pi-images' },
]

const filteredProperties = computed(() => {
  const term = search.value.trim().toLowerCase()
  return properties.value
    .filter((item) => showArchived.value || item.archived !== true)
    .filter((item) => !term || `${item.name} ${item.address1} ${item.city} ${item.postalCode}`.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name) * (sortDirection.value === 'asc' ? 1 : -1))
})

function message(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback
}

function contactName(contact: Contact | null | undefined): string {
  if (!contact) return ''
  return [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || ''
}

function cloneProperty(item: Property): Property {
  return JSON.parse(JSON.stringify(item)) as Property
}

function flashSaved() {
  savedNotice.value = true
  window.setTimeout(() => { savedNotice.value = false }, 2500)
}

function startEditing(property: Property) {
  editing.value = property
  activeTab.value = 'info'
  savedNotice.value = false
  saveError.value = ''
  detailsError.value = ''
  contacts.value = []
  services.value = []
  images.value = []
  newImageUrl.value = ''
  editorOpen.value = true
}

async function openProperty(item: Property) {
  startEditing(cloneProperty(item))
  if (item.id) await loadDetails(item.id)
}

function addProperty() {
  startEditing({
    id: null, name: '', description: '', address1: '', address2: '', city: '', state: 'Georgia',
    postalCode: '', phone: '', requiresApproval: false, securityCode: '', primaryContact: null, image: '', archived: false,
  })
}

async function loadDetails(propertyId: string) {
  detailsLoading.value = true
  detailsError.value = ''
  try {
    const [loadedContacts, loadedServices, loadedImages] = await Promise.all([
      propertyService.contacts(propertyId),
      propertyService.serviceItems(propertyId),
      propertyService.resources(propertyId),
    ])
    if (editing.value?.id !== propertyId) return
    contacts.value = loadedContacts
    services.value = loadedServices
    images.value = loadedImages
  } catch (reason) {
    detailsError.value = message(reason, 'Couldn’t load property details.')
  } finally {
    detailsLoading.value = false
  }
}

function upsertProperty(saved: Property) {
  const index = properties.value.findIndex((item) => item.id === saved.id)
  if (index >= 0) properties.value[index] = saved
  else properties.value.push(saved)
}

async function saveProperty(): Promise<boolean> {
  if (!editing.value?.name?.trim()) return false
  saving.value = true
  saveError.value = ''
  try {
    const saved = await propertyService.save(editing.value)
    editing.value = cloneProperty(saved)
    upsertProperty(saved)
    flashSaved()
    return true
  } catch (reason) {
    saveError.value = message(reason, 'Unable to save property.')
    return false
  } finally {
    saving.value = false
  }
}

// Contacts

function addContact() {
  contacts.value.push({ id: null, email: '', firstName: '', lastName: '', phone: '' })
}

async function saveContact(index: number) {
  const propertyId = editing.value?.id
  const contact = contacts.value[index]
  if (!propertyId || !contact) return
  if (!contact.email.trim()) {
    saveError.value = 'A contact needs an email address.'
    return
  }
  rowSaving.value = `contact-${index}`
  saveError.value = ''
  try {
    contacts.value[index] = await propertyService.saveContact(propertyId, contact)
    flashSaved()
  } catch (reason) {
    saveError.value = message(reason, 'Unable to save the contact.')
  } finally {
    rowSaving.value = null
  }
}

function isPrimaryContact(contact: Contact): boolean {
  return Boolean(contact.id) && editing.value?.primaryContact?.id === contact.id
}

async function makePrimaryContact(contact: Contact) {
  if (!editing.value || !contact.id || isPrimaryContact(contact)) return
  const previous = editing.value.primaryContact
  editing.value.primaryContact = contact
  if (!await saveProperty() && editing.value) editing.value.primaryContact = previous
}

// Service items

function addServiceItem() {
  services.value.push({ id: null, name: '', cost: null, list: null, extra: false })
}

async function saveServiceItem(index: number) {
  const propertyId = editing.value?.id
  const item = services.value[index]
  if (!propertyId || !item) return
  if (!item.name.trim()) {
    saveError.value = 'A service item needs a name.'
    return
  }
  rowSaving.value = `service-${index}`
  saveError.value = ''
  try {
    services.value[index] = await propertyService.saveServiceItem(propertyId, item)
    flashSaved()
  } catch (reason) {
    saveError.value = message(reason, 'Unable to save the service item.')
  } finally {
    rowSaving.value = null
  }
}

// Images (property resources holding an image URL)

function isImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

async function addImage() {
  const propertyId = editing.value?.id
  const url = newImageUrl.value.trim()
  if (!propertyId || !url) return
  if (!isImageUrl(url)) {
    saveError.value = 'Enter a full image URL starting with https://.'
    return
  }
  rowSaving.value = 'image'
  saveError.value = ''
  try {
    images.value.push(await propertyService.saveResource(propertyId, { id: null, resource: url }))
    newImageUrl.value = ''
    flashSaved()
  } catch (reason) {
    saveError.value = message(reason, 'Unable to save the image.')
  } finally {
    rowSaving.value = null
  }
}

async function setPrimaryImage(resource: PropertyResource) {
  if (!editing.value || editing.value.image === resource.resource) return
  const previous = editing.value.image
  editing.value.image = resource.resource
  if (!await saveProperty() && editing.value) editing.value.image = previous
}

// Archiving (the API has no delete endpoint; archived properties are hidden from the active list)

async function confirmArchive() {
  if (!editing.value) return
  editing.value.archived = true
  archiveOpen.value = false
  if (await saveProperty()) editorOpen.value = false
  else if (editing.value) editing.value.archived = false
}

onMounted(async () => {
  try {
    propertyView.value = await propertyService.list()
    properties.value = propertyView.value.properties
  } catch (reason) {
    loadError.value = message(reason, 'Couldn’t load properties. Check that the API is running and try again.')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-[#f5f7fb]">
    <AppHeader />

    <main class="mx-auto w-[min(1440px,calc(100%-2rem))] py-[clamp(1.5rem,4vw,3rem)] max-[560px]:w-[calc(100%-1.25rem)]">
      <section v-if="loading" class="grid min-h-[50vh] content-center justify-items-center gap-4 text-[#697386]">
        <ProgressSpinner stroke-width="4" />
        <p>Loading your workspace…</p>
      </section>
      <section v-else-if="loadError" class="mb-5 rounded-xl border border-[#f0c7c7] bg-[#fff7f7] px-4 py-3 text-sm text-[#9c3f3f]" role="alert">
        {{ loadError }}
      </section>
      <section class="mb-7 flex items-end justify-between gap-6 max-[680px]:items-start">
        <div>
          <p class="mb-[.45rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">Portfolio</p>
          <h1 class="m-0 text-[clamp(2rem,4vw,3rem)] leading-none tracking-[-.05em]">Properties</h1>
          <p class="mt-3 mb-0 text-[#717b8f] max-[580px]:hidden">Manage addresses, contacts, services, and site details.</p>
        </div>
        <Button icon="pi pi-plus" label="Add property" size="large" @click="addProperty" />
      </section>

      <section class="mb-5 grid grid-cols-3 gap-3 max-[680px]:grid-cols-1" v-if="propertyView">
        <div class="flex items-center gap-4 rounded-2xl border border-[#e3e7ef] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(30,41,75,.035)]">
          <span class="grid h-10 w-10 place-items-center rounded-xl bg-[#eceeff] text-[#5962d8]"><i class="pi pi-building" /></span>
          <div><strong class="block text-xl tracking-[-.03em]">{{ propertyView.activeProperties }}</strong><small class="text-[#7d8698]">Active properties</small></div>
        </div>
        <div class="flex items-center gap-4 rounded-2xl border border-[#e3e7ef] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(30,41,75,.035)]">
          <span class="grid h-10 w-10 place-items-center rounded-xl bg-[#e2f7f1] text-[#138c74]"><i class="pi pi-users" /></span>
          <div><strong class="block text-xl tracking-[-.03em]">{{ propertyView.propertyContacts }}</strong><small class="text-[#7d8698]">Property contacts</small></div>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-[#e2e6ef] bg-white shadow-[0_12px_35px_rgba(30,41,75,.045)]">
        <div class="flex items-center justify-between gap-3 border-b border-[#e8ebf1] px-5 py-4 max-[680px]:flex-col max-[680px]:items-stretch">
          <div class="relative w-full max-w-[430px] max-[680px]:max-w-none">
            <i class="pi pi-search absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-[#8a93a5]" />
            <InputText v-model="search" class="w-full !pl-10" placeholder="Search name, address, city, or ZIP…" />
          </div>
          <div class="flex items-center gap-2">
            <label class="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-medium text-[#5f687c]"><Checkbox v-model="showArchived" binary /> Archived</label>
            <Button :icon="sortDirection === 'asc' ? 'pi pi-sort-alpha-down' : 'pi pi-sort-alpha-up'" severity="secondary" outlined aria-label="Change sort direction" @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'" />
          </div>
        </div>

        <div class="grid grid-cols-[minmax(260px,1.4fr)_minmax(320px,1fr)_180px_52px] border-b border-[#e8ebf1] bg-[#fafbfc] px-5 py-3 text-[.7rem] font-extrabold tracking-[.08em] text-[#80899a] uppercase max-[800px]:hidden">
          <span>Property</span><span>Location</span><span>Primary contact</span><span></span>
        </div>
        <div v-if="filteredProperties.length">
          <button v-for="item in filteredProperties" :key="item.id ?? item.name" type="button" class="group grid w-full grid-cols-[minmax(260px,1.4fr)_minmax(320px,1fr)_180px_52px] items-center border-0 border-b border-[#edf0f4] bg-white px-5 py-4 text-left text-inherit last:border-b-0 hover:bg-[#fafbff] max-[800px]:grid-cols-[1fr_auto] max-[800px]:gap-3" @click="openProperty(item)">
            <span class="flex min-w-0 items-center gap-3.5">
              <span class="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-black/5 bg-[#eef0ff] text-[#667085]"><i class="pi pi-building text-lg" /></span>
              <span class="min-w-0"><strong class="block overflow-hidden text-[.94rem] text-ellipsis whitespace-nowrap text-[#293246]">{{ item.name }}</strong><small class="mt-1 flex items-center gap-1.5 text-[#858ea0]"><i :class="['pi text-[.65rem]', item.archived ? 'pi-archive' : 'pi-circle-fill text-[#25a582]']" />{{ item.archived ? 'Archived' : 'Active' }}</small></span>
            </span>
            <span class="min-w-0 max-[800px]:col-start-1 max-[800px]:ml-[3.4rem] max-[800px]:-mt-4"><span class="block overflow-hidden text-[.86rem] text-ellipsis whitespace-nowrap text-[#4e586d]">{{ item.address1 }}</span><small class="mt-1 block text-[#8b93a3]">{{ item.city }}, {{ item.state }} {{ item.postalCode }}</small></span>
            <span class="min-w-0 overflow-hidden text-[.84rem] font-semibold text-ellipsis whitespace-nowrap text-[#5f687c] max-[800px]:hidden"><i class="pi pi-user mr-2 text-xs text-[#8e96a6]" />{{ contactName(item.primaryContact) || '—' }}</span>
            <span class="grid h-8 w-8 place-items-center rounded-full text-[#a1a8b5] group-hover:bg-[#eceeff] group-hover:text-[#5962d8]"><i class="pi pi-chevron-right text-xs" /></span>
          </button>
        </div>
        <div v-else class="grid min-h-64 place-items-center px-6 py-12 text-center">
          <div><span class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f0f2f7] text-[#7e8799]"><i class="pi pi-search" /></span><strong class="mt-4 block">No properties found</strong><p class="mt-1 text-sm text-[#858ea0]">Try another search or adjust the Archived filter.</p></div>
        </div>
      </section>
    </main>

    <Drawer v-model:visible="editorOpen" position="right" class="!w-[min(760px,100vw)] [&_.p-drawer-content]:!p-0 [&_.p-drawer-header]:!hidden">
      <template v-if="editing">
        <div class="sticky top-0 z-5 border-b border-[#e5e8ef] bg-white">
          <div class="flex items-start justify-between gap-4 px-6 pt-6 pb-5 max-[520px]:px-4">
            <div class="min-w-0"><p class="mb-1 text-[.7rem] font-extrabold tracking-[.1em] text-[#6972ea] uppercase">{{ editing.id ? 'Property profile' : 'New property' }}</p><h2 class="m-0 overflow-hidden text-2xl tracking-[-.04em] text-ellipsis whitespace-nowrap">{{ editing.name || 'Untitled property' }}</h2></div>
            <Button icon="pi pi-times" severity="secondary" text rounded aria-label="Close property editor" @click="editorOpen = false" />
          </div>
          <nav class="flex gap-1 overflow-x-auto px-6 max-[520px]:px-4" aria-label="Property sections">
            <button v-for="tab in tabs" :key="tab.value" type="button" :disabled="!editing.id && tab.value !== 'info'" :title="!editing.id && tab.value !== 'info' ? 'Save the property first' : undefined" :class="['flex shrink-0 items-center gap-2 border-0 border-b-2 bg-transparent px-3 py-3 text-[.82rem] font-bold disabled:cursor-not-allowed disabled:opacity-40', activeTab === tab.value ? 'border-[#5962d8] text-[#5962d8]' : 'border-transparent text-[#7a8395] hover:text-[#3d465a]']" @click="activeTab = tab.value"><i :class="tab.icon" />{{ tab.label }}</button>
          </nav>
        </div>

        <form class="px-6 py-6 max-[520px]:px-4" @submit.prevent="saveProperty">
          <section v-if="activeTab === 'info'" class="grid grid-cols-2 gap-x-4 gap-y-5 max-[620px]:grid-cols-1 [&_label]:grid [&_label]:gap-2 [&_label]:text-[.78rem] [&_label]:font-bold [&_label]:text-[#465064] [&_.p-inputtext]:w-full [&_.p-select]:w-full [&_.p-textarea]:w-full">
            <label class="col-span-2 max-[620px]:col-span-1">Property name <InputText v-model="editing.name" placeholder="Property name" required /></label>
            <label class="col-span-2 max-[620px]:col-span-1">Street address <InputText v-model="editing.address1" placeholder="Street address" /></label>
            <label class="col-span-2 max-[620px]:col-span-1">Address line 2 <InputText v-model="editing.address2" placeholder="Suite, building, etc." /></label>
            <label>City <InputText v-model="editing.city" /></label>
            <label>State <Select v-model="editing.state" :options="states" /></label>
            <label>ZIP code <InputText v-model="editing.postalCode" inputmode="numeric" /></label>
            <label>Gate code <InputText v-model="editing.securityCode" /></label>
            <label>Phone <InputText v-model="editing.phone" type="tel" /></label>
            <label class="col-span-2 max-[620px]:col-span-1">Notes <Textarea v-model="editing.description" rows="4" placeholder="Access details, parking notes, or team instructions…" /></label>
            <div class="col-span-2 grid grid-cols-2 gap-3 max-[620px]:col-span-1 max-[620px]:grid-cols-1">
              <div class="flex items-center justify-between gap-4 rounded-xl border border-[#e3e7ee] px-4 py-3"><div><strong class="block text-[.84rem]">Archived</strong><small class="mt-1 block text-[#858e9f]">Hide from active property lists.</small></div><ToggleSwitch :model-value="editing.archived" @update:model-value="editing.archived = $event ? true : false" /></div>
            </div>
          </section>

          <template v-else>
            <div v-if="detailsLoading" class="mb-5 flex items-center gap-3 text-sm text-[#697386]"><ProgressSpinner class="!h-5 !w-5" stroke-width="6" /> Loading property details…</div>
            <Message v-if="detailsError" severity="error" :closable="false" class="mb-5">{{ detailsError }}</Message>

            <section v-if="activeTab === 'contacts'">
              <div class="mb-5 flex items-center justify-between gap-4"><div><h3 class="m-0 text-lg tracking-[-.02em]">Property contacts</h3><p class="mt-1 mb-0 text-sm text-[#7c8597]">People your team may need on-site.</p></div><Button type="button" icon="pi pi-plus" label="Add contact" size="small" outlined @click="addContact" /></div>
              <div v-if="contacts.length" class="grid gap-3">
                <article v-for="(contact, index) in contacts" :key="contact.id ?? `new-contact-${index}`" class="rounded-xl border border-[#e2e6ed] p-4">
                  <div class="mb-4 flex items-center justify-between gap-3">
                    <button type="button" :disabled="!contact.id || saving" class="flex items-center gap-2 border-0 bg-transparent p-0 text-xs font-bold text-[#667085] disabled:cursor-default" @click="makePrimaryContact(contact)"><i :class="['pi', isPrimaryContact(contact) ? 'pi-star-fill text-[#e5a527]' : 'pi-star text-[#9da5b2]']" /> {{ isPrimaryContact(contact) ? 'Primary contact' : contact.id ? 'Make primary' : 'New contact' }}</button>
                    <Button v-if="!contact.id" type="button" icon="pi pi-times" severity="secondary" text rounded size="small" aria-label="Discard new contact" @click="contacts.splice(index, 1)" />
                  </div>
                  <div class="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[.75rem] [&_label]:font-bold [&_label]:text-[#5b6476] [&_.p-inputtext]:w-full"><label>First name<InputText v-model="contact.firstName" /></label><label>Last name<InputText v-model="contact.lastName" /></label><label>Email<InputText v-model="contact.email" type="email" /></label><label>Phone<InputText v-model="contact.phone" type="tel" /></label></div>
                  <div class="mt-4 flex justify-end"><Button type="button" icon="pi pi-check" :label="contact.id ? 'Save contact' : 'Add contact'" size="small" outlined :loading="rowSaving === `contact-${index}`" @click="saveContact(index)" /></div>
                </article>
              </div>
              <div v-else-if="!detailsLoading" class="grid min-h-60 place-items-center rounded-xl border border-dashed border-[#d8dde7] text-center"><div><i class="pi pi-users text-2xl text-[#9ba3b1]" /><strong class="mt-3 block">No contacts yet</strong><p class="mt-1 text-sm text-[#838c9d]">Add a manager or leasing office contact.</p></div></div>
            </section>

            <section v-else-if="activeTab === 'services'">
              <div class="mb-5 flex items-center justify-between gap-4"><div><h3 class="m-0 text-lg tracking-[-.02em]">Service items</h3><p class="mt-1 mb-0 text-sm text-[#7c8597]">Work types offered at this property, with cost and list price.</p></div><Button type="button" icon="pi pi-plus" label="Add item" size="small" outlined @click="addServiceItem" /></div>
              <div v-if="services.length" class="grid gap-3">
                <article v-for="(service, index) in services" :key="service.id ?? `new-service-${index}`" class="rounded-xl border border-[#e2e6ed] p-4">
                  <div class="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 max-[620px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[.75rem] [&_label]:font-bold [&_label]:text-[#5b6476] [&_.p-inputtext]:w-full [&_.p-inputnumber]:w-full">
                    <label>Name<InputText v-model="service.name" placeholder="e.g. Full paint" /></label>
                    <label>Cost<InputNumber v-model="service.cost" mode="currency" currency="USD" locale="en-US" /></label>
                    <label>List price<InputNumber v-model="service.list" mode="currency" currency="USD" locale="en-US" /></label>
                  </div>
                  <div class="mt-4 flex items-center justify-between gap-3">
                    <label class="flex cursor-pointer items-center gap-2 text-xs font-bold text-[#5b6476]"><ToggleSwitch v-model="service.extra" /> Extra (add-on item)</label>
                    <div class="flex items-center gap-2">
                      <Button v-if="!service.id" type="button" label="Discard" severity="secondary" text size="small" @click="services.splice(index, 1)" />
                      <Button type="button" icon="pi pi-check" :label="service.id ? 'Save item' : 'Add item'" size="small" outlined :loading="rowSaving === `service-${index}`" @click="saveServiceItem(index)" />
                    </div>
                  </div>
                </article>
              </div>
              <div v-else-if="!detailsLoading" class="grid min-h-60 place-items-center rounded-xl border border-dashed border-[#d8dde7] text-center"><div><i class="pi pi-wrench text-2xl text-[#9ba3b1]" /><strong class="mt-3 block">No service items yet</strong><p class="mt-1 text-sm text-[#838c9d]">Add the work types this property orders.</p></div></div>
            </section>

            <section v-else>
              <div class="mb-5"><h3 class="m-0 text-lg tracking-[-.02em]">Property images</h3><p class="mt-1 mb-0 text-sm text-[#7c8597]">Reference photos for dispatchers and field teams. Add an image by URL.</p></div>
              <div class="mb-5 flex gap-3 rounded-xl border border-[#e2e6ed] bg-[#fafbfc] p-4 max-[560px]:flex-col"><InputText v-model="newImageUrl" type="url" placeholder="https://…/photo.jpg" class="min-w-0 flex-1" @keydown.enter.prevent="addImage" /><Button type="button" icon="pi pi-plus" label="Add image" :disabled="!newImageUrl.trim()" :loading="rowSaving === 'image'" @click="addImage" /></div>
              <div v-if="images.length" class="grid grid-cols-2 gap-3 max-[500px]:grid-cols-1">
                <article v-for="item in images" :key="item.id ?? item.resource" class="overflow-hidden rounded-xl border border-[#e1e5ec] bg-white"><img :src="item.resource" alt="" class="h-40 w-full bg-[#f0f2f7] object-cover"><div class="flex items-center gap-2 p-3"><button type="button" :disabled="saving" class="min-w-0 flex-1 overflow-hidden border-0 bg-transparent p-0 text-left text-xs font-semibold text-ellipsis whitespace-nowrap" @click="setPrimaryImage(item)"><i :class="['pi mr-1.5', editing.image === item.resource ? 'pi-star-fill text-[#e5a527]' : 'pi-star text-[#9da5b2]']" />{{ editing.image === item.resource ? 'Primary image' : 'Make primary' }}</button></div></article>
              </div>
              <div v-else-if="!detailsLoading" class="grid min-h-40 place-items-center rounded-xl border border-dashed border-[#d8dde7] text-center"><div><i class="pi pi-images text-2xl text-[#9ba3b1]" /><strong class="mt-3 block">No images yet</strong></div></div>
            </section>
          </template>

          <p v-if="saveError" class="mt-6 rounded-xl border border-[#f0c7c7] bg-[#fff7f7] px-4 py-3 text-sm text-[#9c3f3f]" role="alert">{{ saveError }}</p>

          <div class="mt-8 flex items-center justify-between gap-4 border-t border-[#e8ebf1] pt-5">
            <Button v-if="editing.id && !editing.archived" type="button" icon="pi pi-archive" label="Archive" severity="danger" text :disabled="saving" @click="archiveOpen = true" />
            <span v-else></span>
            <div class="flex items-center gap-3"><span v-if="savedNotice" class="text-xs font-bold text-[#138c74]"><i class="pi pi-check-circle mr-1" /> Saved</span><Button type="button" label="Cancel" severity="secondary" text @click="editorOpen = false" /><Button type="submit" icon="pi pi-check" label="Save property" :loading="saving" :disabled="!editing.name?.trim()" /></div>
          </div>
        </form>
      </template>
    </Drawer>

    <Dialog v-model:visible="archiveOpen" modal header="Archive property?" :style="{ width: '28rem' }">
      <p class="mt-0 leading-6 text-[#667085]"><strong>{{ editing?.name }}</strong> will be hidden from active property lists. You can restore it from the Archived filter.</p>
      <template #footer><Button label="Cancel" severity="secondary" text @click="archiveOpen = false" /><Button label="Archive property" severity="danger" @click="confirmArchive" /></template>
    </Dialog>
  </div>
</template>
