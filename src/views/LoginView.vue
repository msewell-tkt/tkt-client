<template>
  <main class="grid min-h-screen grid-cols-1 bg-white min-[861px]:grid-cols-[minmax(380px,.9fr)_minmax(520px,1.1fr)]">
    <section class="relative hidden flex-col justify-center overflow-hidden bg-[radial-gradient(circle_at_10%_10%,#5b63d3_0,transparent_38%),linear-gradient(145deg,#10172b,#19244a_62%,#252e68)] p-[clamp(3rem,7vw,7rem)] text-white after:absolute after:right-[-10rem] after:bottom-[-12rem] after:h-[32rem] after:w-[32rem] after:rounded-full after:border after:border-white/12 after:content-[''] after:shadow-[0_0_0_5rem_rgba(255,255,255,.025),0_0_0_10rem_rgba(255,255,255,.02)] min-[861px]:flex">
      <img src="https://static.turnkeytracker.com/images/logo.png" alt="Turnkey Tracker" class="mb-7 block h-11 w-auto self-start object-contain" />
      <p class="mb-[.65rem] text-xs font-extrabold tracking-[.12em] text-[#aeb5ff] uppercase">Turnkey Tracker</p>
      <h1 class="m-0 max-w-[580px] text-[clamp(2.7rem,5vw,5rem)] leading-[.98] tracking-[-.055em]">Keep every detail moving.</h1>
      <p class="my-7 mb-10 max-w-[520px] text-[1.08rem] leading-7 text-[#c7cee8]">
        One calm workspace for your team, your properties, and the work that connects them.
      </p>
      <div class="grid gap-4 text-[.92rem] text-[#e5e9f8] [&_i]:mr-[.7rem] [&_i]:text-[#8de1ce]">
        <span><i class="pi pi-check-circle" /> Tenant-aware access</span>
        <span><i class="pi pi-check-circle" /> Secure session renewal</span>
        <span><i class="pi pi-check-circle" /> Clear operational overview</span>
      </div>
    </section>

    <section class="grid min-h-screen place-items-center bg-linear-to-br from-[#fafbfe] to-[#f1f3f9] p-4 min-[581px]:p-8 min-[861px]:min-h-0">
      <Card class="w-full max-w-[470px] rounded-[1.25rem] border border-[#e6e9f2] shadow-[0_25px_70px_rgba(21,30,59,.1)] [&_.p-card-body]:p-[clamp(1.5rem,4vw,2.6rem)]">
        <template #content>
          <TenantLogo v-if="tenantId && hostState !== 'unknown'" :tenant-id="tenantId" alt="Workspace logo" img-class="mb-6 block max-h-16 w-auto max-w-[14rem] object-contain" />
          <template v-if="hostState === 'unknown'">
            <div class="mb-6 grid h-12 w-12 place-items-center rounded-full bg-[#f0f2f7] text-[#7e8799]"><i class="pi pi-compass text-xl" /></div>
            <h2 class="m-0 text-[1.6rem] tracking-[-.035em]">We can’t find this workspace</h2>
            <p class="mt-[.7rem] mb-6 leading-6 text-[#697386]">There is no workspace at <strong class="font-mono">{{ hostName }}</strong>. Check the address you were given, or ask your administrator for the right link.</p>
            <div class="flex flex-wrap gap-3">
              <a :href="platformUrl()" class="inline-flex"><Button label="Go to Turnkey Tracker" icon="pi pi-arrow-right" icon-pos="right" severity="secondary" outlined /></a>
              <RouterLink :to="{ name: 'register-tenant' }" class="inline-flex"><Button label="Create a workspace" text /></RouterLink>
            </div>
          </template>
          <div v-else-if="hostState === 'checking'" class="grid place-items-center py-10"><ProgressSpinner stroke-width="4" class="!h-9 !w-9" aria-label="Checking this address" /></div>
          <template v-else>
          <div class="mb-8 flex items-center gap-[.8rem] min-[861px]:hidden">
            <img src="https://static.turnkeytracker.com/images/logo.png" alt="" class="block h-[2.2rem] w-auto object-contain" />
            <strong>Turnkey Tracker</strong>
          </div>
          <div>
            <p class="mb-[.65rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">Welcome back</p>
            <h2 class="m-0 text-[1.8rem] tracking-[-.035em]">{{ tenantChoices.length ? 'Choose a workspace' : pinRequested ? 'Check your email' : 'Sign in to your workspace' }}</h2>
            <p v-if="tenantChoices.length" class="mt-[.7rem] mb-[1.8rem] leading-6 text-[#697386]">Your account belongs to more than one workspace. Which would you like to use?</p>
            <p v-else-if="pinRequested" class="mt-[.7rem] mb-[1.8rem] leading-6 text-[#697386]">We sent a PIN to <strong>{{ email }}</strong>.</p>
            <p v-else class="mt-[.7rem] mb-[1.8rem] leading-6 text-[#697386]">Enter your email and we’ll send you a one-time PIN.</p>
          </div>

          <Message v-if="otherSessionTenant" severity="info" :closable="false" class="mb-4">This browser is signed in to <strong>{{ otherSessionTenant }}</strong>, a different workspace. Sign in below to use this one instead.</Message>
          <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

          <form v-if="tenantChoices.length" class="mt-5 grid gap-5" @submit.prevent="signIn()">
            <div class="grid gap-2" role="radiogroup" aria-label="Workspace">
              <label
                v-for="option in tenantChoices"
                :key="option.id"
                class="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e6e9f2] p-3 has-[:checked]:border-[#5b63d3] has-[:checked]:bg-[#f3f4ff]"
              >
                <input v-model="selectedTenantId" type="radio" name="tenant" :value="option.id" class="accent-[#5b63d3]" required />
                <span class="grid"><strong>{{ option.name }}</strong><span class="text-xs text-[#697386]">{{ option.subdomain }}</span></span>
              </label>
            </div>

            <Button type="submit" label="Continue" icon="pi pi-arrow-right" icon-pos="right" :loading="loading" :disabled="!selectedTenantId" fluid />
            <Button type="button" label="Back" severity="secondary" variant="text" size="small" @click="changeEmail" />
          </form>

          <form v-else-if="!pinRequested" class="mt-5 grid gap-5" @submit.prevent="sendPin">
            <div class="grid gap-2">
              <label class="text-sm font-bold text-[#323b50]" for="email">Email address</label>
              <InputText
                id="email"
                v-model.trim="email"
                type="email"
                autocomplete="email"
                placeholder="you@company.com"
                fluid
                required
              />
            </div>

            <Button type="submit" label="Email me a PIN" icon="pi pi-arrow-right" icon-pos="right" :loading="loading" fluid />
          </form>

          <form v-else class="mt-5 grid gap-5" @submit.prevent="verifyPin">
            <div class="grid gap-2">
              <label class="text-sm font-bold text-[#323b50]" for="pin">PIN</label>
              <Password
                input-id="pin"
                v-model="pin"
                :feedback="false"
                :toggle-mask="true"
                inputmode="numeric"
                autocomplete="one-time-code"
                placeholder="Enter the PIN from your email"
                fluid
                required
                autofocus
              />
            </div>

            <Button type="submit" label="Verify PIN" icon="pi pi-arrow-right" icon-pos="right" :loading="loading" fluid />
            <div class="flex justify-between gap-2">
              <Button type="button" label="Use a different email" severity="secondary" variant="text" size="small" @click="changeEmail" />
              <Button type="button" label="Resend PIN" severity="secondary" variant="text" size="small" :loading="resending" @click="resendPin" />
            </div>
          </form>

          <p class="mt-6 mb-0 text-center text-sm text-[#697386]">New here? <RouterLink class="font-semibold text-[#5962d8] hover:underline" :to="{ name: 'register-tenant' }">Create a workspace</RouterLink></p>

          <p class="mt-4 mb-0 text-center text-xs text-[#7a8498] [&_i]:mr-[.35rem] [&_i]:text-[#5b63d3]"><i class="pi pi-lock" /> Your refresh session is stored in a protected browser cookie.</p>
          </template>
        </template>
      </Card>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import ProgressSpinner from 'primevue/progressspinner'
