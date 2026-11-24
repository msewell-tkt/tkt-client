<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import AppHeader from '../components/AppHeader.vue'
import { ROLES, RoleEnum } from '../constants/roles'
import { userColor, userInitials, userName, userRoleNames, userStatus, type User, type UserStatus } from '../services/User'
import { propertyService } from '../services/PropertyService'
import { dashboardService } from '../services/DashboardService'
import { tenantService, type TenantSummary } from '../services/TenantService'
import { userService, type UserProperty, type UserType } from '../services/UserService'
import { formatTimestamp } from '../utils/workOrderFormat'


const route = useRoute()
const router = useRouter()
const user = ref<User | null>(null)
const allProperties = ref<UserProperty[]>([])
const linked = ref<UserProperty[]>([])
const allUserTypes = ref<UserType[]>([])
const userTypes = ref<UserType[]>([])
const allTenants = ref<TenantSummary[]>([])
const userTenants = ref<TenantSummary[]>([])
const currentTenantId = ref('')
const isSuperAdmin = ref(false)
const loading = ref(true)
const loadError = ref('')
const actionError = ref('')
const busy = ref(false)
const removeOpen = ref(false)

onMounted(async () => {
  try {
    const matches = (item: User) => item.id === route.params.id
    const session = await dashboardService.load()
    isSuperAdmin.value = session.roles.includes(RoleEnum.SUPER_ADMIN)
    currentTenantId.value = session.tid
    const found = (await userService.list()).find(matches) ?? (await userService.list(true)).find(matches) ?? null
    user.value = found
    if (!found) return
    const [properties, view, types, mine] = await Promise.all([userService.properties(found.id), propertyService.list(), userService.userTypes(), userService.userTypesOf(found.id)])
    linked.value = properties
    allUserTypes.value = types
    userTypes.value = mine
    if (isSuperAdmin.value) [allTenants.value, userTenants.value] = await Promise.all([tenantService.list(), userService.tenantsOf(found.id)])
    allProperties.value = view.properties.flatMap((item) => (item.id && !item.archived ? [{ id: item.id, name: item.name }] : []))
  } catch (reason) {
    loadError.value = reason instanceof Error ? reason.message : 'Couldn’t load the user.'
  } finally {
    loading.value = false
  }
})

/** Runs a change, shows its error, and leaves the page as it was when it fails. */
async function change(action: () => Promise<void>, fallback: string) {
  if (busy.value) return
  busy.value = true
  actionError.value = ''
  try {
    await action()
  } catch (reason) {
    actionError.value = reason instanceof Error ? reason.message : fallback
  } finally {
    busy.value = false
  }
}

const userRoles = computed({
  get: () => user.value?.roles ?? [],
  set: (roles: RoleEnum[]) => {
    const current = user.value
    if (!current) return
    const have = new Set(current.roles ?? [])
    const added = roles.filter((role) => !have.has(role))
    const removed = [...have].filter((role) => !roles.includes(role))
    void change(async () => {
      for (const role of added) await userService.addRole(current.id, role)
      for (const role of removed) await userService.removeRole(current.id, role)
      current.roles = ROLES.filter((role) => roles.includes(role))
    }, 'Unable to change the roles.')
  },
})

/** Only a Super Admin can hand out the Super Admin role; Admins hand out the rest. */
const roleOptions = computed(() => ROLES.map((role) => ({ name: role, locked: role === RoleEnum.SUPER_ADMIN && !isSuperAdmin.value })))

const tenantIds = computed({
  get: () => userTenants.value.map((item) => item.id),
  set: (ids: string[]) => {
    const current = user.value
    if (!current) return
    const have = new Set(userTenants.value.map((item) => item.id))
    const added = ids.filter((id) => !have.has(id))
    const removed = [...have].filter((id) => !ids.includes(id))
    void change(async () => {
      for (const id of added) await userService.associateWithTenant(current.id, id)
      for (const id of removed) await userService.dissociateFromTenant(current.id, id)
      userTenants.value = allTenants.value.filter((item) => ids.includes(item.id))
    }, 'Unable to change the workspaces.')
  },
})

const tenantOptions = computed(() => allTenants.value.map((item) => ({ ...item, locked: item.id === currentTenantId.value })))

const propertyIds = computed({
  get: () => linked.value.map((item) => item.id),
  set: (ids: string[]) => {
    const current = user.value
    if (!current) return
    const have = new Set(linked.value.map((item) => item.id))
    const added = ids.filter((id) => !have.has(id))
    const removed = [...have].filter((id) => !ids.includes(id))
    void change(async () => {
      for (const id of added) await userService.addToProperty(current.id, id)
      for (const id of removed) await userService.removeFromProperty(current.id, id)
      linked.value = allProperties.value.filter((item) => ids.includes(item.id))
    }, 'Unable to change the properties.')
  },
})

