<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import { inboxService, type InboxItem } from '../services/InboxService'
import { requestOrder } from '../services/inboxNavigation'
import { formatAge } from '../utils/workOrderFormat'

/** How often the badge is refreshed while the page is in view. */
const POLL_MS = 30_000

const route = useRoute()
const router = useRouter()
const open = ref(false)
const unread = ref(0)
const items = ref<InboxItem[]>([])
const loading = ref(false)
const error = ref('')
let timer: number | undefined

const label = computed(() => (unread.value > 0 ? `Inbox, ${unread.value} unread` : 'Inbox'))

const ICONS: Record<string, string> = {
  'message.reply': 'pi-comments',
  'job.declined': 'pi-times-circle',
  'job.extra': 'pi-plus-circle',
}
const TITLES: Record<string, string> = {
  'message.reply': 'Reply',
  'job.declined': 'Job declined',
  'job.extra': 'Extra added',
}

async function refreshCount() {
  try {
    unread.value = await inboxService.unread()
  } catch {
    // Keep the last count; the next poll tries again.
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await inboxService.items()
    unread.value = items.value.filter((item) => item.unread).length
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Couldn’t load the inbox.'
  } finally {
    loading.value = false
  }
}

function poll() {
  if (document.visibilityState !== 'visible') return
  if (open.value) void load()
  else void refreshCount()
}

onMounted(() => {
  void refreshCount()
  timer = window.setInterval(poll, POLL_MS)
  document.addEventListener('visibilitychange', poll)
})
onBeforeUnmount(() => {
  window.clearInterval(timer)
  document.removeEventListener('visibilitychange', poll)
})

watch(open, async (isOpen) => {
  if (isOpen) {
    await load()
    return
  }
  // Closing the panel is reading it: what was highlighted while it was open no longer is.
  if (unread.value > 0) {
    try {
      await inboxService.markRead()
      unread.value = 0
      items.value = items.value.map((item) => ({ ...item, unread: false }))
    } catch {
      // Stays unread; it will be offered again.
    }
  }
})

/** A reply goes to that technician's page (the conversation is there); a job event shows its work order. */
function go(item: InboxItem) {
  if (item.type === 'message.reply') {
    void router.push({ name: 'user-detail', params: { id: item.userId } })
  } else if (item.workOrderId) {
    if (route.name === 'scheduler' || route.name === 'work-orders') requestOrder(item.workOrderId)
    else void router.push({ name: 'work-orders', query: { order: item.workOrderId } })
  }
}

const canOpen = (item: InboxItem) => item.type === 'message.reply' || Boolean(item.workOrderId)
</script>

<template>
  <div class="relative shrink-0">
    <Button type="button" severity="secondary" text rounded :aria-label="label" :aria-expanded="open" @click="open = !open">
      <i class="pi pi-bell text-lg" />
      <span
        v-if="unread > 0"
        class="absolute -top-0.5 -right-0.5 grid min-w-[1.15rem] place-items-center rounded-full bg-[#d52d38] px-1 text-[.65rem] leading-[1.15rem] font-bold text-white"
        aria-hidden="true"
      >{{ unread > 99 ? '99+' : unread }}</span>
    </Button>

    <!-- Not modal: the page behind stays usable, so the scheduler can be worked while the inbox is open. -->
    <Drawer v-model:visible="open" position="right" :modal="false" :dismissable="false" :block-scroll="false" header="Inbox" :style="{ width: '24rem', maxWidth: '100vw' }">
      <p v-if="error" class="m-0 text-sm text-[#c0352f]" role="alert">{{ error }}</p>
      <p v-else-if="!items.length && !loading" class="m-0 text-sm text-[#7d8698]">Nothing from the field yet. Replies, declined jobs and extras added by technicians show up here.</p>
      <ol v-else class="m-0 grid list-none gap-2 p-0">
        <li v-for="item in items" :key="item.id">
          <component
            :is="canOpen(item) ? 'button' : 'div'"
            :type="canOpen(item) ? 'button' : undefined"
            class="grid w-full grid-cols-[auto_1fr] gap-3 rounded-xl border px-3 py-3 text-left text-inherit"
            :class="[item.unread ? 'border-[#cfe0ff] bg-[#f1f6ff]' : 'border-[#e2e6ef] bg-white', canOpen(item) ? 'cursor-pointer hover:bg-[#fafbff]' : '']"
            @click="canOpen(item) && go(item)"
          >
            <i :class="['pi mt-1', ICONS[item.type] ?? 'pi-info-circle', item.type === 'job.declined' ? 'text-[#d52d38]' : 'text-[#5962d8]']" />
            <span class="min-w-0">
              <span class="flex items-baseline justify-between gap-2">
                <span class="text-xs font-bold tracking-[.04em] text-[#8a93a5] uppercase">{{ TITLES[item.type] ?? 'Update' }}</span>
                <span class="shrink-0 text-xs text-[#8a93a5]">{{ formatAge(item.created) }}</span>
              </span>
              <span class="mt-1 block text-sm break-words text-[#1e2a44]">{{ item.summary }}</span>
              <span v-if="item.propertyName" class="mt-1 block text-xs text-[#7d8698]">{{ item.propertyName }}<template v-if="item.unit"> · Unit {{ item.unit }}</template></span>
            </span>
          </component>
        </li>
      </ol>
    </Drawer>
  </div>
</template>