import { auth, type TenantOption } from '../auth'
import TenantLogo from '../components/TenantLogo.vue'
import { hostLookupFailed, hostSubdomain, platformUrl, resolveHostTenant } from '../hostTenant'
import { loadSession, resetSession, sessionMatchesHost } from '../session'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const resending = ref(false)
const error = ref('')
// A registration link's follow-up arrives with the email filled in, and the PIN step open when one was emailed.
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const pin = ref('')
const pinRequested = ref(Boolean(email.value) && route.query.pinSent === '1')

// What this address is: no tenant (the app's own host, localhost), still being looked up, a tenant's, or one nobody
// uses. An unknown one is a dead end: no sign-in, and no other tenant's logo or remembered tenant is offered.
const hostState = ref<'none' | 'checking' | 'known' | 'unknown' | 'failed'>(hostSubdomain() ? 'checking' : 'none')
const hostName = window.location.hostname
// Set from the host's subdomain once the API has resolved it.
const hostTenantId = ref('')
// The tenant of a session this browser still holds, when it is not this address's tenant.
const otherSessionTenant = ref('')
onMounted(async () => {
  if (!hostSubdomain()) return
  const tenant = await resolveHostTenant()
  if (!tenant) {
    // A failed lookup falls back to the other tenant sources; sending a PIN reports a missing tenant.
    hostState.value = hostLookupFailed() ? 'failed' : 'unknown'
    return
  }
  hostState.value = 'known'
  hostTenantId.value = tenant.id
  if (auth.isAuthenticated.value && !(await sessionMatchesHost())) {
    otherSessionTenant.value = (await loadSession()).tenantName
  }
})

