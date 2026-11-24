<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import AppHeader from '../components/AppHeader.vue'
import TenantLogo from '../components/TenantLogo.vue'
import { loadSession } from '../session'
import { LOGO_TYPES, MAX_LOGO_BYTES, tenantService, type TenantDetail } from '../services/TenantService'
import { userService } from '../services/UserService'
import type { InvitationResult, InvitationStatus } from '../services/InvitationService'
import { userColor, userInitials, userName, userRoleNames, userStatus, type User, type UserStatus } from '../services/User'
import { formatTimestamp } from '../utils/workOrderFormat'

const route = useRoute()
const tenantId = String(route.params.id)
const tenant = ref<TenantDetail | null>(null)
const users = ref<User[]>([])
const currentUserId = ref('')
const currentTenantId = ref('')
const loading = ref(true)
const loadError = ref('')
const actionError = ref('')
const busy = ref(false)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [session, detail, members] = await Promise.all([loadSession(), tenantService.detail(tenantId), tenantService.users(tenantId)])
    currentUserId.value = session.id
    currentTenantId.value = session.tid
    tenant.value = detail
    users.value = members
  } catch (reason) {
    loadError.value = reason instanceof Error ? reason.message : 'Couldn’t load the workspace.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** User pages only work for the signed-in user's own workspace. */
const isCurrentTenant = computed(() => tenantId === currentTenantId.value)

function statusSeverity(status: UserStatus) {
  return status === 'Active' ? 'success' : status === 'Invited' ? 'warn' : 'secondary'
}

// Invite
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
    inviteResults.value = await tenantService.invite(tenantId, inviteEmails.value)
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

// Logo
const logoInput = ref<HTMLInputElement | null>(null)

async function chooseLogo(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || busy.value) return
  actionError.value = ''
  if (!LOGO_TYPES.includes(file.type)) {
    actionError.value = 'The logo must be a PNG, JPEG, GIF or WebP image.'
    return
  }
  if (file.size > MAX_LOGO_BYTES) {
    actionError.value = `The logo must be at most ${MAX_LOGO_BYTES / 1024} KB.`
    return
  }
  busy.value = true
  try {
    tenant.value = await tenantService.uploadLogo(tenantId, file)
  } catch (reason) {
    actionError.value = reason instanceof Error ? reason.message : 'Unable to upload the logo.'
  } finally {
    busy.value = false
  }
}

async function removeLogo() {
  if (busy.value) return
  busy.value = true
  actionError.value = ''
  try {
    tenant.value = await tenantService.removeLogo(tenantId)
  } catch (reason) {
    actionError.value = reason instanceof Error ? reason.message : 'Unable to remove the logo.'
  } finally {
    busy.value = false
  }
}

// Edit and archive
const editOpen = ref(false)
const archiveOpen = ref(false)
const nameDraft = ref('')
const subdomainDraft = ref('')
/** What the typed subdomain will be saved as: lower case, spaces as dashes (the API checks the rest). */
const subdomainPreview = computed(() => subdomainDraft.value.trim().toLowerCase().replace(/\s+/g, '-'))
const subdomainValid = computed(() => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomainPreview.value) && subdomainPreview.value.length <= 63)
const appDomain = (import.meta.env.VITE_APP_DOMAIN ?? '').replace(/^\./, '')
const edited = computed(() => nameDraft.value.trim() !== tenant.value?.name || subdomainPreview.value !== (tenant.value?.subdomain ?? ''))

function saveEdit() {
  const changes: { name?: string; subdomain?: string } = {}
  if (nameDraft.value.trim() !== tenant.value?.name) changes.name = nameDraft.value
  if (subdomainPreview.value !== (tenant.value?.subdomain ?? '')) changes.subdomain = subdomainPreview.value
  return saveTenant(changes)
}

function openEdit() {
  nameDraft.value = tenant.value?.name ?? ''
  subdomainDraft.value = tenant.value?.subdomain ?? ''
  actionError.value = ''
  editOpen.value = true
}

/** Saves a change to the tenant and keeps the page's user count (it is not part of the response's users). */
async function saveTenant(changes: { name?: string; archived?: boolean }) {
  if (busy.value) return
  busy.value = true
  actionError.value = ''
  try {
    tenant.value = await tenantService.update(tenantId, changes)
    editOpen.value = false
    archiveOpen.value = false
  } catch (reason) {
    actionError.value = reason instanceof Error ? reason.message : 'Unable to save the workspace.'
  } finally {
    busy.value = false
  }
}

// Remove
const removing = ref<User | null>(null)

