import { computed, ref, watch } from 'vue'
import { normalizePlayerSlotId } from '../utils/playerSlot.js'

const STORAGE_PREFIX = 'eat-first-overlay:mosaic-order:'

/**
 * Ручний порядок плиток у мозаїці: drag-and-drop + localStorage на gameId.
 *
 * @param {import('vue').ComputedRef<string> | import('vue').Ref<string>} gameIdRef
 * @param {import('vue').ComputedRef<Array<{ id: string }>>} defaultOrderedPlayers
 */
export function useMosaicPlayerOrder(gameIdRef, defaultOrderedPlayers) {
  const manualIds = ref([])
  const dragSourceId = ref(null)
  const dropTargetId = ref(null)

  function storageKey() {
    return `${STORAGE_PREFIX}${String(gameIdRef.value ?? '').trim()}`
  }

  function load() {
    try {
      const raw = localStorage.getItem(storageKey())
      if (!raw) {
        manualIds.value = []
        return
      }
      const arr = JSON.parse(raw)
      manualIds.value = Array.isArray(arr) ? arr.map((x) => normalizePlayerSlotId(x)) : []
    } catch {
      manualIds.value = []
    }
  }

  function save() {
    try {
      if (manualIds.value.length === 0) {
        localStorage.removeItem(storageKey())
      } else {
        localStorage.setItem(storageKey(), JSON.stringify(manualIds.value))
      }
    } catch {
      /* */
    }
  }

  watch(
    () => gameIdRef.value,
    () => {
      load()
    },
    { immediate: true },
  )

  watch(
    defaultOrderedPlayers,
    () => {
      const list = defaultOrderedPlayers.value
      const base = list.map((p) => normalizePlayerSlotId(p.id))
      const set = new Set(base)
      if (manualIds.value.length === 0) return
      let next = manualIds.value.filter((id) => set.has(id))
      const have = new Set(next)
      for (const id of base) {
        if (!have.has(id)) {
          next.push(id)
          have.add(id)
        }
      }
      manualIds.value = next
      save()
    },
  )

  const playersDisplayOrdered = computed(() => {
    const list = defaultOrderedPlayers.value
    const byId = Object.fromEntries(list.map((p) => [normalizePlayerSlotId(p.id), p]))
    if (manualIds.value.length === 0) return list

    const seen = new Set()
    const out = []
    for (const id of manualIds.value) {
      const p = byId[id]
      if (p && !seen.has(id)) {
        out.push(p)
        seen.add(id)
      }
    }
    for (const p of list) {
      const id = normalizePlayerSlotId(p.id)
      if (!seen.has(id)) {
        out.push(p)
        seen.add(id)
      }
    }
    return out
  })

  function onMosaicDragStart(player, event) {
    const id = normalizePlayerSlotId(player.id)
    dragSourceId.value = id
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', id)
    }
  }

  function onMosaicDragEnd() {
    dragSourceId.value = null
    dropTargetId.value = null
  }

  function onMosaicDragOver(event) {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
  }

  function onMosaicDragEnterPlayer(player) {
    dropTargetId.value = normalizePlayerSlotId(player.id)
  }

  function onMosaicDrop(targetPlayer, event) {
    event.preventDefault()
    const raw =
      (event.dataTransfer && event.dataTransfer.getData('text/plain')) || dragSourceId.value || ''
    const sourceId = normalizePlayerSlotId(String(raw).trim())
    const targetId = normalizePlayerSlotId(targetPlayer.id)
    if (!sourceId || sourceId === targetId) {
      onMosaicDragEnd()
      return
    }

    let ids =
      manualIds.value.length > 0
        ? [...manualIds.value]
        : defaultOrderedPlayers.value.map((p) => normalizePlayerSlotId(p.id))

    const i = ids.indexOf(sourceId)
    const j = ids.indexOf(targetId)
    if (i === -1 || j === -1) {
      onMosaicDragEnd()
      return
    }
    const next = [...ids]
    const t = next[i]
    next[i] = next[j]
    next[j] = t
    manualIds.value = next
    save()
    onMosaicDragEnd()
  }

  return {
    playersDisplayOrdered,
    mosaicDragSourceId: dragSourceId,
    mosaicDropTargetId: dropTargetId,
    onMosaicDragStart,
    onMosaicDragEnd,
    onMosaicDragOver,
    onMosaicDragEnterPlayer,
    onMosaicDrop,
  }
}
