<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import AppHeader from '../components/AppHeader.vue'
import { permissionOptions, propertyOptions, userRoles, users, userStatuses, type User, type UserStatus } from '../data/users'

const route = useRoute()
const router = useRouter()
const isNew = computed(() => route.params.id === 'new')
const existing = computed(() => users.value.find((item) => item.id === Number(route.params.id)))
const saved = ref(false)
const form = ref<User>(emptyUser())

function emptyUser(): User {
  return { id: 0, name: '', email: '', phone: '', role: 'Technician', status: 'Invited', title: '', initials: '', color: '#5962d8', lastActive: 'Invite pending', joined: new Date().toISOString().slice(0, 10), properties: [], permissions: ['Manage work orders'], activity: [] }
}

watch(existing, (value) => { form.value = value ? JSON.parse(JSON.stringify(value)) : emptyUser() }, { immediate: true })

const notFound = computed(() => !isNew.value && !existing.value)

function statusSeverity(status: UserStatus) {
  return status === 'Active' ? 'success' : status === 'Invited' ? 'warn' : 'secondary'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function saveUser() {
  if (!form.value.name.trim() || !form.value.email.trim()) return
  form.value.initials = form.value.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  if (isNew.value) {
    form.value.id = Math.max(...users.value.map((item) => item.id), 0) + 1
    users.value.push(JSON.parse(JSON.stringify(form.value)))
    router.replace(`/users/${form.value.id}`)
  } else {
    const index = users.value.findIndex((item) => item.id === form.value.id)
    if (index >= 0) users.value[index] = JSON.parse(JSON.stringify(form.value))
  }
  saved.value = true
  window.setTimeout(() => { saved.value = false }, 2200)
}

function deactivate() {
  form.value.status = form.value.status === 'Inactive' ? 'Active' : 'Inactive'
  saveUser()
}
</script>

<template>
  <div class="min-h-screen bg-[#f5f7fb]">
    <AppHeader />

    <main class="mx-auto w-[min(1180px,calc(100%-2rem))] py-[clamp(1.5rem,4vw,3rem)] max-[560px]:w-[calc(100%-1.25rem)]">
      <template v-if="notFound">
        <div class="rounded-2xl border border-[#e2e6ef] bg-white p-12 text-center"><i class="pi pi-user text-4xl text-[#a1a8b5]" /><h1>User not found</h1><p class="text-[#717b8f]">This user may have been removed.</p><Button label="Back to users" @click="router.push('/users')" /></div>
      </template>
      <template v-else>
        <RouterLink class="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#667085] hover:text-[#5962d8]" to="/users"><i class="pi pi-arrow-left" /> Back to users</RouterLink>
        <section class="mb-6 flex items-center justify-between gap-5 max-[680px]:items-start">
          <div class="flex items-center gap-4"><span class="grid h-16 w-16 shrink-0 place-items-center rounded-full text-xl font-bold text-white shadow-[0_8px_20px_rgba(30,41,75,.15)]" :style="{ background: form.color }">{{ form.initials || 'NU' }}</span><div><div class="flex items-center gap-2"><h1 class="m-0 text-[clamp(1.7rem,4vw,2.5rem)] tracking-[-.04em]">{{ isNew ? 'Invite a user' : form.name }}</h1><Tag v-if="!isNew" :value="form.status" :severity="statusSeverity(form.status)" /></div><p class="mt-1 mb-0 text-sm text-[#717b8f]">{{ isNew ? 'Add someone to your workspace' : `${form.title} · ${form.email}` }}</p></div></div>
          <div class="flex gap-2"><Button v-if="!isNew" :label="form.status === 'Inactive' ? 'Reactivate' : 'Deactivate'" severity="secondary" outlined class="max-[600px]:hidden" @click="deactivate" /><Button :label="isNew ? 'Send invitation' : 'Save changes'" icon="pi pi-check" @click="saveUser" /></div>
        </section>

        <Message v-if="saved" severity="success" :closable="false" class="mb-4">Changes saved successfully.</Message>
        <div class="grid grid-cols-[minmax(0,1.65fr)_minmax(280px,.8fr)] items-start gap-5 max-[850px]:grid-cols-1">
          <div class="grid gap-5">
            <section class="rounded-2xl border border-[#e2e6ef] bg-white p-6 shadow-[0_10px_30px_rgba(30,41,75,.04)]">
              <div class="mb-5"><h2 class="m-0 text-lg tracking-[-.02em]">Profile information</h2><p class="mt-1 mb-0 text-sm text-[#7d8698]">Basic contact and account details.</p></div>
              <div class="grid grid-cols-2 gap-5 max-[560px]:grid-cols-1">
                <label class="grid gap-2 text-sm font-semibold">Full name<InputText v-model="form.name" placeholder="Full name" /></label>
                <label class="grid gap-2 text-sm font-semibold">Job title<InputText v-model="form.title" placeholder="Job title" /></label>
                <label class="grid gap-2 text-sm font-semibold">Email address<InputText v-model="form.email" type="email" placeholder="name@company.com" /></label>
                <label class="grid gap-2 text-sm font-semibold">Phone number<InputText v-model="form.phone" placeholder="(000) 000-0000" /></label>
                <label class="grid gap-2 text-sm font-semibold">Role<Select v-model="form.role" :options="userRoles" /></label>
                <label class="grid gap-2 text-sm font-semibold">Account status<Select v-model="form.status" :options="userStatuses" /></label>
              </div>
            </section>

            <section class="rounded-2xl border border-[#e2e6ef] bg-white p-6 shadow-[0_10px_30px_rgba(30,41,75,.04)]">
              <div class="mb-5"><h2 class="m-0 text-lg tracking-[-.02em]">Property access</h2><p class="mt-1 mb-0 text-sm text-[#7d8698]">Choose which locations this user can view and manage.</p></div>
              <MultiSelect v-model="form.properties" :options="propertyOptions" display="chip" placeholder="Select properties" class="w-full" />
            </section>

            <section class="rounded-2xl border border-[#e2e6ef] bg-white p-6 shadow-[0_10px_30px_rgba(30,41,75,.04)]">
              <div class="mb-4"><h2 class="m-0 text-lg tracking-[-.02em]">Permissions</h2><p class="mt-1 mb-0 text-sm text-[#7d8698]">Fine-tune what this user can do.</p></div>
              <div class="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1"><label v-for="permission in permissionOptions" :key="permission" class="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e5e8ef] p-3.5 text-sm font-semibold hover:border-[#cdd1f8] hover:bg-[#fafaff]"><Checkbox v-model="form.permissions" :input-id="permission" :value="permission" /><span>{{ permission }}</span></label></div>
            </section>
          </div>

          <aside class="grid gap-5">
            <section v-if="!isNew" class="rounded-2xl border border-[#e2e6ef] bg-white p-5 shadow-[0_10px_30px_rgba(30,41,75,.04)]"><h2 class="mt-0 mb-4 text-base">Account</h2><dl class="m-0 grid gap-4 text-sm"><div><dt class="mb-1 text-xs font-bold tracking-[.06em] text-[#8a93a5] uppercase">Last active</dt><dd class="m-0 font-semibold">{{ form.lastActive }}</dd></div><div><dt class="mb-1 text-xs font-bold tracking-[.06em] text-[#8a93a5] uppercase">Member since</dt><dd class="m-0 font-semibold">{{ formatDate(form.joined) }}</dd></div><div><dt class="mb-1 text-xs font-bold tracking-[.06em] text-[#8a93a5] uppercase">User ID</dt><dd class="m-0 font-mono text-[#5962d8]">USR-{{ String(form.id).padStart(4, '0') }}</dd></div></dl></section>
            <section v-if="!isNew" class="rounded-2xl border border-[#e2e6ef] bg-white p-5 shadow-[0_10px_30px_rgba(30,41,75,.04)]"><h2 class="mt-0 mb-1 text-base">Recent activity</h2><p class="mt-0 mb-4 text-xs text-[#858ea0]">Latest actions in the workspace</p><div class="grid"><div v-for="item in form.activity" :key="item.id" class="grid grid-cols-[auto_1fr] gap-3 border-t border-[#edf0f4] py-4 first:border-0"><span class="grid h-8 w-8 place-items-center rounded-lg bg-[#eef0ff] text-xs text-[#5962d8]"><i :class="item.icon" /></span><div><strong class="block text-sm">{{ item.title }}</strong><p class="my-1 text-xs leading-relaxed text-[#737d90]">{{ item.detail }}</p><time class="text-[.7rem] text-[#9aa1ae]">{{ item.timestamp }}</time></div></div></div></section>
          </aside>
        </div>
      </template>
    </main>
  </div>
</template>
