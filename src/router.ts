import { createRouter, createWebHistory } from 'vue-router'
import { auth } from './auth'
import { isSuperAdmin, sessionMatchesHost } from './session'
import { resolveHostTenant } from './hostTenant'
import HomeView from './views/HomeView.vue'
import LoginView from './views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/register', name: 'register', component: () => import('./views/RegisterView.vue') },
    { path: '/register-tenant', name: 'register-tenant', component: () => import('./views/RegisterTenantView.vue') },
    { path: '/register-tenant/verify', name: 'verify-tenant', component: () => import('./views/VerifyTenantView.vue') },
    { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true } },
    {
      path: '/scheduler',
      name: 'scheduler',
      component: () => import('./views/ResourceScheduler.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/properties',
      name: 'properties',
      component: () => import('./views/PropertiesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/work-orders',
      name: 'work-orders',
      component: () => import('./views/WorkOrdersView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('./views/UsersView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/users/:id',
      name: 'user-detail',
      component: () => import('./views/UserDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/tenants',
      name: 'tenants',
      component: () => import('./views/TenantsView.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true },
    },
    {
      path: '/tenants/:id',
      name: 'tenant-detail',
      component: () => import('./views/TenantDetailView.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true },
    },
  ],
})

function loginTenantId(query: Record<string, unknown>): string | undefined {
  return (typeof query.tenantId === 'string' && query.tenantId) || auth.lastTenantId() || undefined
}

router.beforeEach(async (to) => {
  await auth.initialize()
  if (to.meta.requiresAuth && !auth.isAuthenticated.value) {
    return { name: 'login', query: { redirect: to.fullPath, tenantId: loginTenantId(to.query) } }
  }
  // A session of another tenant (restored by the shared refresh cookie) must not be used at this tenant's address:
  // send the user to this tenant's sign-in instead, which says what happened.
  if (auth.isAuthenticated.value && !(await sessionMatchesHost())) {
    if (to.meta.requiresAuth) {
      const host = await resolveHostTenant()
      return { name: 'login', query: { redirect: to.fullPath, tenantId: host?.id } }
    }
    return
  }
  if (to.name === 'login' && auth.isAuthenticated.value) return { name: 'home' }
  // The API enforces this too; the check just keeps everyone else off pages that would only show errors.
  if (to.meta.requiresSuperAdmin && !(await isSuperAdmin())) return { name: 'home' }
})

// A protected request that still gets 401 after a refresh attempt lands here, from any view.
auth.setSessionExpiredHandler(() => {
  const current = router.currentRoute.value
  if (current.name === 'login') return
  void router.replace({
    name: 'login',
    query: { redirect: current.fullPath, tenantId: loginTenantId(current.query) },
  })
})

export default router
