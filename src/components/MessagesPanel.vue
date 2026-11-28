<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { messageService, PAGE_SIZE, type JobChoice, type Message as ChatMessage } from '../services/MessageService'
import { userName, type User } from '../services/User'

/** The conversation with one technician or QA user: what office staff wrote, their answers, photos both ways. */
const props = defineProps<{ user: User }>()

const messages = ref<ChatMessage[]>([])
const jobs = ref<JobChoice[]>([])
const loading = ref(true)
const sending = ref(false)
const error = ref('')
const draft = ref('')
const jobId = ref<string | null>(null)
const images = ref<File[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const list = ref<HTMLOListElement | null>(null)
/** True while the conversation may go back further than what is shown. */
const hasOlder = ref(false)
const loadingOlder = ref(false)

const jobOptions = computed(() =>
  jobs.value.map((job) => ({
    id: job.id,
    label: ['Job ' + (job.num ?? ''), job.propertyName, job.unit ? 'Unit ' + job.unit : null].filter(Boolean).join(' · '),
  })),
)

function formatTime(value: number | string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function authorName(message: ChatMessage) {
  return message.author ? [message.author.firstName, message.author.lastName].filter(Boolean).join(' ') : ''
}

/** True for what the user themselves wrote, shown on the other side. */
const fromUser = (message: ChatMessage) => message.author?.id === props.user.id

/**
 * Takes in the latest page. Older messages already loaded stay when the page joins on to them; when so much has
 * arrived that it doesn't, they are dropped rather than leave a hole in the conversation.
 */
function showLatest(page: ChatMessage[]) {
  const join = messages.value.findIndex((message) => message.id === page[0]?.id)
  if (join >= 0) {
    messages.value = [...messages.value.slice(0, join), ...page]
  } else {
    messages.value = page
    hasOlder.value = page.length >= PAGE_SIZE
  }
}

async function scrollToNewest() {
  await nextTick()
  if (list.value) list.value.scrollTop = list.value.scrollHeight
}

async function load() {
  try {
    const [page, choices] = await Promise.all([messageService.thread(props.user.id), messageService.jobs(props.user.id)])
    showLatest(page)
    jobs.value = choices
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Couldn’t load the messages.'
  } finally {
    loading.value = false
    await scrollToNewest()
  }
}

async function loadOlder() {
  const oldest = messages.value[0]?.id
  if (!oldest || loadingOlder.value) return
  loadingOlder.value = true
  error.value = ''
  try {
    const page = await messageService.thread(props.user.id, oldest)
    // The list was replaced meanwhile, so this page no longer joins on to it.
    if (messages.value[0]?.id !== oldest) return
    // Keep what was being read where it is: the distance from the end doesn't change.
    const fromEnd = list.value ? list.value.scrollHeight - list.value.scrollTop : 0
    const older = page.filter((message) => !messages.value.some((shown) => shown.id === message.id))
    messages.value = [...older, ...messages.value]
    hasOlder.value = older.length > 0 && page.length >= PAGE_SIZE
    await nextTick()
    if (list.value) list.value.scrollTop = list.value.scrollHeight - fromEnd
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Couldn’t load older messages.'
  } finally {
    loadingOlder.value = false
  }
}

function pick(event: Event) {
  const input = event.target as HTMLInputElement
  images.value = [...images.value, ...Array.from(input.files ?? [])]
  input.value = ''
}

async function send() {
  if (sending.value) return
  if (!draft.value.trim()) {
    error.value = 'Type a message first.'
    return
  }
  sending.value = true
  error.value = ''
  try {
    await messageService.send(props.user.id, draft.value, jobId.value, images.value)
    draft.value = ''
    images.value = []
    jobId.value = null
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Couldn’t send the message.'
  } finally {
    sending.value = false
    try {
      showLatest(await messageService.thread(props.user.id))
      await scrollToNewest()
    } catch {
      // keep what is on screen; the error above, if any, is already shown
    }
  }
}

onMounted(load)
</script>

<template>
  <section class="rounded-2xl border border-[#e2e6ef] bg-white p-6 shadow-[0_10px_30px_rgba(30,41,75,.04)]">
    <div class="mb-4">
      <h2 class="m-0 text-lg tracking-[-.02em]">Messages</h2>
      <p class="mt-1 mb-0 text-sm text-[#7d8698]">Write to {{ userName(user) }} in the app. A message about a job is also added to that job’s notes and photos.</p>
    </div>

    <div v-if="loading" class="grid place-items-center py-8"><ProgressSpinner stroke-width="4" class="!h-8 !w-8" aria-label="Loading messages" /></div>
    <div v-else class="grid gap-3">
      <p v-if="!messages.length" class="m-0 text-sm text-[#7d8698]">No messages yet.</p>
      <ol v-else ref="list" class="m-0 grid max-h-96 list-none gap-2 overflow-y-auto p-0 [overflow-anchor:none]">
        <li v-if="hasOlder" class="flex justify-center">
          <Button type="button" label="Load older messages" severity="secondary" text size="small" :loading="loadingOlder" :disabled="loadingOlder" @click="loadOlder" />
        </li>
        <li v-for="message in messages" :key="message.id" class="flex" :class="fromUser(message) ? 'justify-start' : 'justify-end'">
          <div class="max-w-[85%] rounded-2xl border px-3 py-2 text-sm" :class="fromUser(message) ? 'border-[#e2e6ef] bg-white' : 'border-[#cfe0ff] bg-[#e8f0ff]'">
            <p v-if="fromUser(message)" class="m-0 mb-1 text-xs font-bold text-[#0759d9]">{{ authorName(message) }}</p>
            <p v-if="message.jobId" class="m-0 mb-1 text-xs font-bold text-[#0759d9]">Job {{ message.jobNum }}</p>
            <p class="m-0 break-words whitespace-pre-wrap">{{ message.data }}</p>
            <a v-for="photo in message.attachments" :key="photo.id" :href="photo.data" target="_blank" rel="noopener">
              <img :src="photo.data" alt="Message photo" loading="lazy" decoding="async" class="mt-2 h-48 w-64 max-w-full rounded-lg bg-[#eef1f6] object-contain" />
            </a>
            <p class="m-0 mt-1 text-[11px] text-[#8a93a5]">{{ formatTime(message.created) }}</p>
          </div>
        </li>
      </ol>

      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

      <form class="grid gap-3" @submit.prevent="send">
        <Textarea v-model="draft" rows="3" auto-resize maxlength="4000" placeholder="Write a message..." :disabled="sending" aria-label="Message" />
        <Select v-model="jobId" :options="jobOptions" option-label="label" option-value="id" show-clear placeholder="About a job (optional)" class="w-full" :disabled="sending" />
        <div v-if="images.length" class="flex flex-wrap gap-2">
          <span v-for="(file, index) in images" :key="index" class="inline-flex items-center gap-2 rounded-full bg-[#eef1f6] px-3 py-1 text-xs">
            {{ file.name }}
            <button type="button" class="cursor-pointer border-0 bg-transparent p-0" :aria-label="`Remove ${file.name}`" @click="images.splice(index, 1)"><i class="pi pi-times" /></button>
          </span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple class="hidden" @change="pick" />
          <Button type="button" label="Add photos" icon="pi pi-image" severity="secondary" outlined :disabled="sending" @click="fileInput?.click()" />
          <Button type="submit" label="Send" icon="pi pi-send" :loading="sending" :disabled="sending" />
        </div>
      </form>
    </div>
  </section>
</template>
