<template>
  <header class="sticky top-0 z-10 flex h-[68px] items-center justify-between gap-3 border-b border-[#e4e7ee] bg-white/90 px-[clamp(1rem,4vw,3.5rem)] backdrop-blur-2xl">
    <RouterLink class="flex shrink-0 items-center gap-3 font-extrabold tracking-[-.02em]" to="/">
      <span class="grid h-8 w-8 place-items-center rounded-[.6rem] bg-[#6972ea] text-[.8rem] text-white shadow-[0_12px_30px_rgba(71,80,190,.35)]"><i class="pi pi-bolt" /></span>
      <span class="max-[520px]:hidden">Turnkey Tracker</span>
    </RouterLink>

    <nav class="mr-auto ml-10 flex self-stretch items-stretch gap-1 max-[800px]:ml-2" aria-label="Primary navigation">
      <RouterLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        :aria-label="link.label"
        :aria-current="isActive(link.to) ? 'page' : undefined"
        :class="[
          'flex items-center gap-2 border-b-2 px-[.8rem] text-[.88rem] font-semibold max-[800px]:px-[.6rem]',
          isActive(link.to) ? 'border-b-[#5962d8] text-[#5962d8]' : 'border-transparent text-[#667085] hover:text-[#313a51]',
        ]"
      >
        <i :class="['pi text-[.85rem] min-[801px]:hidden', link.icon]" />
        <span class="max-[800px]:hidden">{{ link.label }}</span>
      </RouterLink>
    </nav>

    <Button
      icon="pi pi-sign-out"
      label="Sign out"
      severity="secondary"
      text
      class="shrink-0 max-[520px]:[&_.p-button-label]:hidden"
      :loading="signingOut"
      @click="signOut"
    />
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import { auth } from '../auth'

const links = [
  { to: '/scheduler', label: 'Scheduler', icon: 'pi-calendar' },
  { to: '/properties', label: 'Properties', icon: 'pi-building' },
  { to: '/work-orders', label: 'Work orders', icon: 'pi-briefcase' },
  { to: '/users', label: 'Users', icon: 'pi-users' },
]

const route = useRoute()
const router = useRouter()
const signingOut = ref(false)

function isActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`)
}

async function signOut() {
  signingOut.value = true
  try {
    await auth.logout()
  } finally {
    signingOut.value = false
    await router.replace({ name: 'login', query: { tenantId: auth.lastTenantId() ?? undefined } })
  }
}
</script>
