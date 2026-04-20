import { computed, ref, shallowRef, type ComputedRef, type ShallowRef } from 'vue'
import { readJsonIfOk } from '@/utils/apiFetch'
import { apiUrl } from '@/utils/apiUrl'
import { requestNadlePublicConfig, type NadlePublicConfigPayload } from '@/nadle/nadleApi'

export type NadleStreamerCard = {
  id: string
  twitchId: string
  username: string
  isActive: boolean
}

export function useNadleStreamerRoom(options: {
  effectiveNadleSlug: ComputedRef<string | null>
  demoFallbackChannel: string
}): {
  nadlePublicConfig: ShallowRef<NadlePublicConfigPayload | null>
  streamerProfile: ShallowRef<NadleStreamerCard | null>
  streamerLoadError: ReturnType<typeof ref<string | null>>
  effectiveTwitchChannel: ComputedRef<string>
  loadStreamerCard: () => Promise<void>
  fetchNadlePublicConfig: () => Promise<void>
} {
  const { effectiveNadleSlug, demoFallbackChannel } = options

  const nadlePublicConfig = shallowRef<NadlePublicConfigPayload | null>(null)
  const streamerProfile = shallowRef<NadleStreamerCard | null>(null)
  const streamerLoadError = ref<string | null>(null)

  async function loadStreamerCard(): Promise<void> {
    streamerLoadError.value = null
    const slug = effectiveNadleSlug.value
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
      const card = await readJsonIfOk<NadleStreamerCard>(res)
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

  async function fetchNadlePublicConfig(): Promise<void> {
    const id = streamerProfile.value?.id
    if (!id) {
      nadlePublicConfig.value = null
      return
    }
    const r = await requestNadlePublicConfig(id)
    if (r.kind === 'set') {
      nadlePublicConfig.value = r.value
    } else if (r.kind === 'clear') {
      nadlePublicConfig.value = null
    }
  }

  const effectiveTwitchChannel = computed(() => {
    const fromApi = streamerProfile.value?.username
    if (typeof fromApi === 'string' && fromApi.length > 0) {
      return fromApi.toLowerCase()
    }
    return effectiveNadleSlug.value ?? demoFallbackChannel
  })

  return {
    nadlePublicConfig,
    streamerProfile,
    streamerLoadError,
    effectiveTwitchChannel,
    loadStreamerCard,
    fetchNadlePublicConfig,
  }
}
