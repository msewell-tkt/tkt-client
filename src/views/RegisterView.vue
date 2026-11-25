<template>
  <main class="grid min-h-screen place-items-center bg-linear-to-br from-[#fafbfe] to-[#f1f3f9] p-4 min-[581px]:p-8">
    <Card class="w-full max-w-[520px] rounded-[1.25rem] border border-[#e6e9f2] shadow-[0_25px_70px_rgba(21,30,59,.1)] [&_.p-card-body]:p-[clamp(1.5rem,4vw,2.6rem)]">
      <template #content>
        <div class="mb-8 flex items-center gap-[.8rem]">
          <img src="https://static.turnkeytracker.com/images/logo.png" alt="" class="h-[2.2rem] w-[2.2rem] object-contain" />
          <strong>Turnkey Tracker</strong>
        </div>

        <div v-if="loading" class="grid place-items-center py-10"><ProgressSpinner stroke-width="4" class="!h-10 !w-10" aria-label="Loading invitation" /></div>

        <template v-else-if="loadError">
          <h2 class="m-0 text-[1.6rem] tracking-[-.035em]">Invitation unavailable</h2>
          <Message severity="error" :closable="false" class="mt-5">{{ loadError }}</Message>
        </template>

        <template v-else-if="done && invitation">
          <p class="mb-[.65rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">You’re in</p>
          <h2 class="m-0 text-[1.8rem] tracking-[-.035em]">Welcome to {{ invitation.tenantName }}</h2>
          <p v-if="invitation.existingUser" class="mt-[.7rem] mb-6 leading-6 text-[#697386]">Your existing account now has access to this workspace. Sign in with a PIN to get started.</p>
          <p v-else class="mt-[.7rem] mb-6 leading-6 text-[#697386]">We sent a PIN to <strong>{{ invitation.email }}</strong>. Enter it on the sign-in page to finish setting up your account.</p>
          <Button label="Continue to sign in" icon="pi pi-arrow-right" icon-pos="right" :loading="signingOut" fluid @click="goToLogin" />
        </template>

        <template v-else-if="invitation">
          <p class="mb-[.65rem] text-xs font-extrabold tracking-[.12em] text-[#5b63d3] uppercase">Invitation</p>
          <h2 class="m-0 text-[1.8rem] tracking-[-.035em]">Join {{ invitation.tenantName }}</h2>
          <p v-if="invitation.existingUser" class="mt-[.7rem] mb-[1.8rem] leading-6 text-[#697386]">You already have an account as <strong>{{ invitation.email }}</strong>. Accept to add this workspace to it.</p>
          <p v-else class="mt-[.7rem] mb-[1.8rem] leading-6 text-[#697386]">Tell us a little about yourself to set up your account as <strong>{{ invitation.email }}</strong>.</p>

          <Message v-if="error" severity="error" :closable="false" class="mb-5">{{ error }}</Message>

          <form class="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1" @submit.prevent="submit">
            <template v-if="!invitation.existingUser">
              <div class="grid gap-2"><label class="text-sm font-bold text-[#323b50]" for="first-name">First name</label><InputText id="first-name" v-model.trim="form.firstName" autocomplete="given-name" required fluid /></div>
              <div class="grid gap-2"><label class="text-sm font-bold text-[#323b50]" for="last-name">Last name</label><InputText id="last-name" v-model.trim="form.lastName" autocomplete="family-name" required fluid /></div>
              <div class="grid gap-2"><label class="text-sm font-bold text-[#323b50]" for="phone">Phone <span class="font-normal text-[#8a93a5]">(optional)</span></label><InputText id="phone" v-model.trim="form.phone" type="tel" autocomplete="tel" fluid /></div>
              <div class="grid gap-2"><label class="text-sm font-bold text-[#323b50]" for="mobile">Mobile <span class="font-normal text-[#8a93a5]">(optional)</span></label><InputText id="mobile" v-model.trim="form.mobile" type="tel" autocomplete="tel" fluid /></div>
            </template>
            <Button type="submit" :label="invitation.existingUser ? 'Accept invitation' : 'Create my account'" icon="pi pi-arrow-right" icon-pos="right" :loading="submitting" class="col-span-full" fluid />
          </form>
        </template>
      </template>
    </Card>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { auth } from '../auth'
import { invitationService, type InvitationView } from '../services/InvitationService'

const route = useRoute()
const router = useRouter()
const token = typeof route.query.token === 'string' ? route.query.token : ''
const invitation = ref<InvitationView | null>(null)
const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const signingOut = ref(false)
const error = ref('')
const done = ref(false)
const form = ref({ firstName: '', lastName: '', phone: '', mobile: '' })

onMounted(async () => {
  try {
    if (!token) throw new Error('This invitation link is missing its token. Open the link from your invitation email.')
    invitation.value = await invitationService.view(token)
  } catch (reason) {
    loadError.value = reason instanceof Error ? reason.message : 'Couldn’t load the invitation.'
  } finally {
    loading.value = false
  }
})

async function submit() {
  const current = invitation.value
  if (!current || submitting.value) return
  submitting.value = true
  error.value = ''
  try {
    await invitationService.accept(token, form.value)
    done.value = true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to complete your registration.'
  } finally {
    submitting.value = false
  }
}

// Any session still open here would send the login route straight home, so it is signed out first.
async function goToLogin() {
  const current = invitation.value
  if (!current || signingOut.value) return
  signingOut.value = true
  // A failed request still drops this page's session, so carry on to sign-in.
  await auth.logout().catch(() => {})
  await router.push({ name: 'login', query: { tenantId: current.tenantId, email: current.email, ...(current.existingUser ? {} : { pinSent: '1' }) } })
}
</script>
