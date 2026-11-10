<template>
  <main class="grid min-h-screen grid-cols-1 bg-white min-[861px]:grid-cols-[minmax(380px,.9fr)_minmax(520px,1.1fr)]">
    <section class="relative hidden flex-col justify-center overflow-hidden bg-[radial-gradient(circle_at_10%_10%,#5b63d3_0,transparent_38%),linear-gradient(145deg,#10172b,#19244a_62%,#252e68)] p-[clamp(3rem,7vw,7rem)] text-white after:absolute after:right-[-10rem] after:bottom-[-12rem] after:h-[32rem] after:w-[32rem] after:rounded-full after:border after:border-white/12 after:content-[''] after:shadow-[0_0_0_5rem_rgba(255,255,255,.025),0_0_0_10rem_rgba(255,255,255,.02)] min-[861px]:flex">
      <div class="mb-7 grid h-11 w-11 place-items-center rounded-[.85rem] bg-[#6972ea] text-white shadow-[0_12px_30px_rgba(71,80,190,.35)]"><i class="pi pi-bolt" /></div>
      <p class="mb-[.65rem] text-xs font-extrabold tracking-[.12em] text-[#aeb5ff] uppercase">Turnkey Tracker</p>
      <h1 class="m-0 max-w-[580px] text-[clamp(2.7rem,5vw,5rem)] leading-[.98] tracking-[-.055em]">Set up your workspace.</h1>
      <p class="my-7 mb-10 max-w-[520px] text-[1.08rem] leading-7 text-[#c7cee8]">
        Create a workspace for your company, then invite your team to manage properties and work orders together.
      </p>
      <div class="grid gap-4 text-[.92rem] text-[#e5e9f8] [&_i]:mr-[.7rem] [&_i]:text-[#8de1ce]">
        <span><i class="pi pi-check-circle" /> You become the workspace administrator</span>
        <span><i class="pi pi-check-circle" /> Invite your team by email</span>
        <span><i class="pi pi-check-circle" /> Sign in with a one-time PIN, no password</span>
      </div>
    </section>

    <section class="grid min-h-screen place-items-center bg-linear-to-br from-[#fafbfe] to-[#f1f3f9] p-4 min-[581px]:p-8 min-[861px]:min-h-0">
      <Card class="w-full max-w-[540px] rounded-[1.25rem] border border-[#e6e9f2] shadow-[0_25px_70px_rgba(21,30,59,.1)] [&_.p-card-body]:p-[clamp(1.5rem,4vw,2.6rem)]">
        <template #content>
          <div class="mb-8 flex items-center gap-[.8rem] min-[861px]:hidden">
            <div class="grid h-[2.2rem] w-[2.2rem] place-items-center rounded-[.85rem] bg-[#6972ea] text-white shadow-[0_12px_30px_rgba(71,80,190,.35)]"><i class="pi pi-bolt" /></div>
            <strong>Turnkey Tracker</strong>
          </div>

          <template v-if="sent">
            <p class="mb-[.65rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">Almost there</p>
            <h2 class="m-0 text-[1.8rem] tracking-[-.035em]">Check your email</h2>
            <p class="mt-[.7rem] mb-6 leading-6 text-[#697386]">We sent a confirmation link to <strong>{{ form.email }}</strong>. Open it to create <strong>{{ form.tenantName }}</strong> and finish setting up your account. The link works for 24 hours.</p>
            <div class="flex flex-wrap justify-between gap-2">
              <Button type="button" label="Use a different email" severity="secondary" variant="text" size="small" @click="sent = false" />
              <Button type="button" label="Resend email" severity="secondary" variant="text" size="small" :loading="loading" @click="submit" />
            </div>
            <Message v-if="error" severity="error" :closable="false" class="mt-4">{{ error }}</Message>
          </template>

          <template v-else>
            <p class="mb-[.65rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">Get started</p>
            <h2 class="m-0 text-[1.8rem] tracking-[-.035em]">Create your workspace</h2>
            <p class="mt-[.7rem] mb-[1.8rem] leading-6 text-[#697386]">Tell us about your company and you. We’ll email you a link to confirm your address.</p>

            <Message v-if="error" severity="error" :closable="false" class="mb-5">{{ error }}</Message>

            <form class="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1" @submit.prevent="submit">
              <div class="col-span-full grid gap-2"><label class="text-sm font-bold text-[#323b50]" for="tenant-name">Workspace name</label><InputText id="tenant-name" v-model.trim="form.tenantName" maxlength="45" placeholder="Acme Property Services" autocomplete="organization" required fluid /></div>
              <div class="grid gap-2"><label class="text-sm font-bold text-[#323b50]" for="first-name">First name</label><InputText id="first-name" v-model.trim="form.firstName" maxlength="45" autocomplete="given-name" required fluid /></div>
              <div class="grid gap-2"><label class="text-sm font-bold text-[#323b50]" for="last-name">Last name</label><InputText id="last-name" v-model.trim="form.lastName" maxlength="45" autocomplete="family-name" required fluid /></div>
              <div class="col-span-full grid gap-2"><label class="text-sm font-bold text-[#323b50]" for="email">Email address</label><InputText id="email" v-model.trim="form.email" type="email" maxlength="128" placeholder="you@company.com" autocomplete="email" required fluid /></div>
              <div class="grid gap-2"><label class="text-sm font-bold text-[#323b50]" for="phone">Phone <span class="font-normal text-[#8a93a5]">(optional)</span></label><InputText id="phone" v-model.trim="form.phone" type="tel" maxlength="15" autocomplete="tel" fluid /></div>
              <div class="grid gap-2"><label class="text-sm font-bold text-[#323b50]" for="mobile">Mobile <span class="font-normal text-[#8a93a5]">(optional)</span></label><InputText id="mobile" v-model.trim="form.mobile" type="tel" maxlength="15" autocomplete="tel" fluid /></div>
              <Button type="submit" label="Email me a confirmation link" icon="pi pi-arrow-right" icon-pos="right" :loading="loading" class="col-span-full" fluid />
            </form>

            <p class="mt-6 mb-0 text-center text-sm text-[#697386]">Already have a workspace? <RouterLink class="font-semibold text-[#5962d8] hover:underline" :to="{ name: 'login' }">Sign in</RouterLink></p>
          </template>
        </template>
      </Card>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { tenantRegistrationService } from '../services/TenantRegistrationService'

const form = ref({ tenantName: '', firstName: '', lastName: '', email: '', phone: '', mobile: '' })
const loading = ref(false)
const error = ref('')
const sent = ref(false)

async function submit() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    await tenantRegistrationService.register(form.value)
    sent.value = true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to start your registration.'
  } finally {
    loading.value = false
  }
}
</script>