const userTypeIds = computed({
  get: () => userTypes.value.map((item) => item.id),
  set: (ids: string[]) => {
    const current = user.value
    if (!current) return
    const have = new Set(userTypes.value.map((item) => item.id))
    const added = ids.filter((id) => !have.has(id))
    const removed = [...have].filter((id) => !ids.includes(id))
    void change(async () => {
      for (const id of added) await userService.addToUserType(current.id, id)
      for (const id of removed) await userService.removeFromUserType(current.id, id)
      userTypes.value = allUserTypes.value.filter((item) => ids.includes(item.id))
    }, 'Unable to change the user types.')
  },
})

async function removeUser() {
  const current = user.value
  if (!current) return
  await change(async () => {
    await userService.removeFromTenant(current.id)
    removeOpen.value = false
    router.push('/users')
  }, 'Unable to remove the user.')
  removeOpen.value = false
}

const PROFILE_FIELDS = ['firstName', 'lastName', 'phone', 'mobile', 'address', 'address2', 'city', 'state', 'postal'] as const
type ProfileForm = Record<(typeof PROFILE_FIELDS)[number], string>

const editOpen = ref(false)
const active = ref(false)
const archiveOpen = ref(false)
const form = ref<ProfileForm>({ firstName: '', lastName: '', phone: '', mobile: '', address: '', address2: '', city: '', state: '', postal: '' })

function openEdit() {
  const current = user.value
  if (!current) return
  form.value = Object.fromEntries(PROFILE_FIELDS.map((field) => [field, current[field] ?? ''])) as ProfileForm
  active.value = Boolean(current.valid)
  actionError.value = ''
  editOpen.value = true
}

async function saveProfile() {
  const current = user.value
  if (!current) return
  await change(async () => {
    const edits = Object.fromEntries(PROFILE_FIELDS.map((field) => [field, form.value[field].trim() || null]))
    const saved = await userService.update({ ...current, ...edits, valid: active.value })
    Object.assign(current, { ...edits, valid: active.value, ...saved, roles: current.roles })
    editOpen.value = false
  }, 'Unable to save the user.')
}

async function setArchived(archived: boolean) {
  const current = user.value
  if (!current) return
  await change(async () => {
    const saved = archived ? await userService.archive(current.id) : await userService.unarchive(current.id)
    Object.assign(current, { archived: saved.archived ?? archived })
    archiveOpen.value = false
  }, archived ? 'Unable to archive the user.' : 'Unable to restore the user.')
  archiveOpen.value = false
}

const status = computed(() => (user.value ? userStatus(user.value) : 'Active'))
const addressLines = computed(() => {
  const item = user.value
  if (!item) return []
  const cityLine = [[item.city, item.state].filter(Boolean).join(', '), item.postal].filter(Boolean).join(' ')
  return [item.address, item.address2, cityLine].filter((line): line is string => Boolean(line))
})

function statusSeverity(value: UserStatus) {
  return value === 'Active' ? 'success' : value === 'Invited' ? 'warn' : 'secondary'
}
</script>

