<script setup lang="ts">
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import UserDetail from '../components/UserDetail.vue'

const route = useRoute()
const router = useRouter()
const backToUsers = () => router.push('/users')
</script>

<template>
  <div class="min-h-screen bg-[#f5f7fb]">
    <AppHeader />

    <main class="mx-auto w-[min(1180px,calc(100%-2rem))] py-[clamp(1.5rem,4vw,3rem)] max-[560px]:w-[calc(100%-1.25rem)]">
      <RouterLink class="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#667085] hover:text-[#5962d8]" to="/users"><i class="pi pi-arrow-left" /> Back to users</RouterLink>

      <UserDetail :key="String(route.params.id)" :user-id="String(route.params.id)" @removed="backToUsers" @back="backToUsers" />
    </main>
  </div>
</template>
