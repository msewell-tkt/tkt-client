<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import AppHeader from '../components/AppHeader.vue'
import { userRoles, userStatuses, users, type UserRole, type UserStatus } from '../data/users'

const router = useRouter()
const search = ref('')
const roleFilter = ref<'All roles' | UserRole>('All roles')
const statusFilter = ref<'All statuses' | UserStatus>('All statuses')
const roles: Array<'All roles' | UserRole> = ['All roles', ...userRoles]
const statuses: Array<'All statuses' | UserStatus> = ['All statuses', ...userStatuses]

const filteredUsers = computed(() => {
  const term = search.value.trim().toLowerCase()
  return users.value.filter((user) => {
    const matchesTerm = !term || `${user.name} ${user.email} ${user.title} ${user.role}`.toLowerCase().includes(term)
    const matchesRole = roleFilter.value === 'All roles' || user.role === roleFilter.value
    const matchesStatus = statusFilter.value === 'All statuses' || user.status === statusFilter.value
    return matchesTerm && matchesRole && matchesStatus
  })
})

const activeCount = computed(() => users.value.filter((user) => user.status === 'Active').length)
const inviteCount = computed(() => users.value.filter((user) => user.status === 'Invited').length)
const adminCount = computed(() => users.value.filter((user) => user.role === 'Admin').length)

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
        <Button icon="pi pi-user-plus" label="Invite user" size="large" @click="router.push('/users/new')" />
      </section>

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
            <thead class="bg-[#fafbfc] text-[.7rem] tracking-[.08em] text-[#7d8698] uppercase"><tr><th class="px-5 py-3.5">User</th><th class="px-4 py-3.5">Role</th><th class="px-4 py-3.5">Access</th><th class="px-4 py-3.5">Status</th><th class="px-4 py-3.5">Last active</th><th class="w-12 px-4 py-3.5" /></tr></thead>
            <tbody>
              <tr v-for="user in filteredUsers" :key="user.id" class="cursor-pointer border-t border-[#edf0f4] transition-colors hover:bg-[#f8f9fd]" @click="router.push(`/users/${user.id}`)">
                <td class="px-5 py-4"><div class="flex items-center gap-3"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" :style="{ background: user.color }">{{ user.initials }}</span><div><strong class="block text-sm">{{ user.name }}</strong><span class="mt-1 block text-xs text-[#7d8698]">{{ user.email }}</span></div></div></td>
                <td class="px-4 py-4"><strong class="text-sm font-semibold">{{ user.role }}</strong><span class="mt-1 block text-xs text-[#8991a1]">{{ user.title }}</span></td>
                <td class="px-4 py-4 text-sm text-[#5f687b]">{{ user.properties[0] === 'All properties' ? 'All properties' : `${user.properties.length} ${user.properties.length === 1 ? 'property' : 'properties'}` }}</td>
                <td class="px-4 py-4"><Tag :value="user.status" :severity="statusSeverity(user.status)" /></td>
                <td class="px-4 py-4 text-sm text-[#697386]">{{ user.lastActive }}</td>
                <td class="px-4 py-4"><Button icon="pi pi-chevron-right" severity="secondary" text rounded aria-label="View user" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!filteredUsers.length" class="px-6 py-16 text-center"><span class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f0f2f7] text-[#7e8799]"><i class="pi pi-search" /></span><strong class="mt-4 block">No users found</strong><p class="mt-1 text-sm text-[#858ea0]">Try changing your search or filters.</p></div>
        <div class="border-t border-[#e8ebf1] px-5 py-3 text-xs text-[#858ea0]">Showing {{ filteredUsers.length }} of {{ users.length }} users</div>
      </section>
    </main>
  </div>
</template>
