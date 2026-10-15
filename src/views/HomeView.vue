<template>
  <div class="min-h-screen bg-[#f4f6fa]">
    <AppHeader />

    <main class="mx-auto w-[min(1180px,calc(100%-2rem))] py-[clamp(2rem,5vw,4rem)]">
      <section v-if="loading" class="grid min-h-[50vh] content-center justify-items-center gap-4 text-[#697386]">
        <ProgressSpinner stroke-width="4" />
        <p>Loading your workspace…</p>
      </section>

      <template v-else-if="session">
        <section class="mb-8 flex items-end justify-between gap-8 max-[580px]:flex-col max-[580px]:items-stretch">
          <div>
            <p class="mb-[.65rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">Workspace overview</p>
            <h1 class="m-0 text-[clamp(2rem,4vw,3.2rem)] tracking-[-.05em]">Good to see you.</h1>
            <p class="mt-[.6rem] mb-0 text-[#697386]">{{ session.email }}</p>
          </div>
          <div class="flex items-stretch gap-3 max-[580px]:flex-col">
            <RouterLink class="flex max-[580px]:[&_.p-button]:w-full" to="/scheduler">
              <Button icon="pi pi-calendar" label="Open scheduler" size="large" />
            </RouterLink>
            <div class="min-w-[180px] rounded-[.9rem] border border-[#e0e4ed] bg-white px-5 py-4 max-[580px]:w-full">
              <span class="mb-[.35rem] block text-[.7rem] font-extrabold tracking-[.1em] text-[#7a8498] uppercase">Tenant</span>
              <strong class="font-mono">{{ session.tenantName }}</strong>
            </div>
          </div>
        </section>

        <section class="grid grid-cols-3 gap-4 max-[860px]:grid-cols-1">
          <Card class="border border-[#e4e7ee] shadow-[0_8px_28px_rgba(30,41,75,.045)] [&_.p-card-content]:relative [&_.p-card-content]:grid [&_.p-card-content]:gap-[.35rem] [&_.p-card-content>span]:text-[.83rem] [&_.p-card-content>span]:font-semibold [&_.p-card-content>span]:text-[#70798c] [&_.p-card-content>strong]:text-[2rem] [&_.p-card-content>strong]:tracking-[-.04em] [&_.p-card-content>small]:text-[#8991a1]">
            <template #content>
              <div class="absolute top-0 right-0 grid h-10 w-10 place-items-center rounded-xl bg-[#eceeff] text-[#5962d8]"><i class="pi pi-building" /></div>
              <span>Active properties</span><strong>{{session.activeProperties}}</strong><small><i class="pi pi-arrow-up text-[#0f9f82]" /> {{session.activePropertiesThisMonth}} this month</small>
            </template>
          </Card>
          <Card class="border border-[#e4e7ee] shadow-[0_8px_28px_rgba(30,41,75,.045)] [&_.p-card-content]:relative [&_.p-card-content]:grid [&_.p-card-content]:gap-[.35rem] [&_.p-card-content>span]:text-[.83rem] [&_.p-card-content>span]:font-semibold [&_.p-card-content>span]:text-[#70798c] [&_.p-card-content>strong]:text-[2rem] [&_.p-card-content>strong]:tracking-[-.04em] [&_.p-card-content>small]:text-[#8991a1]">
            <template #content>
              <div class="absolute top-0 right-0 grid h-10 w-10 place-items-center rounded-xl bg-[#fff3d9] text-[#bb7914]"><i class="pi pi-wrench" /></div>
              <span>Open jobs</span><strong>{{session.openJobs}}</strong><small>Across your properties</small>
            </template>
          </Card>
          <Card class="border border-[#e4e7ee] shadow-[0_8px_28px_rgba(30,41,75,.045)] [&_.p-card-content]:relative [&_.p-card-content]:grid [&_.p-card-content]:gap-[.35rem] [&_.p-card-content>span]:text-[.83rem] [&_.p-card-content>span]:font-semibold [&_.p-card-content>span]:text-[#70798c] [&_.p-card-content>strong]:text-[2rem] [&_.p-card-content>strong]:tracking-[-.04em] [&_.p-card-content>small]:text-[#8991a1]">
            <template #content>
              <div class="absolute top-0 right-0 grid h-10 w-10 place-items-center rounded-xl bg-[#ddf7f0] text-[#148b75]"><i class="pi pi-check-circle" /></div>
              <span>Completed this week</span><strong>{{session.completedJobsThisWeek}}</strong><small>This week</small>
            </template>
          </Card>
        </section>

        <section class="mt-4 grid grid-cols-[1.35fr_.85fr] gap-4 max-[860px]:grid-cols-1">
          <Card class="border border-[#e4e7ee] shadow-[0_8px_28px_rgba(30,41,75,.045)]">
            <template #title><span class="flex items-center justify-between gap-3">Recent activity <Tag value="Sample data" severity="secondary" icon="pi pi-info-circle" /></span></template>
            <template #subtitle>Activity isn’t available from the API yet</template>
            <template #content>
              <div class="grid">
                <div v-for="item in activity" :key="item.title" class="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-[#edf0f5] py-4 last:border-0">
                  <span :class="['grid h-[2.4rem] w-[2.4rem] place-items-center rounded-[.7rem]', item.color]"><i :class="item.icon" /></span>
                  <div><strong class="text-[.9rem]">{{ item.title }}</strong><p class="mt-1 mb-0 text-[.8rem] text-[#7b8496]">{{ item.detail }}</p></div>
                  <time class="text-xs text-[#9299a7]">{{ item.time }}</time>
                </div>
              </div>
            </template>
          </Card>

          <Card class="border border-[#e4e7ee] shadow-[0_8px_28px_rgba(30,41,75,.045)]">
            <template #title>Current access</template>
            <template #subtitle>Permissions attached to this session</template>
            <template #content>
              <div class="mb-4 grid gap-[.35rem] [&>span]:text-xs [&>span]:font-bold [&>span]:tracking-[.07em] [&>span]:text-[#7b8496] [&>span]:uppercase [&>strong]:wrap-anywhere"><span>Email</span><strong>{{ session.email }}</strong></div>
              <div class="mb-4 grid gap-[.35rem] [&>span]:text-xs [&>span]:font-bold [&>span]:tracking-[.07em] [&>span]:text-[#7b8496] [&>span]:uppercase [&>code]:wrap-anywhere"><span>Tenant</span><code>{{ session.tenantName }}</code></div>
              <Divider />
              <p class="text-xs font-bold tracking-[.07em] text-[#7b8496] uppercase">Roles</p>
              <div class="flex flex-wrap gap-2">
                <Tag v-for="role in session.roles" :key="role" :value="role" severity="info" />
              </div>
            </template>
          </Card>
        </section>
      </template>

      <Message v-else severity="error" :closable="false">{{ loadError || 'Unable to load your session.' }}</Message>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'
import AppHeader from '../components/AppHeader.vue'
import { dashboardService, type Session } from '../services/DashboardService'

const loading = ref(true)
const session = ref<Session | null>(null)
const loadError = ref('')

const activity = [
  { icon: 'pi pi-check', color: 'bg-[#ddf7f0] text-[#148b75]', title: 'Inspection completed', detail: 'Riverside unit 4B', time: '12 min' },
  { icon: 'pi pi-user-plus', color: 'bg-[#eceeff] text-[#5962d8]', title: 'Team member assigned', detail: 'Oak Street turnover', time: '1 hr' },
  { icon: 'pi pi-file-edit', color: 'bg-[#fff3d9] text-[#bb7914]', title: 'Work order updated', detail: 'Heating service · #1842', time: '3 hrs' },
]

onMounted(async () => {
  try {
    session.value = await dashboardService.load()
  } catch (reason) {
    loadError.value = reason instanceof Error ? reason.message : ''
  } finally {
    loading.value = false
  }
})

</script>
