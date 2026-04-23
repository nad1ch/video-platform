import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const LS_KEY = 'isAdmin'

/**
 * Client-only dev/QA “admin” overlay (Coin Hub, etc.): query `?admin=1`,
 * `localStorage['isAdmin']==='1'`, or `user.role==='admin'`. Does not grant server privileges.
 */
export function useAdminMode() {
  const route = useRoute()
  const { user } = useAuth()
  const storageRev = ref(0)

  const fromQuery = computed(() => route.query.admin === '1')
  const fromRole = computed(() => user.value?.role === 'admin')
  const fromLocal = computed(() => {
    void storageRev.value
    if (typeof localStorage === 'undefined') {
      return false
    }
    return localStorage.getItem(LS_KEY) === '1'
  })

  const isAdmin = computed(() => fromQuery.value || fromLocal.value || fromRole.value)

  function bumpStorageRead() {
    storageRev.value += 1
  }
  function onStorage(e: StorageEvent) {
    if (e.key === null || e.key === LS_KEY) {
      bumpStorageRead()
    }
  }

  onMounted(() => {
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', bumpStorageRead)
  })
  onUnmounted(() => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('focus', bumpStorageRead)
  })

  watch(
    () => route.fullPath,
    () => {
      storageRev.value += 1
    },
  )

  return { isAdmin }
}
