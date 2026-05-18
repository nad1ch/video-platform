import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import {
  getCasesCatalog,
  postCaseOpen,
  type CatalogCase,
  type EconomyApiError,
  type OpenCaseResult,
  type WalletSnapshotDto,
} from '../api/economyApi'

export const useCasesStore = defineStore('economyCases', () => {
  const catalog = ref<CatalogCase[]>([])
  const catalogLoading = ref(false)
  const catalogError = ref<EconomyApiError | null>(null)

  const openingSlug = ref<string | null>(null)
  const openError = ref<EconomyApiError | null>(null)
  const lastOpenResult = shallowRef<OpenCaseResult | null>(null)
  const lastWallet = shallowRef<WalletSnapshotDto | null>(null)

  function applyError(slot: 'catalog' | 'open', err: unknown): void {
    const e: EconomyApiError =
      err && typeof err === 'object' && 'status' in (err as Record<string, unknown>)
        ? (err as EconomyApiError)
        : { status: 0, code: 'NETWORK', message: (err as Error)?.message ?? 'Network error' }
    if (slot === 'catalog') catalogError.value = e
    else openError.value = e
  }

  async function loadCatalog(opts?: { streamerId?: string | null }): Promise<void> {
    catalogLoading.value = true
    catalogError.value = null
    try {
      const r = await getCasesCatalog({ streamerId: opts?.streamerId ?? null })
      catalog.value = r.cases
    } catch (err) {
      applyError('catalog', err)
    } finally {
      catalogLoading.value = false
    }
  }

  async function openCase(slug: string): Promise<boolean> {
    if (openingSlug.value) return false
    openingSlug.value = slug
    openError.value = null
    lastOpenResult.value = null
    try {
      const r = await postCaseOpen(slug)
      lastOpenResult.value = r.result
      lastWallet.value = r.wallet
      // Refresh the catalog row so any inventory-affecting metadata is fresh.
      // Not strictly needed for MVP but cheap and matches the "server is truth"
      // principle.
      return true
    } catch (err) {
      applyError('open', err)
      return false
    } finally {
      openingSlug.value = null
    }
  }

  function clearLastResult(): void {
    lastOpenResult.value = null
    openError.value = null
  }

  return {
    catalog,
    catalogLoading,
    catalogError,
    openingSlug,
    openError,
    lastOpenResult,
    lastWallet,
    loadCatalog,
    openCase,
    clearLastResult,
  }
})
