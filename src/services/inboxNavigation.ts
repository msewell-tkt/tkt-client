import { ref } from 'vue'

/**
 * A request, from the inbox, to show a work order. The scheduler and the work orders page watch it and open their own
 * drawer, so the dispatcher stays where they are; anywhere else the inbox navigates to the work orders page instead.
 * `at` changes on every request, so asking for the same work order twice still counts.
 */
export const orderRequest = ref<{ id: string; at: number } | null>(null)

export function requestOrder(id: string) {
  orderRequest.value = { id, at: Date.now() }
}
