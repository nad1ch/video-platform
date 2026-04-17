import { computed, ref, shallowRef, type ComputedRef, type ShallowRef } from 'vue'
import { readJsonIfOk } from '@/utils/apiFetch'
import { apiUrl } from '@/utils/apiUrl'
import { requestWordlePublicConfig, type WordlePublicConfigPayload } from '@/wordle/wordleApi'

export type WordleStreamerCard = {
  id: string
  twitchId: string
  username: string
  isActive: boolean
}

export function useWordleStreamerRoom(options: {
  effectiveWordleSlug: ComputedRef<string | null>
  demoFallbackChannel: string
}): {
  wordlePublicConfig: ShallowRef<WordlePublicConfigPayload | null>
  streamerProfile: ShallowRef<WordleStreamerCard | null>
  streamerLoadError: ReturnType<typeof ref<string | null>>
  effectiveTwitchChannel: ComputedRef<string>
  loadStreamerCard: () => Promise<void>
  fetchWordlePublicConfig: () => Promise<void>
} {
  const { effectiveWordleSlug, demoFallbackChannel } = options

  const wordlePublicConfig = shallowRef<WordlePublicConfigPayload | null>(null)
  const streamerProfile = shallowRef<WordleStreamerCard | null>(null)
  const streamerLoadError = ref<string | null>(null)

  async function loadStreamerCard(): Promise<void> {
    streamerLoadError.value = null
    const slug = effectiveWordleSlug.value
    if (!slug) {
      streamerProfile.value = null
      streamerLoadError.value = 'Invalid streamer'
      return
    }
    try {
      const res = await fetch(apiUrl(`/api/streamer/${encodeURIComponent(slug)}`))
      if (!res.ok) {
        streamerProfile.value = null
        streamerLoadError.value = res.status === 404 ? 'Streamer not found' : 'Failed to load streamer'
        return
      }
      const card = await readJsonIfOk<WordleStreamerCard>(res)
      if (!card) {
        streamerProfile.value = null
        streamerLoadError.value = 'Network error'
        return
      }
      streamerProfile.value = card
      streamerLoadError.value = null
    } catch {
      streamerProfile.value = null
      streamerLoadError.value = 'Network error'
    }
  }

  async function fetchWordlePublicConfig(): Promise<void> {
    const id = streamerProfile.value?.id
    if (!id) {
      wordlePublicConfig.value = null
      return
    }
    const r = await requestWordlePublicConfig(id)
    if (r.kind === 'set') {
      wordlePublicConfig.value = r.value
    } else if (r.kind === 'clear') {
      wordlePublicConfig.value = null
    }
  }

  const effectiveTwitchChannel = computed(() => {
    const fromApi = streamerProfile.value?.username
    if (typeof fromApi === 'string' && fromApi.length > 0) {
      return fromApi.toLowerCase()
    }
    return effectiveWordleSlug.value ?? demoFallbackChannel
  })

  return {
    wordlePublicConfig,
    streamerProfile,
    streamerLoadError,
    effectiveTwitchChannel,
    loadStreamerCard,
    fetchWordlePublicConfig,
  }
}
