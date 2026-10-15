<template>
  <main class="grid min-h-screen grid-cols-1 bg-white min-[861px]:grid-cols-[minmax(380px,.9fr)_minmax(520px,1.1fr)]">
    <section class="relative hidden flex-col justify-center overflow-hidden bg-[radial-gradient(circle_at_10%_10%,#5b63d3_0,transparent_38%),linear-gradient(145deg,#10172b,#19244a_62%,#252e68)] p-[clamp(3rem,7vw,7rem)] text-white after:absolute after:right-[-10rem] after:bottom-[-12rem] after:h-[32rem] after:w-[32rem] after:rounded-full after:border after:border-white/12 after:content-[''] after:shadow-[0_0_0_5rem_rgba(255,255,255,.025),0_0_0_10rem_rgba(255,255,255,.02)] min-[861px]:flex">
      <div class="mb-7 grid h-11 w-11 place-items-center rounded-[.85rem] bg-[#6972ea] text-white shadow-[0_12px_30px_rgba(71,80,190,.35)]"><i class="pi pi-bolt" /></div>
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
          <div class="mb-8 flex items-center gap-[.8rem] min-[861px]:hidden">
            <div class="grid h-[2.2rem] w-[2.2rem] place-items-center rounded-[.85rem] bg-[#6972ea] text-white shadow-[0_12px_30px_rgba(71,80,190,.35)]"><i class="pi pi-bolt" /></div>
            <strong>Turnkey Tracker</strong>
          </div>
          <div>
            <p class="mb-[.65rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">Welcome back</p>
            <h2 class="m-0 text-[1.8rem] tracking-[-.035em]">{{ pinRequested ? 'Check your email' : 'Sign in to your workspace' }}</h2>
            <p v-if="pinRequested" class="mt-[.7rem] mb-[1.8rem] leading-6 text-[#697386]">We sent a PIN to <strong>{{ email }}</strong>.</p>
            <p v-else class="mt-[.7rem] mb-[1.8rem] leading-6 text-[#697386]">Enter your email and we’ll send you a one-time PIN.</p>
          </div>

          <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

          <form v-if="!pinRequested" class="mt-5 grid gap-5" @submit.prevent="sendPin">
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

          <form v-else class="mt-5 grid gap-5" @submit.prevent="signIn">
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

          <p class="mt-6 mb-0 text-center text-xs text-[#7a8498] [&_i]:mr-[.35rem] [&_i]:text-[#5b63d3]"><i class="pi pi-lock" /> Your refresh session is stored in a protected browser cookie.</p>
        </template>
      </Card>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import { auth } from '../auth'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const resending = ref(false)
const error = ref('')
const email = ref('')
const pin = ref('')
const pinRequested = ref(false)

// Tenant comes from the login link (?tenantId=), then the redirect target's link,
// then the tenant this browser last signed in to, then VITE_TENANT_ID for local development.
const tenantId = computed(() => {
  const direct = route.query.tenantId
  if (typeof direct === 'string' && direct) return direct

  const redirect = route.query.redirect
  if (typeof redirect === 'string') {
    const fromRedirect = new URL(redirect, window.location.origin).searchParams.get('tenantId')
    if (fromRedirect) return fromRedirect
  }

  return auth.lastTenantId() ?? import.meta.env.VITE_TENANT_ID ?? ''
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

async function signIn() {
  loading.value = true
  error.value = ''
  try {
    await auth.login({ email: email.value, tenantId: requireTenantId(), pin: pin.value })
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
  pin.value = ''
  pinRequested.value = false
  error.value = ''
}
</script>
