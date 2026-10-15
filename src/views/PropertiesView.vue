<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { auth } from '../auth'
import {
  type Contact,
  type Image,
  type Property,
  type PropertyView,
  type ServiceItem, type Session,
  sessionService
} from "../services/SessionService.ts";
import ProgressSpinner from "primevue/progressspinner";

type EditorTab = 'info' | 'contacts' | 'services' | 'images'

const router = useRouter()
const search = ref('')
const showArchived = ref(false)
const sortDirection = ref<'asc' | 'desc'>('asc')
const editorOpen = ref(false)
const activeTab = ref<EditorTab>('info')
const editing = ref<Property | null>(null)
const deleteOpen = ref(false)
const savedNotice = ref(false)
const saveError = ref('')
const loading = ref(true)
const loadError = ref('')
const propertyView = ref<PropertyView | null>(null)
const contacts = ref<Contact[] | null>(null);
const services = ref<ServiceItem[] | null>(null);
const images = ref<Image[] | null>(null);

const states = ['Alabama', 'Florida', 'Georgia', 'North Carolina', 'South Carolina', 'Tennessee']
const tabs: Array<{ value: EditorTab; label: string; icon: string }> = [
  { value: 'info', label: 'Property info', icon: 'pi pi-building' },
  { value: 'contacts', label: 'Contacts', icon: 'pi pi-users' },
  { value: 'services', label: 'Service items', icon: 'pi pi-wrench' },
  { value: 'images', label: 'Images', icon: 'pi pi-images' },
]

const serviceDefaults = [
  { id: 1, name: 'Full paint', detail: 'Walls, trim, doors, and ceilings', enabled: true },
  { id: 2, name: 'Paint touch-up', detail: 'Spot repair and color matching', enabled: true },
  { id: 3, name: 'Drywall repair', detail: 'Patch, sand, prime, and paint', enabled: false },
  { id: 4, name: 'Turn cleaning', detail: 'Move-out and make-ready cleaning', enabled: true },
]

const properties = ref<Property[]>([]);

const filteredProperties = computed(() => {
  const term = search.value.trim().toLowerCase()
  return (properties.value ?? [])
    .filter((item) => showArchived.value || item.archived !== true)
    .filter((item) => !term || `${item.name} ${item.address1} ${item.city} ${item.postalCode}`.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name) * (sortDirection.value === 'asc' ? 1 : -1))
})

function cloneProperty(item: Property): Property {
  return JSON.parse(JSON.stringify(item)) as Property
}

function openProperty(item: Property) {
  editing.value = cloneProperty(item)
  activeTab.value = 'info'
  savedNotice.value = false
  saveError.value = ''
  editorOpen.value = true
}

function addProperty() {
  editing.value = {
    id: null, name: '', description: '', address1: '', address2: '', city: '', state: 'Georgia',
    postalCode: '', phone: '', requiresApproval: false, securityCode: '', image: '', archived: false,
  }
  activeTab.value = 'info'
  savedNotice.value = false
  saveError.value = ''
  editorOpen.value = true
}

async function saveProperty() {
  if (!editing.value?.name?.trim()) return
  saveError.value = ''
  try {
    const response = await sessionService.updateProperty(editing.value)
    if (response.status === 401) {
      await router.replace({ name: 'login' })
      return
    }
    if (!response.ok) {
      const body = await response.text()
      saveError.value = body || `Unable to save property (HTTP ${response.status}).`
      return
    }

    const saved = await response.json() as Property
    editing.value = saved
    const existingIndex = properties.value.findIndex((item) => item.id === saved.id)
    if (existingIndex >= 0) properties.value[existingIndex] = saved
    else properties.value.push(saved)
    savedNotice.value = true
    window.setTimeout(() => { savedNotice.value = false }, 2500)
  } catch (reason) {
    saveError.value = reason instanceof Error ? reason.message : 'Unable to save property.'
  }
}

function addContact() {
  if (!editing.value) return
  //editing.value.contacts.push({ id: Date.now(), name: '', role: '', email: '', phone: '', primary: editing.value.contacts.length === 0 })
}

function removeContact(id: string) {
  if (!editing.value) return
  //editing.value.contacts = editing.value.contacts.filter((contact) => contact.id !== id)
}

