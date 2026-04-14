import { ref, watch } from 'vue'
import { subscribeToGameRoom, subscribeToPlayers, subscribeToVotes } from '../../services/gameService.js'
import { normalizeGameRoomPayload } from '../../utils/gameRoomNormalize.js'
import { debugDelete } from '../../utils/debugDelete.js'
import { normalizePlayerSlotId } from '../../utils/playerSlot.js'

/**
 * Firestore: room doc, players collection, votes collection + roster masking (pending delete / anti-ghost).
 * Character subscription stays in the orchestrator; onTeardownCharacter runs after room/player/vote unsubs, before votes ref clear (same order as legacy cleanupSubs).
 */
export function useControlFirestoreRoom({
  gameId,
  isAdmin,
  adminAccessDenied,
  bootstrappedControl,
  onTeardownCharacter,
}) {
  const gameRoom = ref({})
  const allPlayers = ref([])
  /** Останній сирий список з onSnapshot(players) — до маски pending delete. */
  const lastPlayersFirestoreList = ref([])
  const pendingPlayerDeletes = ref([])
  const antiGhostPlayerUntil = ref({})
  const ANTI_GHOST_PLAYER_MS = 18_000
  const votes = ref([])

  let unsubGameRoom = null
  let unsubPlayers = null
  let unsubVotes = null

  const gotGameRoomSnap = ref(false)
  const gotPlayersSnap = ref(false)

  function teardownGamePlayersVotesListeners() {
    if (unsubGameRoom) {
      unsubGameRoom()
      unsubGameRoom = null
    }
    if (unsubPlayers) {
      unsubPlayers()
      unsubPlayers = null
    }
    if (unsubVotes) {
      unsubVotes()
      unsubVotes = null
    }
  }

  function pruneAntiGhostPlayerUntil() {
    const now = Date.now()
    const ag = antiGhostPlayerUntil.value
    let changed = false
    const next = { ...ag }
    for (const k of Object.keys(next)) {
      if (next[k] < now) {
        delete next[k]
        changed = true
      }
    }
    if (changed) antiGhostPlayerUntil.value = next
  }

  function activeAntiGhostPlayerSlots() {
    pruneAntiGhostPlayerUntil()
    const now = Date.now()
    const s = new Set()
    for (const [slot, until] of Object.entries(antiGhostPlayerUntil.value)) {
      if (until >= now) s.add(normalizePlayerSlotId(slot))
    }
    return s
  }

  function reconcilePendingDeletesWithSnapshot(rawList) {
    const prevPending = [...pendingPlayerDeletes.value]
    const inSnap = new Set(rawList.map((p) => normalizePlayerSlotId(p.id)))
    const nextPending = prevPending.filter((pid) => inSnap.has(pid))
    if (JSON.stringify(prevPending) !== JSON.stringify(nextPending)) {
      debugDelete('reconcile pending', {
        gameId: gameId.value,
        prevPending,
        nextPending,
        rawIdsInSnap: [...inSnap],
      })
    }
    pendingPlayerDeletes.value = nextPending
  }

  function applyPlayerListFromFirestore(rawList) {
    lastPlayersFirestoreList.value = rawList
    reconcilePendingDeletesWithSnapshot(rawList)
    const hide = new Set(pendingPlayerDeletes.value)
    const ghostHide = activeAntiGhostPlayerSlots()
    allPlayers.value = rawList.filter((x) => {
      const id = normalizePlayerSlotId(x.id)
      return !hide.has(id) && !ghostHide.has(id)
    })
    gotPlayersSnap.value = true
    if (hide.size > 0 || ghostHide.size > 0) {
      debugDelete('applyPlayerList (маска pending/antiGhost)', {
        gameId: gameId.value,
        rawCount: rawList.length,
        rawIds: rawList.map((x) => normalizePlayerSlotId(x.id)),
        pending: [...hide],
        antiGhost: [...ghostHide],
        visibleIds: allPlayers.value.map((x) => normalizePlayerSlotId(x.id)),
      })
    }
  }

  watch(
    [gameId, adminAccessDenied, isAdmin],
    () => {
      teardownGamePlayersVotesListeners()
      onTeardownCharacter?.()
      votes.value = []
      gotGameRoomSnap.value = false
      gotPlayersSnap.value = false
      lastPlayersFirestoreList.value = []
      pendingPlayerDeletes.value = []
      antiGhostPlayerUntil.value = {}
      if (adminAccessDenied.value) {
        gameRoom.value = {}
        allPlayers.value = []
        bootstrappedControl.value = true
        return
      }
      bootstrappedControl.value = false
      unsubGameRoom = subscribeToGameRoom(gameId.value, (d) => {
        gameRoom.value = normalizeGameRoomPayload(d && typeof d === 'object' ? d : {})
        gotGameRoomSnap.value = true
      })
      unsubVotes = subscribeToVotes(gameId.value, (list) => {
        votes.value = list
      })
      if (isAdmin.value) {
        unsubPlayers = subscribeToPlayers(gameId.value, (list) => {
          applyPlayerListFromFirestore(list)
        })
      } else {
        allPlayers.value = []
        gotPlayersSnap.value = true
      }
    },
    { immediate: true },
  )

  return {
    gameRoom,
    allPlayers,
    lastPlayersFirestoreList,
    pendingPlayerDeletes,
    antiGhostPlayerUntil,
    ANTI_GHOST_PLAYER_MS,
    votes,
    gotGameRoomSnap,
    gotPlayersSnap,
    teardownGamePlayersVotesListeners,
    applyPlayerListFromFirestore,
    pruneAntiGhostPlayerUntil,
    activeAntiGhostPlayerSlots,
    reconcilePendingDeletesWithSnapshot,
  }
}
