<template>
  <main class="grid min-h-screen place-items-center bg-linear-to-br from-[#fafbfe] to-[#f1f3f9] p-4 min-[581px]:p-8">
    <Card class="w-full max-w-[520px] rounded-[1.25rem] border border-[#e6e9f2] shadow-[0_25px_70px_rgba(21,30,59,.1)] [&_.p-card-body]:p-[clamp(1.5rem,4vw,2.6rem)]">
      <template #content>
        <div class="mb-8 flex items-center gap-[.8rem]">
          <img src="https://static.turnkeytracker.com/images/logo.png" alt="" class="h-[2.2rem] w-[2.2rem] object-contain" />
          <strong>Turnkey Tracker</strong>
        </div>

        <div v-if="loading" class="grid place-items-center py-10"><ProgressSpinner stroke-width="4" class="!h-10 !w-10" aria-label="Loading registration" /></div>

        <template v-else-if="loadError">
          <h2 class="m-0 text-[1.6rem] tracking-[-.035em]">Link unavailable</h2>
          <Message severity="error" :closable="false" class="mt-5">{{ loadError }}</Message>
          <RouterLink class="mt-5 inline-block text-sm font-semibold text-[#5962d8] hover:underline" :to="{ name: 'register-tenant' }">Create a workspace</RouterLink>
        </template>

        <template v-else-if="result">
          <p class="mb-[.65rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">You’re all set</p>
          <h2 class="m-0 text-[1.8rem] tracking-[-.035em]">{{ result.tenantName }} is ready</h2>
          <p v-if="result.existingUser" class="mt-[.7rem] mb-6 leading-6 text-[#697386]">Your existing account is now the administrator of this workspace. Sign in with a PIN to get started, then invite your team from the Users page.</p>
          <p v-else class="mt-[.7rem] mb-6 leading-6 text-[#697386]">We sent a PIN to <strong>{{ result.email }}</strong>. Enter it on the sign-in page, then invite your team from the Users page.</p>
          <Button :label="`Continue to ${loginHost(result.loginUrl)}`" icon="pi pi-arrow-right" icon-pos="right" fluid @click="goToLogin" />
        </template>

        <template v-else-if="registration">
          <p class="mb-[.65rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">Confirm your email</p>
          <h2 class="m-0 text-[1.8rem] tracking-[-.035em]">Create {{ registration.tenantName }}</h2>
          <p class="mt-[.7rem] mb-[1.8rem] leading-6 text-[#697386]">Confirming <strong>{{ registration.email }}</strong> creates your workspace and makes you its administrator.<template v-if="registration.existingUser"> You already have an account with this email, so it will be used.</template></p>
          <Message v-if="error" severity="error" :closable="false" class="mb-5">{{ error }}</Message>
          <Button label="Confirm and create workspace" icon="pi pi-check" :loading="submitting" fluid @click="confirm" />
        </template>
      </template>
    </Card>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { tenantRegistrationService, type TenantRegistrationResult, type TenantRegistrationView } from '../services/TenantRegistrationService'

const route = useRoute()
const token = typeof route.query.token === 'string' ? route.query.token : ''
const registration = ref<TenantRegistrationView | null>(null)
const result = ref<TenantRegistrationResult | null>(null)
const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    if (!token) throw new Error('This link is missing its token. Open the link from your confirmation email.')
    registration.value = await tenantRegistrationService.view(token)
  } catch (reason) {
    loadError.value = reason instanceof Error ? reason.message : 'Couldn’t load your registration.'
  } finally {
    loading.value = false
  }
})

// Confirming is a deliberate click, not something loading the page does, so mail scanners that open links can't use up the token.
async function confirm() {
  if (submitting.value) return
  submitting.value = true
  error.value = ''
  try {
    result.value = await tenantRegistrationService.verify(token)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to confirm your email.'
  } finally {
    submitting.value = false
  }
}

function loginHost(loginUrl: string) {
  return new URL(loginUrl).host
}

function goToLogin() {
  const done = result.value
  if (!done) return
  // The workspace now has its own subdomain, so leave this host: a full navigation, not a router push.
  const url = new URL(done.loginUrl)
  url.searchParams.set('tenantId', done.tenantId)
  url.searchParams.set('email', done.email)
  if (!done.existingUser) url.searchParams.set('pinSent', '1')
  window.location.assign(url.toString())
}
</script>