<template>
  <div class="min-h-screen bg-[#f5f7fb]">
    <AppHeader />

    <main class="mx-auto w-[min(1180px,calc(100%-2rem))] py-[clamp(1.5rem,4vw,3rem)] max-[560px]:w-[calc(100%-1.25rem)]">
      <RouterLink class="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#667085] hover:text-[#5962d8]" to="/users"><i class="pi pi-arrow-left" /> Back to users</RouterLink>

      <div v-if="loading" class="grid place-items-center py-16"><ProgressSpinner stroke-width="4" class="!h-10 !w-10" aria-label="Loading user" /></div>
      <Message v-else-if="loadError" severity="error" :closable="false">{{ loadError }}</Message>
      <div v-else-if="!user" class="rounded-2xl border border-[#e2e6ef] bg-white p-12 text-center"><i class="pi pi-user text-4xl text-[#a1a8b5]" /><h1>User not found</h1><p class="text-[#717b8f]">This user may have been removed.</p><Button label="Back to users" @click="router.push('/users')" /></div>

      <template v-else>
        <section class="mb-6 flex items-center gap-4">
          <span class="grid h-16 w-16 shrink-0 place-items-center rounded-full text-xl font-bold text-white shadow-[0_8px_20px_rgba(30,41,75,.15)]" :style="{ background: userColor(user) }">{{ userInitials(user) }}</span>
          <div><div class="flex items-center gap-2"><h1 class="m-0 text-[clamp(1.7rem,4vw,2.5rem)] tracking-[-.04em]">{{ userName(user) }}</h1><Tag :value="status" :severity="statusSeverity(status)" /></div><p class="mt-1 mb-0 text-sm text-[#717b8f]">{{ user.email }}</p></div>
        </section>

        <div class="grid grid-cols-[minmax(0,1.65fr)_minmax(280px,.8fr)] items-start gap-5 max-[850px]:grid-cols-1">
          <div class="grid gap-5">
            <section class="rounded-2xl border border-[#e2e6ef] bg-white p-6 shadow-[0_10px_30px_rgba(30,41,75,.04)]">
              <div class="mb-5 flex items-start justify-between gap-3"><div><h2 class="m-0 text-lg tracking-[-.02em]">Profile information</h2><p class="mt-1 mb-0 text-sm text-[#7d8698]">Contact details on file.</p></div><Button label="Edit" icon="pi pi-pencil" severity="secondary" outlined size="small" :disabled="busy" @click="openEdit" /></div>
              <dl class="m-0 grid grid-cols-2 gap-5 text-sm max-[560px]:grid-cols-1">
                <div><dt class="mb-1 text-xs font-bold tracking-[.06em] text-[#8a93a5] uppercase">First name</dt><dd class="m-0 font-semibold">{{ user.firstName || '—' }}</dd></div>
                <div><dt class="mb-1 text-xs font-bold tracking-[.06em] text-[#8a93a5] uppercase">Last name</dt><dd class="m-0 font-semibold">{{ user.lastName || '—' }}</dd></div>
                <div><dt class="mb-1 text-xs font-bold tracking-[.06em] text-[#8a93a5] uppercase">Email address</dt><dd class="m-0 font-semibold break-all">{{ user.email || '—' }}</dd></div>
                <div><dt class="mb-1 text-xs font-bold tracking-[.06em] text-[#8a93a5] uppercase">Phone</dt><dd class="m-0 font-semibold">{{ user.phone || '—' }}</dd></div>
                <div><dt class="mb-1 text-xs font-bold tracking-[.06em] text-[#8a93a5] uppercase">Mobile</dt><dd class="m-0 font-semibold">{{ user.mobile || '—' }}</dd></div>
                <div><dt class="mb-1 text-xs font-bold tracking-[.06em] text-[#8a93a5] uppercase">Address</dt><dd class="m-0 font-semibold"><template v-if="addressLines.length"><span v-for="line in addressLines" :key="line" class="block">{{ line }}</span></template><template v-else>—</template></dd></div>
              </dl>
            </section>

            <section class="rounded-2xl border border-[#e2e6ef] bg-white p-6 shadow-[0_10px_30px_rgba(30,41,75,.04)]">
              <div class="mb-4"><h2 class="m-0 text-lg tracking-[-.02em]">Roles</h2><p class="mt-1 mb-0 text-sm text-[#7d8698]">What this user can do in your workspace.</p></div>
              <MultiSelect v-model="userRoles" :options="roleOptions" option-label="name" option-value="name" option-disabled="locked" display="chip" placeholder="No roles assigned" class="w-full" :disabled="busy" />
            </section>

            <section v-if="isSuperAdmin" class="rounded-2xl border border-[#e2e6ef] bg-white p-6 shadow-[0_10px_30px_rgba(30,41,75,.04)]">
              <div class="mb-4"><h2 class="m-0 text-lg tracking-[-.02em]">Workspaces</h2><p class="mt-1 mb-0 text-sm text-[#7d8698]">Every workspace this user can sign in to. Use “Remove from workspace” to leave this one. Roles in another workspace are set from within it.</p></div>
              <MultiSelect v-model="tenantIds" :options="tenantOptions" option-label="name" option-value="id" option-disabled="locked" display="chip" filter placeholder="No workspaces" class="w-full" :disabled="busy" />
            </section>

            <section class="rounded-2xl border border-[#e2e6ef] bg-white p-6 shadow-[0_10px_30px_rgba(30,41,75,.04)]">
              <div class="mb-4"><h2 class="m-0 text-lg tracking-[-.02em]">User types</h2><p class="mt-1 mb-0 text-sm text-[#7d8698]">The scheduling groups this user belongs to.</p></div>
              <MultiSelect v-model="userTypeIds" :options="allUserTypes" option-label="name" option-value="id" display="chip" placeholder="No user types" class="w-full" :disabled="busy" />
            </section>

            <section class="rounded-2xl border border-[#e2e6ef] bg-white p-6 shadow-[0_10px_30px_rgba(30,41,75,.04)]">
              <div class="mb-4"><h2 class="m-0 text-lg tracking-[-.02em]">Properties</h2><p class="mt-1 mb-0 text-sm text-[#7d8698]">The properties this user is linked to.</p></div>
              <MultiSelect v-model="propertyIds" :options="allProperties" option-label="name" option-value="id" display="chip" filter placeholder="No properties" class="w-full" :disabled="busy" />
            </section>

            <Message v-if="actionError" severity="error" :closable="false">{{ actionError }}</Message>
          </div>

          <aside class="grid gap-5">
            <section class="rounded-2xl border border-[#e2e6ef] bg-white p-5 shadow-[0_10px_30px_rgba(30,41,75,.04)]"><h2 class="mt-0 mb-4 text-base">Account</h2><dl class="m-0 grid gap-4 text-sm"><div><dt class="mb-1 text-xs font-bold tracking-[.06em] text-[#8a93a5] uppercase">Last sign-in</dt><dd class="m-0 font-semibold">{{ user.lastLogin ? formatTimestamp(user.lastLogin) : 'Never' }}</dd></div><div><dt class="mb-1 text-xs font-bold tracking-[.06em] text-[#8a93a5] uppercase">Member since</dt><dd class="m-0 font-semibold">{{ formatTimestamp(user.created ?? null) }}</dd></div><div><dt class="mb-1 text-xs font-bold tracking-[.06em] text-[#8a93a5] uppercase">User ID</dt><dd class="m-0 font-mono text-xs break-all text-[#5962d8]">{{ user.id }}</dd></div></dl></section>
            <Button v-if="!user.archived" label="Archive user" icon="pi pi-inbox" severity="secondary" outlined :disabled="busy" @click="archiveOpen = true" />
            <Button v-else label="Restore user" icon="pi pi-replay" severity="secondary" outlined :loading="busy" @click="setArchived(false)" />
            <Button label="Remove from workspace" icon="pi pi-user-minus" severity="danger" outlined :disabled="busy" @click="removeOpen = true" />
          </aside>
        </div>
      </template>

      <Dialog v-model:visible="editOpen" modal header="Edit profile" :style="{ width: '36rem', maxWidth: 'calc(100vw - 2rem)' }">
        <form class="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1" @submit.prevent="saveProfile">
          <label class="grid gap-1 text-sm font-semibold">First name<InputText v-model="form.firstName" autocomplete="off" /></label>
          <label class="grid gap-1 text-sm font-semibold">Last name<InputText v-model="form.lastName" autocomplete="off" /></label>
          <label class="grid gap-1 text-sm font-semibold">Phone<InputText v-model="form.phone" type="tel" autocomplete="off" /></label>
          <label class="grid gap-1 text-sm font-semibold">Mobile<InputText v-model="form.mobile" type="tel" autocomplete="off" /></label>
          <label class="col-span-full grid gap-1 text-sm font-semibold">Address<InputText v-model="form.address" autocomplete="off" /></label>
          <label class="col-span-full grid gap-1 text-sm font-semibold">Address line 2<InputText v-model="form.address2" autocomplete="off" /></label>
          <label class="grid gap-1 text-sm font-semibold">City<InputText v-model="form.city" autocomplete="off" /></label>
          <div class="grid grid-cols-2 gap-4">
            <label class="grid gap-1 text-sm font-semibold">State<InputText v-model="form.state" autocomplete="off" /></label>
            <label class="grid gap-1 text-sm font-semibold">Postal<InputText v-model="form.postal" autocomplete="off" /></label>
          </div>
          <label class="col-span-full flex items-center gap-2 text-sm font-semibold"><ToggleSwitch v-model="active" input-id="user-active" />Active<span class="font-normal text-[#7d8698]">Off marks the user inactive, or invited if they have never signed in.</span></label>
          <button type="submit" class="hidden" tabindex="-1" aria-hidden="true" />
        </form>
        <Message v-if="actionError" severity="error" :closable="false" class="mt-4">{{ actionError }}</Message>
        <template #footer><Button label="Cancel" severity="secondary" text :disabled="busy" @click="editOpen = false" /><Button label="Save" :loading="busy" @click="saveProfile" /></template>
      </Dialog>

      <Dialog v-model:visible="archiveOpen" modal header="Archive user?" :style="{ width: '28rem' }">
        <p class="mt-0 leading-6 text-[#667085]"><strong>{{ user ? userName(user) : '' }}</strong> will no longer be able to sign in. Their roles and property links are kept, and you can restore them from the Archived filter on the users list.</p>
        <template #footer><Button label="Cancel" severity="secondary" text :disabled="busy" @click="archiveOpen = false" /><Button label="Archive user" :loading="busy" @click="setArchived(true)" /></template>
      </Dialog>

      <Dialog v-model:visible="removeOpen" modal header="Remove user?" :style="{ width: '28rem' }">
        <p class="mt-0 leading-6 text-[#667085]"><strong>{{ user ? userName(user) : '' }}</strong> will lose access to this workspace, along with their roles and property links here. Their account and history are kept.</p>
        <template #footer><Button label="Cancel" severity="secondary" text :disabled="busy" @click="removeOpen = false" /><Button label="Remove user" severity="danger" :loading="busy" @click="removeUser" /></template>
      </Dialog>
    </main>
  </div>
</template>