async function removeUser() {
  const target = removing.value
  if (!target || busy.value) return
  busy.value = true
  actionError.value = ''
  try {
    await userService.dissociateFromTenant(target.id, tenantId)
    users.value = users.value.filter((item) => item.id !== target.id)
    if (tenant.value) tenant.value.userCount = users.value.length
    removing.value = null
  } catch (reason) {
    actionError.value = reason instanceof Error ? reason.message : 'Unable to remove the user.'
    removing.value = null
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#f5f7fb]">
    <AppHeader />

    <main class="mx-auto w-[min(1320px,calc(100%-2rem))] py-[clamp(1.5rem,4vw,3rem)] max-[560px]:w-[calc(100%-1.25rem)]">
      <RouterLink to="/tenants" class="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#5962d8]"><i class="pi pi-arrow-left text-xs" /> All tenants</RouterLink>

      <Message v-if="loadError" severity="error" :closable="false" class="mb-5">{{ loadError }} <Button label="Try again" text size="small" @click="load" /></Message>
      <div v-else-if="loading" class="grid place-items-center py-16"><ProgressSpinner stroke-width="4" class="!h-10 !w-10" aria-label="Loading tenant" /></div>

      <template v-else-if="tenant">
        <section class="mb-7 flex items-end justify-between gap-6">
          <div>
            <p class="mb-[.45rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">Tenant</p>
            <h1 class="m-0 text-[clamp(2rem,4vw,3rem)] leading-none tracking-[-.05em]">{{ tenant.name }}<Tag v-if="tenant.archived" value="Archived" severity="secondary" class="ml-3 align-middle" /></h1>
            <p class="mt-3 mb-0 text-[#717b8f]"><span v-if="tenant.subdomain" class="font-mono">{{ tenant.subdomain }}</span><span v-else>No subdomain</span> · created {{ formatTimestamp(tenant.created ?? null) }} · {{ tenant.userCount }} active {{ tenant.userCount === 1 ? 'user' : 'users' }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button label="Edit" icon="pi pi-pencil" severity="secondary" outlined :disabled="busy" @click="openEdit" />
            <Button v-if="!tenant.archived" label="Archive" icon="pi pi-inbox" severity="secondary" outlined :disabled="busy || isCurrentTenant" :title="isCurrentTenant ? 'You can’t archive the tenant you’re signed in to' : undefined" @click="archiveOpen = true" />
            <Button v-else label="Restore" icon="pi pi-replay" severity="secondary" outlined :loading="busy" @click="saveTenant({ archived: false })" />
            <Button label="Invite users" icon="pi pi-user-plus" :disabled="tenant.archived" @click="openInvite" />
          </div>
        </section>

        <Message v-if="tenant.archived" severity="warn" :closable="false" class="mb-5">This tenant is archived. It is hidden from tenant lists and no one can sign in to it. Restore it to bring it back.</Message>

        <Message v-if="actionError" severity="error" :closable="false" class="mb-5">{{ actionError }}</Message>

        <section class="mb-5 flex items-center gap-5 rounded-2xl border border-[#e2e6ef] bg-white p-5 shadow-[0_10px_30px_rgba(30,41,75,.04)] max-[560px]:flex-col max-[560px]:items-start">
          <div class="relative grid h-20 w-40 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-[#d5dae6] bg-[#f6f7fb] text-[#8a93a5]">
            <TenantLogo v-if="tenant.logoUpdated" :tenant-id="tenant.id" :version="tenant.logoUpdated" :alt="`${tenant.name} logo`" img-class="absolute inset-0 h-full w-full object-contain p-2">
              <i class="pi pi-image text-2xl" />
            </TenantLogo>
            <i v-else class="pi pi-image text-2xl" />
          </div>
          <div class="grid gap-2">
            <div><h2 class="m-0 text-base">Logo</h2><p class="mt-1 mb-0 text-sm text-[#7d8698]">Shown in the app header and on the sign-in page. PNG, JPEG, GIF or WebP, up to {{ MAX_LOGO_BYTES / 1024 }} KB.</p></div>
            <div class="flex flex-wrap gap-2">
              <input ref="logoInput" type="file" :accept="LOGO_TYPES.join(',')" class="hidden" @change="chooseLogo">
              <Button :label="tenant.logoUpdated ? 'Replace logo' : 'Upload logo'" icon="pi pi-upload" severity="secondary" outlined size="small" :loading="busy" @click="logoInput?.click()" />
              <Button v-if="tenant.logoUpdated" label="Remove" icon="pi pi-trash" severity="danger" text size="small" :disabled="busy" @click="removeLogo" />
            </div>
          </div>
        </section>

        <section class="overflow-hidden rounded-2xl border border-[#e2e6ef] bg-white shadow-[0_12px_35px_rgba(30,41,75,.045)]">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[760px] border-collapse text-left">
              <thead class="bg-[#fafbfc] text-[.7rem] tracking-[.08em] text-[#7d8698] uppercase"><tr><th class="px-5 py-3.5">User</th><th class="px-4 py-3.5">Roles</th><th class="px-4 py-3.5">Status</th><th class="px-4 py-3.5">Last sign-in</th><th class="px-4 py-3.5" /></tr></thead>
              <tbody>
                <tr v-for="user in users" :key="user.id" class="border-t border-[#edf0f4]">
                  <td class="px-5 py-4">
                    <div class="flex items-center gap-3">
                      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" :style="{ background: userColor(user) }">{{ userInitials(user) }}</span>
                      <div>
                        <RouterLink v-if="isCurrentTenant" :to="`/users/${user.id}`" class="block text-sm font-bold hover:underline">{{ userName(user) }}</RouterLink>
                        <strong v-else class="block text-sm">{{ userName(user) }}</strong>
                        <span class="mt-1 block text-xs text-[#7d8698]">{{ user.email }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-4 text-sm font-semibold">{{ userRoleNames(user).join(', ') || '—' }}</td>
                  <td class="px-4 py-4"><Tag :value="userStatus(user)" :severity="statusSeverity(userStatus(user))" /></td>
                  <td class="px-4 py-4 text-sm text-[#697386]">{{ user.lastLogin ? formatTimestamp(user.lastLogin) : 'Never' }}</td>
                  <td class="px-4 py-4 text-right"><Button icon="pi pi-user-minus" severity="danger" text rounded aria-label="Remove from tenant" :disabled="busy || user.id === currentUserId" :title="user.id === currentUserId ? 'You can’t remove yourself' : 'Remove from tenant'" @click="removing = user" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!users.length" class="px-6 py-16 text-center"><strong class="block">No users yet</strong><p class="mt-1 text-sm text-[#858ea0]">Invite someone to get this tenant started.</p></div>
        </section>
        <p class="mt-3 text-xs text-[#858ea0]">Roles are managed from within each tenant by its admins<template v-if="!isCurrentTenant">; sign in to this tenant to change them</template>.</p>
      </template>

      <Dialog v-model:visible="editOpen" modal header="Edit tenant" :style="{ width: '30rem', maxWidth: 'calc(100vw - 2rem)' }">
        <form class="grid gap-4" @submit.prevent="saveEdit">
          <label class="grid gap-1 text-sm font-semibold">Name<InputText v-model="nameDraft" maxlength="45" autocomplete="off" required /></label>
          <label class="grid gap-1 text-sm font-semibold">Subdomain<InputText v-model="subdomainDraft" maxlength="63" autocomplete="off" spellcheck="false" required :invalid="Boolean(subdomainDraft) && !subdomainValid" /></label>
          <p class="m-0 text-xs text-[#7d8698]">Can differ from the name. Letters, numbers and dashes only; spaces become dashes. <template v-if="subdomainPreview && subdomainValid">Sign-in address: <strong class="font-mono">{{ subdomainPreview }}{{ appDomain ? `.${appDomain}` : '' }}</strong>. </template><template v-else-if="subdomainPreview">Not a valid subdomain. </template>Changing it changes the address people use, so update the DNS route to match.</p>
          <button type="submit" class="hidden" tabindex="-1" aria-hidden="true" />
        </form>
        <Message v-if="actionError" severity="error" :closable="false" class="mt-4">{{ actionError }}</Message>
        <template #footer>
          <Button label="Cancel" severity="secondary" text :disabled="busy" @click="editOpen = false" />
          <Button label="Save" icon="pi pi-check" :loading="busy" :disabled="!nameDraft.trim() || !subdomainValid || !edited" @click="saveEdit" />
        </template>
      </Dialog>

      <Dialog v-model:visible="archiveOpen" modal header="Archive this tenant?" :style="{ width: '30rem', maxWidth: 'calc(100vw - 2rem)' }">
        <p class="mt-0 leading-6 text-[#667085]"><strong>{{ tenant?.name }}</strong> will disappear from every tenant list and no one will be able to sign in to it; anyone signed in loses access immediately. Its data is kept, and you can restore it from the Archived filter on the tenants list.</p>
        <template #footer>
          <Button label="Cancel" severity="secondary" text :disabled="busy" @click="archiveOpen = false" />
          <Button label="Archive" icon="pi pi-inbox" severity="danger" :loading="busy" @click="saveTenant({ archived: true })" />
        </template>
      </Dialog>

      <Dialog v-model:visible="inviteOpen" modal header="Invite users" :style="{ width: '34rem', maxWidth: 'calc(100vw - 2rem)' }">
        <p class="mt-0 mb-3 text-sm leading-6 text-[#667085]">Enter up to 50 email addresses, separated by commas, spaces or new lines. Each person gets a link to register for <strong>{{ tenant?.name }}</strong>; people who already have an account are simply added when they accept. Links expire after a week.</p>
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

      <Dialog :visible="removing !== null" modal header="Remove from tenant?" :style="{ width: '30rem', maxWidth: 'calc(100vw - 2rem)' }" @update:visible="removing = null">
        <p class="mt-0 leading-6 text-[#667085]"><strong>{{ removing ? userName(removing) : '' }}</strong> will lose access to <strong>{{ tenant?.name }}</strong>, along with their roles and property links there. Their account and any other workspaces are kept.</p>
        <template #footer>
          <Button label="Cancel" severity="secondary" text :disabled="busy" @click="removing = null" />
          <Button label="Remove" icon="pi pi-user-minus" severity="danger" :loading="busy" @click="removeUser" />
        </template>
      </Dialog>
    </main>
  </div>
</template>
