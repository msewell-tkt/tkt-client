<template>
  <img v-if="!failed" :src="src" :alt="alt" :class="imgClass" @error="failed = true">
  <slot v-else />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { tenantService } from '../services/TenantService'

const props = defineProps<{
  tenantId: string
  /** The logo's `logoUpdated`, when known, so a fresh upload is not served from the browser cache. */
  version?: string | null
  alt: string
  imgClass?: string
}>()

// A tenant without a logo answers 404; the slot (the default look) is shown instead.
const failed = ref(false)
watch(() => [props.tenantId, props.version], () => { failed.value = false })
const src = computed(() => tenantService.logoUrl(props.tenantId, props.version))
</script>
