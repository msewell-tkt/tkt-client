<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import AppHeader from '../components/AppHeader.vue'
import { tenantService, type TenantDetail } from '../services/TenantService'
import { formatTimestamp } from '../utils/workOrderFormat'

const router = useRouter()
const tenants = ref<TenantDetail[]>([])
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const showArchived = ref(false)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    tenants.value = await tenantService.list(showArchived.value)
  } catch (reason) {
    loadError.value = reason instanceof Error ? reason.message : 'Couldn’t load workspaces.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(showArchived, load)

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return tenants.value.filter((tenant) => !term || `${tenant.name} ${tenant.subdomain ?? ''}`.toLowerCase().includes(term))
})
const totalUsers = computed(() => tenants.value.reduce((sum, tenant) => sum + tenant.userCount, 0))
</script>

<template>
  <div class="min-h-screen bg-[#f5f7fb]">
    <AppHeader />

    <main class="mx-auto w-[min(1320px,calc(100%-2rem))] py-[clamp(1.5rem,4vw,3rem)] max-[560px]:w-[calc(100%-1.25rem)]">
      <section class="mb-7">
        <p class="mb-[.45rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">Platform administration</p>
        <h1 class="m-0 text-[clamp(2rem,4vw,3rem)] leading-none tracking-[-.05em]">Tenants</h1>
        <p class="mt-3 mb-0 text-[#717b8f] max-[580px]:hidden">Every workspace on the platform, and the people in each.</p>
      </section>

      <Message v-if="loadError" severity="error" :closable="false" class="mb-5">{{ loadError }} <Button label="Try again" text size="small" @click="load" /></Message>
      <div v-else-if="loading" class="grid place-items-center py-16"><ProgressSpinner stroke-width="4" class="!h-10 !w-10" aria-label="Loading tenants" /></div>

      <template v-else>
        <section class="mb-5 grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
          <div class="flex items-center gap-3 rounded-2xl border border-[#e2e6ef] bg-white p-4"><span class="grid h-10 w-10 place-items-center rounded-xl bg-[#eceeff] text-[#5962d8]"><i class="pi pi-sitemap" /></span><div><strong class="block text-xl tracking-[-.03em]">{{ tenants.length }}</strong><small class="text-[#7d8698]">{{ showArchived ? 'Archived tenants' : 'Tenants' }}</small></div></div>
          <div class="flex items-center gap-3 rounded-2xl border border-[#e2e6ef] bg-white p-4"><span class="grid h-10 w-10 place-items-center rounded-xl bg-[#e2f7f1] text-[#0f9279]"><i class="pi pi-users" /></span><div><strong class="block text-xl tracking-[-.03em]">{{ totalUsers }}</strong><small class="text-[#7d8698]">Active memberships</small></div></div>
        </section>

        <section class="overflow-hidden rounded-2xl border border-[#e2e6ef] bg-white shadow-[0_12px_35px_rgba(30,41,75,.045)]">
          <div class="flex items-center justify-between gap-3 border-b border-[#e8ebf1] px-5 py-4 max-[560px]:flex-col max-[560px]:items-stretch">
            <div class="relative w-full max-w-[430px]">
              <i class="pi pi-search absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-[#8a93a5]" />
              <InputText v-model="search" class="w-full !pl-10" placeholder="Search tenants…" />
            </div>
            <label class="flex items-center gap-2 text-sm font-semibold"><Checkbox v-model="showArchived" binary input-id="show-archived" />Archived</label>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full min-w-[640px] border-collapse text-left">
              <thead class="bg-[#fafbfc] text-[.7rem] tracking-[.08em] text-[#7d8698] uppercase"><tr><th class="px-5 py-3.5">Tenant</th><th class="px-4 py-3.5">Subdomain</th><th class="px-4 py-3.5">Users</th><th class="px-4 py-3.5">Created</th><th class="w-12 px-4 py-3.5" /></tr></thead>
              <tbody>
                <tr v-for="tenant in filtered" :key="tenant.id" class="cursor-pointer border-t border-[#edf0f4] transition-colors hover:bg-[#f8f9fd]" @click="router.push(`/tenants/${tenant.id}`)">
                  <td class="px-5 py-4"><div class="flex items-center gap-3"><span class="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#e6e9f2] bg-[#f6f7fb] text-[#8a93a5]"><img v-if="tenant.logoUpdated" :src="tenantService.logoUrl(tenant.id, tenant.logoUpdated)" alt="" class="h-full w-full object-contain"><i v-else class="pi pi-building text-sm" /></span><strong class="text-sm">{{ tenant.name }}</strong><Tag v-if="tenant.archived" value="Archived" severity="secondary" /></div></td>
                  <td class="px-4 py-4 font-mono text-sm text-[#5f687b]">{{ tenant.subdomain || '—' }}</td>
                  <td class="px-4 py-4 text-sm">{{ tenant.userCount }}</td>
                  <td class="px-4 py-4 text-sm text-[#697386]">{{ formatTimestamp(tenant.created ?? null) }}</td>
                  <td class="px-4 py-4"><Button icon="pi pi-chevron-right" severity="secondary" text rounded aria-label="View tenant" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!filtered.length" class="px-6 py-16 text-center"><strong class="block">No tenants found</strong><p class="mt-1 text-sm text-[#858ea0]">{{ showArchived ? 'No tenants are archived.' : 'Try changing your search.' }}</p></div>
          <div class="border-t border-[#e8ebf1] px-5 py-3 text-xs text-[#858ea0]">Showing {{ filtered.length }} of {{ tenants.length }} {{ showArchived ? 'archived tenants' : 'tenants' }}</div>
        </section>
      </template>
    </main>
  </div>
</template>