// Tenant comes from the login link (?tenantId=), then the redirect target's link, then the host's
// subdomain, then the tenant this browser last signed in to, then VITE_TENANT_ID for local development.
const tenantId = computed(() => {
  const direct = route.query.tenantId
  if (typeof direct === 'string' && direct) return direct

  const redirect = route.query.redirect
  if (typeof redirect === 'string') {
    const fromRedirect = new URL(redirect, window.location.origin).searchParams.get('tenantId')
    if (fromRedirect) return fromRedirect
  }

  return hostTenantId.value || (auth.lastTenantId() ?? '')
})

function requireTenantId(): string {
  if (!tenantId.value) throw new Error('This workspace link is missing its tenant ID.')
  return tenantId.value
}

async function sendPin() {
  loading.value = true
  error.value = ''
  try {
    await auth.requestPin({ email: email.value, tenantId: requireTenantId() })
    pinRequested.value = true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to send a PIN.'
  } finally {
    loading.value = false
  }
}

// Set when the PIN checks out for a user with several tenants; the user picks one to finish signing in.
const tenantChoices = ref<TenantOption[]>([])
const selectedTenantId = ref('')

async function verifyPin() {
  loading.value = true
  error.value = ''
  try {
    const choices = await auth.tenantChoices(email.value, pin.value)
    if (choices.length > 1) {
      tenantChoices.value = choices
      selectedTenantId.value = choices.find((choice) => choice.id === tenantId.value)?.id ?? ''
      return
    }
    await signIn(choices[0]?.id)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to sign in.'
  } finally {
    loading.value = false
  }
}

async function signIn(singleTenantId?: string) {
  loading.value = true
  error.value = ''
  try {
    const chosen = singleTenantId ?? (selectedTenantId.value || requireTenantId())
    await auth.login({ email: email.value, tenantId: chosen, pin: pin.value })
    resetSession()
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to sign in.'
  } finally {
    loading.value = false
  }
}

async function resendPin() {
  resending.value = true
  error.value = ''
  try {
    await auth.requestPin({ email: email.value, tenantId: requireTenantId() })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to resend the PIN.'
  } finally {
    resending.value = false
  }
}

function changeEmail() {
  tenantChoices.value = []
  selectedTenantId.value = ''
  pin.value = ''
  pinRequested.value = false
  error.value = ''
}
</script>