function selectPrimaryContact(id: string) {
  if (!editing.value) return
  //editing.value.contacts.forEach((contact) => { contact.primary = contact.id === id })
}

function handleImages(event: Event) {
  if (!editing.value) return
  const input = event.target as HTMLInputElement
  Array.from(input.files ?? []).forEach((file) => {
    //editing.value?.images.push({ id: Date.now() + Math.random(), name: file.name, url: URL.createObjectURL(file), primary: editing.value.images.length === 0 })
  })
  input.value = ''
}

function removeImage(id: string) {
  if (!editing.value) return
  // const image = editing.value.images.find((item) => item.id === id)
  // editing.value.images = editing.value.images.filter((item) => item.id !== id)
  // if (image?.primary && editing.value.images[0]) editing.value.images[0].primary = true
}

function setPrimaryImage(id: string) {
  if (!editing.value) return
  //editing.value.images.forEach((item) => { item.primary = item.id === id })
}

function confirmDelete() {
  if (!editing.value) return
  properties.value = properties.value.filter((item) => item.id !== editing.value?.id)
  deleteOpen.value = false
  editorOpen.value = false
}

async function signOut() {
  await auth.logout()
  await router.replace({ name: 'login' })
}

onMounted(async () => {
  try {
    const response = await sessionService.getProperties()
    if (response.ok) {
      const payload = await response.json() as Partial<PropertyView> | null
      propertyView.value = {
        properties: Array.isArray(payload?.properties) ? payload.properties : [],
        activeProperties: payload?.activeProperties ?? 0,
        propertyContacts: payload?.propertyContacts ?? 0,
      }
      properties.value = propertyView.value.properties
    }
    else if (response.status === 401) await router.replace({ name: 'login' })
    else loadError.value = `Couldn't load properties (HTTP ${response.status}).`
  } catch {
    loadError.value = 'Couldn’t load properties. Check that the API is running and try again.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-[#f5f7fb]">
    <header class="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-[#e4e7ee] bg-white/90 px-[clamp(1rem,4vw,3.5rem)] backdrop-blur-2xl">
      <RouterLink class="flex items-center gap-3 font-extrabold tracking-[-.02em]" to="/">
        <span class="grid h-8 w-8 place-items-center rounded-[.6rem] bg-[#6972ea] text-[.8rem] text-white shadow-[0_12px_30px_rgba(71,80,190,.35)]"><i class="pi pi-bolt" /></span>
        <span>Turnkey Tracker</span>
      </RouterLink>
      <nav class="mr-auto ml-10 flex self-stretch items-stretch gap-1 max-[800px]:hidden [&_a]:flex [&_a]:items-center [&_a]:border-b-2 [&_a]:border-transparent [&_a]:px-[.8rem] [&_a]:text-[.88rem] [&_a]:font-semibold [&_a]:text-[#667085] [&_a:hover]:text-[#313a51]" aria-label="Primary navigation">
        <RouterLink to="/scheduler">Scheduler</RouterLink>
        <RouterLink class="!border-b-[#5962d8] !text-[#5962d8]" to="/properties">Properties</RouterLink>
        <RouterLink to="/work-orders">Work orders</RouterLink><RouterLink to="/users">Users</RouterLink>
      </nav>
      <Button icon="pi pi-sign-out" label="Sign out" severity="secondary" text class="max-[520px]:[&_.p-button-label]:hidden" @click="signOut" />
    </header>

    <main class="mx-auto w-[min(1440px,calc(100%-2rem))] py-[clamp(1.5rem,4vw,3rem)] max-[560px]:w-[calc(100%-1.25rem)]">
      <section v-if="loading" class="grid min-h-[50vh] content-center justify-items-center gap-4 text-[#697386]">
        <ProgressSpinner stroke-width="4" />
        <p>Loading your workspace…</p>
      </section>
      <section v-if="loadError" class="mb-5 rounded-xl border border-[#f0c7c7] bg-[#fff7f7] px-4 py-3 text-sm text-[#9c3f3f]" role="alert">
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

        <div class="grid grid-cols-[minmax(260px,1.4fr)_minmax(320px,1fr)_120px_52px] border-b border-[#e8ebf1] bg-[#fafbfc] px-5 py-3 text-[.7rem] font-extrabold tracking-[.08em] text-[#80899a] uppercase max-[800px]:hidden">
          <span>Property</span><span>Location</span><span>Contacts</span><span></span>
        </div>
        <div v-if="filteredProperties.length">
          <button v-for="item in filteredProperties" :key="item.id" type="button" class="group grid w-full grid-cols-[minmax(260px,1.4fr)_minmax(320px,1fr)_120px_52px] items-center border-0 border-b border-[#edf0f4] bg-white px-5 py-4 text-left text-inherit last:border-b-0 hover:bg-[#fafbff] max-[800px]:grid-cols-[1fr_auto] max-[800px]:gap-3" @click="openProperty(item)">
            <span class="flex min-w-0 items-center gap-3.5">
              <span class="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-black/5 bg-[#eef0ff] text-[#667085]"><i class="pi pi-building text-lg" /></span>
              <span class="min-w-0"><strong class="block overflow-hidden text-[.94rem] text-ellipsis whitespace-nowrap text-[#293246]">{{ item.name }}</strong><small class="mt-1 flex items-center gap-1.5 text-[#858ea0]"><i :class="['pi text-[.65rem]', item.archived ? 'pi-archive' : 'pi-circle-fill text-[#25a582]']" /></small></span>
            </span>
            <span class="min-w-0 max-[800px]:col-start-1 max-[800px]:ml-[3.4rem] max-[800px]:-mt-4"><span class="block overflow-hidden text-[.86rem] text-ellipsis whitespace-nowrap text-[#4e586d]">{{ item.address1 }}</span><small class="mt-1 block text-[#8b93a3]">{{ item.city }}, {{ item.state }} {{ item.postalCode }}</small></span>
            <span class="text-[.84rem] font-semibold text-[#5f687c] max-[800px]:hidden" v-if="contacts"><i class="pi pi-users mr-2 text-xs text-[#8e96a6]" />{{ contacts.length }}</span>
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
            <button v-for="tab in tabs" :key="tab.value" type="button" :class="['flex shrink-0 items-center gap-2 border-0 border-b-2 bg-transparent px-3 py-3 text-[.82rem] font-bold', activeTab === tab.value ? 'border-[#5962d8] text-[#5962d8]' : 'border-transparent text-[#7a8395] hover:text-[#3d465a]']" @click="activeTab = tab.value"><i :class="tab.icon" />{{ tab.label }}</button>
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

          <section v-else-if="activeTab === 'contacts'">
            <div class="mb-5 flex items-center justify-between gap-4"><div><h3 class="m-0 text-lg tracking-[-.02em]">Property contacts</h3><p class="mt-1 mb-0 text-sm text-[#7c8597]">People your team may need on-site.</p></div><Button type="button" icon="pi pi-plus" label="Add contact" size="small" outlined @click="addContact" /></div>
            <div v-if="contacts && contacts.length" class="grid gap-3">
              <article v-for="contact in contacts" :key="contact.id" class="rounded-xl border border-[#e2e6ed] p-4">
                <div class="mb-4 flex items-center justify-between"><button type="button" class="flex items-center gap-2 border-0 bg-transparent p-0 text-xs font-bold text-[#667085]" @click="selectPrimaryContact(contact.id)"><i :class="['pi', contact.primary ? 'pi-star-fill text-[#e5a527]' : 'pi-star text-[#9da5b2]']" /> {{ contact.primary ? 'Primary contact' : 'Make primary' }}</button><Button type="button" icon="pi pi-trash" severity="danger" text rounded size="small" aria-label="Remove contact" @click="removeContact(contact.id)" /></div>
                <div class="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[.75rem] [&_label]:font-bold [&_label]:text-[#5b6476] [&_.p-inputtext]:w-full"><label>Name<InputText v-model="contact.name" /></label><label>Email<InputText v-model="contact.email" type="email" /></label><label>Phone<InputText v-model="contact.phone" type="tel" /></label></div>
              </article>
            </div>
            <div v-else class="grid min-h-60 place-items-center rounded-xl border border-dashed border-[#d8dde7] text-center"><div><i class="pi pi-users text-2xl text-[#9ba3b1]" /><strong class="mt-3 block">No contacts yet</strong><p class="mt-1 text-sm text-[#838c9d]">Add a manager or leasing office contact.</p></div></div>
          </section>

          <section v-else-if="activeTab === 'services'">
            <div class="mb-5"><h3 class="m-0 text-lg tracking-[-.02em]">Available services</h3><p class="mt-1 mb-0 text-sm text-[#7c8597]">Choose the work types offered at this property.</p></div>
            <div class="grid gap-3">
              <label v-for="service in services" :key="service.id" class="flex cursor-pointer items-center gap-4 rounded-xl border border-[#e2e6ed] px-4 py-4 hover:bg-[#fafbff]"><Checkbox v-model="service.enabled" binary /><span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eef0ff] text-[#5962d8]"><i class="pi pi-wrench" /></span><span><strong class="block text-[.88rem]">{{ service.name }}</strong><small class="mt-1 block text-[#858e9f]">{{ service.detail }}</small></span></label>
            </div>
          </section>

          <section v-else>
            <div class="mb-5"><h3 class="m-0 text-lg tracking-[-.02em]">Property images</h3><p class="mt-1 mb-0 text-sm text-[#7c8597]">Add reference photos for dispatchers and field teams.</p></div>
            <label class="mb-5 grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-[#d6dbe6] bg-[#fafbfc] px-5 py-8 text-center hover:border-[#9ca3ed] hover:bg-[#f8f8ff]"><input class="hidden" type="file" accept="image/*" multiple @change="handleImages"><span class="grid h-11 w-11 place-items-center rounded-full bg-[#eceeff] text-[#5962d8]"><i class="pi pi-upload" /></span><strong class="mt-3 text-sm">Choose images to upload</strong><small class="mt-1 text-[#858e9f]">PNG, JPG, or WEBP</small></label>
            <div v-if="images && images.length" class="grid grid-cols-2 gap-3 max-[500px]:grid-cols-1">
              <article v-for="item in images" :key="item.id" class="overflow-hidden rounded-xl border border-[#e1e5ec] bg-white"><img :src="item.url" :alt="item.name" class="h-40 w-full object-cover"><div class="flex items-center gap-2 p-3"><button type="button" class="min-w-0 flex-1 overflow-hidden border-0 bg-transparent p-0 text-left text-xs font-semibold text-ellipsis whitespace-nowrap" @click="setPrimaryImage(item.id)"><i :class="['pi mr-1.5', item.primary ? 'pi-star-fill text-[#e5a527]' : 'pi-star text-[#9da5b2]']" />{{ item.primary ? 'Primary image' : item.name }}</button><Button type="button" icon="pi pi-trash" severity="danger" text rounded size="small" @click="removeImage(item.id)" /></div></article>
            </div>
          </section>

          <p v-if="saveError" class="mt-6 rounded-xl border border-[#f0c7c7] bg-[#fff7f7] px-4 py-3 text-sm text-[#9c3f3f]" role="alert">{{ saveError }}</p>

          <div class="mt-8 flex items-center justify-between gap-4 border-t border-[#e8ebf1] pt-5">
            <Button v-if="editing.id" type="button" icon="pi pi-trash" label="Delete" severity="danger" text @click="deleteOpen = true" />
            <span v-else></span>
            <div class="flex items-center gap-3"><span v-if="savedNotice" class="text-xs font-bold text-[#138c74]"><i class="pi pi-check-circle mr-1" /> Saved</span><Button type="button" label="Cancel" severity="secondary" text @click="editorOpen = false" /><Button type="submit" icon="pi pi-check" label="Save property" :disabled="!editing.name?.trim()" /></div>
          </div>
        </form>
      </template>
    </Drawer>

    <Dialog v-model:visible="deleteOpen" modal header="Delete property?" :style="{ width: '28rem' }">
      <p class="mt-0 leading-6 text-[#667085]">This permanently removes <strong>{{ editing?.name }}</strong> and its locally stored details.</p>
      <template #footer><Button label="Cancel" severity="secondary" text @click="deleteOpen = false" /><Button label="Delete property" severity="danger" @click="confirmDelete" /></template>
    </Dialog>
  </div>
</template>
