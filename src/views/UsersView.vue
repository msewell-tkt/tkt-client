<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import AppHeader from '../components/AppHeader.vue'
import { userColor, userInitials, userName, userRoleNames, userStatus, type User, type UserStatus } from '../services/User'
import { invitationService, type InvitationResult, type InvitationStatus } from '../services/InvitationService'
import { userService } from '../services/UserService'
import { formatTimestamp } from '../utils/workOrderFormat'

const router = useRouter()
const users = ref<User[]>([])
const archivedUsers = ref<User[] | null>(null)
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const roleFilter = ref('All roles')
const statusFilter = ref<'All statuses' | UserStatus>('All statuses')
const statuses: Array<'All statuses' | UserStatus> = ['All statuses', 'Active', 'Invited', 'Inactive', 'Archived']
const showingArchived = computed(() => statusFilter.value === 'Archived')
/** The users the list works from: the archived ones only when that filter is chosen. */
const shown = computed(() => (showingArchived.value ? archivedUsers.value ?? [] : users.value))
const roles = computed(() => ['All roles', ...[...new Set(shown.value.flatMap(userRoleNames))].sort()])

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    users.value = await userService.list()
    archivedUsers.value = null
    if (showingArchived.value) archivedUsers.value = await userService.list(true)
  } catch (reason) {
    loadError.value = reason instanceof Error ? reason.message : 'Couldn’t load users.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

watch(statusFilter, async (value) => {
  if (value !== 'Archived' || archivedUsers.value) return
  loadError.value = ''
  try {
    archivedUsers.value = await userService.list(true)
  } catch (reason) {
    loadError.value = reason instanceof Error ? reason.message : 'Couldn’t load archived users.'
    statusFilter.value = 'All statuses'
  }
})

const filteredUsers = computed(() => {
  const term = search.value.trim().toLowerCase()
  return shown.value.filter((user) => {
    const matchesTerm = !term || `${userName(user)} ${user.email ?? ''} ${user.phone ?? ''} ${userRoleNames(user).join(' ')}`.toLowerCase().includes(term)
    const matchesRole = roleFilter.value === 'All roles' || userRoleNames(user).includes(roleFilter.value)
    const matchesStatus = statusFilter.value === 'All statuses' || showingArchived.value || userStatus(user) === statusFilter.value
    return matchesTerm && matchesRole && matchesStatus
  })
})

const activeCount = computed(() => users.value.filter((user) => userStatus(user) === 'Active').length)
const inviteCount = computed(() => users.value.filter((user) => userStatus(user) === 'Invited').length)
const adminCount = computed(() => users.value.filter((user) => userRoleNames(user).some((name) => name === 'Admin' || name === 'Super Admin')).length)

const inviteOpen = ref(false)
const inviteText = ref('')
const inviting = ref(false)
const inviteError = ref('')
const inviteResults = ref<InvitationResult[]>([])
const inviteLabels: Record<InvitationStatus, string> = { INVITED: 'Invited', ALREADY_MEMBER: 'Already a member', INVALID_EMAIL: 'Invalid email', SEND_FAILED: 'Couldn’t send' }
const inviteEmails = computed(() => inviteText.value.split(/[\s,;]+/).filter(Boolean))

function openInvite() {
  inviteText.value = ''
  inviteError.value = ''
  inviteResults.value = []
  inviteOpen.value = true
}

async function sendInvites() {
  if (inviting.value || !inviteEmails.value.length) return
  inviting.value = true
  inviteError.value = ''
  try {
    inviteResults.value = await invitationService.invite(inviteEmails.value)
    // Leave only the addresses that still need attention, so they can be corrected and sent again.
    inviteText.value = inviteResults.value.filter((item) => item.status === 'INVALID_EMAIL' || item.status === 'SEND_FAILED').map((item) => item.email).join('\n')
  } catch (reason) {
    inviteError.value = reason instanceof Error ? reason.message : 'Unable to send the invitations.'
  } finally {
    inviting.value = false
  }
}

function inviteSeverity(status: InvitationStatus) {
  return status === 'INVITED' ? 'success' : status === 'ALREADY_MEMBER' ? 'secondary' : 'danger'
}

function statusSeverity(status: UserStatus) {
  return status === 'Active' ? 'success' : status === 'Invited' ? 'warn' : 'secondary'
}
</script>

<template>
  <div class="min-h-screen bg-[#f5f7fb]">
    <AppHeader />

    <main class="mx-auto w-[min(1320px,calc(100%-2rem))] py-[clamp(1.5rem,4vw,3rem)] max-[560px]:w-[calc(100%-1.25rem)]">
      <section class="mb-7 flex items-end justify-between gap-6">
        <div>
          <p class="mb-[.45rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">Team management</p>
          <h1 class="m-0 text-[clamp(2rem,4vw,3rem)] leading-none tracking-[-.05em]">Users</h1>
          <p class="mt-3 mb-0 text-[#717b8f] max-[580px]:hidden">Manage your team, roles, and property access.</p>
        </div>
        <Button label="Invite users" icon="pi pi-user-plus" @click="openInvite" />
      </section>

      <Message v-if="loadError" severity="error" :closable="false" class="mb-5">{{ loadError }} <Button label="Try again" text size="small" @click="load" /></Message>
      <div v-else-if="loading" class="grid place-items-center py-16"><ProgressSpinner stroke-width="4" class="!h-10 !w-10" aria-label="Loading users" /></div>

      <template v-else>
      <section class="mb-5 grid grid-cols-3 gap-3 max-[680px]:grid-cols-1">
        <div v-for="stat in [{ icon: 'pi-users', value: activeCount, label: 'Active users', color: 'bg-[#eceeff] text-[#5962d8]' }, { icon: 'pi-envelope', value: inviteCount, label: 'Pending invites', color: 'bg-[#fff2d8] text-[#b87814]' }, { icon: 'pi-shield', value: adminCount, label: 'Managers & admins', color: 'bg-[#e2f7f1] text-[#138c74]' }]" :key="stat.label" class="flex items-center gap-4 rounded-2xl border border-[#e3e7ef] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(30,41,75,.035)]">
          <span :class="['grid h-10 w-10 place-items-center rounded-xl', stat.color]"><i :class="['pi', stat.icon]" /></span>
          <div><strong class="block text-xl tracking-[-.03em]">{{ stat.value }}</strong><small class="text-[#7d8698]">{{ stat.label }}</small></div>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-[#e2e6ef] bg-white shadow-[0_12px_35px_rgba(30,41,75,.045)]">
        <div class="flex items-center justify-between gap-3 border-b border-[#e8ebf1] px-5 py-4 max-[760px]:flex-col max-[760px]:items-stretch">
          <div class="relative w-full max-w-[430px] max-[760px]:max-w-none">
            <i class="pi pi-search absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-[#8a93a5]" />
            <InputText v-model="search" class="w-full !pl-10" placeholder="Search users…" />
          </div>
          <div class="flex gap-2 max-[520px]:grid max-[520px]:grid-cols-2">
            <Select v-model="roleFilter" :options="roles" class="min-w-44 max-[520px]:min-w-0" />
            <Select v-model="statusFilter" :options="statuses" class="min-w-40 max-[520px]:min-w-0" />
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[820px] border-collapse text-left">
            <thead class="bg-[#fafbfc] text-[.7rem] tracking-[.08em] text-[#7d8698] uppercase"><tr><th class="px-5 py-3.5">User</th><th class="px-4 py-3.5">Role</th><th class="px-4 py-3.5">Phone</th><th class="px-4 py-3.5">Status</th><th class="px-4 py-3.5">Last sign-in</th><th class="w-12 px-4 py-3.5" /></tr></thead>
            <tbody>
              <tr v-for="user in filteredUsers" :key="user.id" class="cursor-pointer border-t border-[#edf0f4] transition-colors hover:bg-[#f8f9fd]" @click="router.push(`/users/${user.id}`)">
                <td class="px-5 py-4"><div class="flex items-center gap-3"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" :style="{ background: userColor(user) }">{{ userInitials(user) }}</span><div><strong class="block text-sm">{{ userName(user) }}</strong><span class="mt-1 block text-xs text-[#7d8698]">{{ user.email }}</span></div></div></td>
                <td class="px-4 py-4"><strong class="text-sm font-semibold">{{ userRoleNames(user).join(', ') || '—' }}</strong></td>
                <td class="px-4 py-4 text-sm text-[#5f687b]">{{ user.phone || user.mobile || '—' }}</td>
                <td class="px-4 py-4"><Tag :value="userStatus(user)" :severity="statusSeverity(userStatus(user))" /></td>
                <td class="px-4 py-4 text-sm text-[#697386]">{{ user.lastLogin ? formatTimestamp(user.lastLogin) : 'Never' }}</td>
                <td class="px-4 py-4"><Button icon="pi pi-chevron-right" severity="secondary" text rounded aria-label="View user" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!filteredUsers.length" class="px-6 py-16 text-center"><span class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f0f2f7] text-[#7e8799]"><i class="pi pi-search" /></span><strong class="mt-4 block">No users found</strong><p class="mt-1 text-sm text-[#858ea0]">Try changing your search or filters.</p></div>
        <div class="border-t border-[#e8ebf1] px-5 py-3 text-xs text-[#858ea0]">Showing {{ filteredUsers.length }} of {{ shown.length }} {{ showingArchived ? 'archived users' : 'users' }}</div>
      </section>
      </template>

      <Dialog v-model:visible="inviteOpen" modal header="Invite users" :style="{ width: '34rem', maxWidth: 'calc(100vw - 2rem)' }">
        <p class="mt-0 mb-3 text-sm leading-6 text-[#667085]">Enter up to 50 email addresses, separated by commas, spaces or new lines. Each person gets a link to register for your workspace. Links expire after a week.</p>
        <Textarea v-model="inviteText" rows="5" class="w-full" placeholder="jane@example.com, sam@example.com" :disabled="inviting" auto-resize />
        <Message v-if="inviteError" severity="error" :closable="false" class="mt-4">{{ inviteError }}</Message>
        <ul v-if="inviteResults.length" class="mt-4 mb-0 grid list-none gap-2 p-0">
          <li v-for="item in inviteResults" :key="item.email" class="flex items-center justify-between gap-3 text-sm"><span class="break-all">{{ item.email }}</span><Tag :value="inviteLabels[item.status]" :severity="inviteSeverity(item.status)" /></li>
        </ul>
        <template #footer>
          <Button :label="inviteResults.length ? 'Done' : 'Cancel'" severity="secondary" text :disabled="inviting" @click="inviteOpen = false" />
          <Button :label="inviteEmails.length > 1 ? `Send ${inviteEmails.length} invitations` : 'Send invitation'" icon="pi pi-send" :loading="inviting" :disabled="!inviteEmails.length" @click="sendInvites" />
        </template>
      </Dialog>
    </main>
  </div>
</template>
