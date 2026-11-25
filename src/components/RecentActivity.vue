<template>
  <Card class="border border-[#e4e7ee] shadow-[0_8px_28px_rgba(30,41,75,.045)]">
    <template #title>Recent activity</template>
    <template #subtitle>The latest work on your work orders</template>
    <template #content>
      <div v-if="loading" class="grid place-items-center py-10"><ProgressSpinner stroke-width="4" class="!h-9 !w-9" aria-label="Loading recent activity" /></div>
      <Message v-else-if="error" severity="error" :closable="false">{{ error }} <Button label="Try again" text size="small" @click="load" /></Message>
      <p v-else-if="!items.length" class="my-0 py-10 text-center text-sm text-[#7b8496]">No activity yet. Changes to work orders will show up here.</p>
      <div v-else class="grid">
        <component
          :is="item.workOrderId ? RouterLink : 'div'"
          v-for="item in items"
          :key="item.id"
          v-bind="item.workOrderId ? { to: { name: 'work-orders', query: { order: item.workOrderId } } } : {}"
          :class="['grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-[#edf0f5] py-4 last:border-0', item.workOrderId ? 'transition-colors hover:bg-[#f8f9fd]' : '']"
        >
          <span :class="['grid h-[2.4rem] w-[2.4rem] place-items-center rounded-[.7rem]', look(item.type).color]"><i :class="['pi', look(item.type).icon]" /></span>
          <div class="min-w-0"><strong class="text-[.9rem] wrap-anywhere">{{ item.summary }}</strong><p class="mt-1 mb-0 text-[.8rem] text-[#7b8496] wrap-anywhere">{{ detail(item) }}</p></div>
          <time class="text-xs whitespace-nowrap text-[#9299a7]" :datetime="item.created" :title="formatTimestamp(item.created)">{{ formatAge(item.created) }}</time>
        </component>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { activityService, type Activity } from '../services/ActivityService'
import { formatAge, formatTimestamp } from '../utils/workOrderFormat'

const BLUE = 'bg-[#eceeff] text-[#5962d8]'
const AMBER = 'bg-[#fff3d9] text-[#bb7914]'
const GREEN = 'bg-[#ddf7f0] text-[#148b75]'

const LOOKS: Record<string, { icon: string; color: string }> = {
  'work_order.created': { icon: 'pi-plus', color: BLUE },
  'work_order.status': { icon: 'pi-briefcase', color: GREEN },
  'job.added': { icon: 'pi-plus', color: BLUE },
  'job.status': { icon: 'pi-check', color: GREEN },
  'job.assigned': { icon: 'pi-user-plus', color: BLUE },
  'job.scheduled': { icon: 'pi-calendar', color: AMBER },
  'job.unscheduled': { icon: 'pi-calendar-times', color: AMBER },
  'job.note': { icon: 'pi-comment', color: AMBER },
  'job.attachment': { icon: 'pi-paperclip', color: AMBER },
}

/** An unknown type (a newer API) still gets a row. */
const look = (type: string) => LOOKS[type] ?? { icon: 'pi-file-edit', color: AMBER }

/** Who did it, and where. */
const detail = (item: Activity) => [item.userName, item.propertyName, item.unit ? `Unit ${item.unit}` : null].filter(Boolean).join(' · ')

const items = ref<Activity[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await activityService.recent()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Couldn’t load recent activity.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
