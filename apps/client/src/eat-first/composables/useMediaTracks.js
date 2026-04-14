import { shallowRef, reactive, markRaw, watch, watchEffect, triggerRef, unref } from 'vue'
import { RoomEvent, Track } from 'livekit-client'

const DEFAULT_MAX_VIDEO = 4

/**
 * @typedef {import('livekit-client').Participant} LkParticipant
 * @typedef {import('livekit-client').RemoteParticipant} LkRemoteParticipant
 */

/**
 * LiveKit media layer: стабільні reactive-тайли + Map, event-driven оновлення без повного O(n)
 * циклу на кожен дрібний івент.
 *
 * - subscriptionContextKey: повний applySubscriptions лише при зміні відео-бюджету / порядку / елімінацій.
 * - ActiveSpeakersChanged без зміни ключа: лише дельта isSpeaking (O(Δ) активних спікерів).
 * - Track*: patch одного участника (+ перевірка ключа підписок).
 * - structural (connect / disconnect): reconcile порядку та кешу Map.
 *
 * @param {import('vue').ShallowRef<import('livekit-client').Room | null>} roomRef
 * @param {{
 *   spotlightSlot: import('vue').Ref<string | null> | import('vue').ComputedRef<string | null>,
 *   speakerSlot: import('vue').Ref<string | null> | import('vue').ComputedRef<string | null>,
 *   includeLocal: import('vue').Ref<boolean> | import('vue').ComputedRef<boolean>,
 *   maxVideo?: number | import('vue').Ref<number> | import('vue').ComputedRef<number>,
 *   subscriberMaxQuality?: import('vue').Ref<import('livekit-client').VideoQuality | null | undefined> | import('livekit-client').VideoQuality | null,
 *   playerLabels: import('vue').Ref<Record<string, string>> | import('vue').ComputedRef<Record<string, string>>,
 *   volumeByIdentity: import('vue').Ref<Record<string, number>>,
 *   eliminatedSlots?: import('vue').Ref<Set<string>> | import('vue').ComputedRef<Set<string>>,
 * }} options
 */
export function useMediaTracks(roomRef, options) {
  const {
    spotlightSlot,
    speakerSlot,
    includeLocal,
    maxVideo: maxVideoOption = DEFAULT_MAX_VIDEO,
    subscriberMaxQuality: subscriberMaxQualityOption = null,
    playerLabels,
    volumeByIdentity,
    eliminatedSlots,
  } = options

  function resolveMaxVideo() {
    const m = unref(maxVideoOption)
    return typeof m === 'number' && m > 0 ? m : DEFAULT_MAX_VIDEO
  }

  function resolveSubscriberQuality() {
    return subscriberMaxQualityOption == null ? null : unref(subscriberMaxQualityOption)
  }

  function applySubscriberVideoQualityCap(room) {
    const cap = resolveSubscriberQuality()
    if (cap === undefined || cap === null) return
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        if (pub.kind !== Track.Kind.Video || !pub.isSubscribed) continue
        try {
          pub.setVideoQuality(cap)
        } catch {
          /* */
        }
      }
    }
  }

  function subscriptionContextKey(room) {
    if (!room) return ''
    const eliminated = eliminatedSlots?.value ?? new Set()
    const elim = [...eliminated].sort().join('|')
    const ordered = sortRemoteIds(room)
    const local = room.localParticipant
    const localCam = local?.isCameraEnabled === true
    const maxVideo = resolveMaxVideo()
    const remoteBudget = Math.max(0, maxVideo - (localCam && includeLocal.value ? 1 : 0))
    const videoPick = ordered.filter((id) => !eliminated.has(id)).slice(0, remoteBudget)
    return [
      ordered.join('\0'),
      maxVideo,
      includeLocal.value ? '1' : '0',
      localCam ? '1' : '0',
      elim,
      videoPick.join('\0'),
    ].join('#')
  }

  function sortRemoteIds(room) {
    const ids = [...room.remoteParticipants.keys()]
    const sp = String(speakerSlot.value ?? '').trim()
    const st = String(spotlightSlot.value ?? '').trim()
    const activeIds = new Set(room.activeSpeakers.map((p) => p.identity))

    const rank = (id) => {
      let s = 0
      if (activeIds.has(id)) s += 1000
      if (sp && id === sp) s += 100
      if (st && id === st) s += 50
      return s
    }
    return ids.sort((a, b) => rank(b) - rank(a) || a.localeCompare(b))
  }

  function computeVideoPickSet(room) {
    const ordered = sortRemoteIds(room)
    const eliminated = eliminatedSlots?.value ?? new Set()
    const local = room.localParticipant
    const localCam = local?.isCameraEnabled === true
    const maxVideo = resolveMaxVideo()
    const remoteBudget = Math.max(0, maxVideo - (localCam && includeLocal.value ? 1 : 0))
    return new Set(ordered.filter((id) => !eliminated.has(id)).slice(0, remoteBudget))
  }

  function applySubscriptions(room) {
    const maxVideo = resolveMaxVideo()
    const local = room.localParticipant
    const localCam = local?.isCameraEnabled === true
    const remoteBudget = Math.max(0, maxVideo - (localCam && includeLocal.value ? 1 : 0))
    const ordered = sortRemoteIds(room)
    const videoSet = new Set(ordered.slice(0, remoteBudget))
    const eliminated = eliminatedSlots?.value ?? new Set()

    for (const p of room.remoteParticipants.values()) {
      const isElim = eliminated.has(p.identity)
      for (const pub of p.trackPublications.values()) {
        if (pub.kind === Track.Kind.Audio) {
          try {
            pub.setSubscribed(!isElim)
          } catch {
            /* */
          }
        } else if (pub.kind === Track.Kind.Video) {
          try {
            pub.setSubscribed(!isElim && videoSet.has(p.identity))
          } catch {
            /* */
          }
        }
      }
    }
  }

  function applyVolume(room) {
    const vols = volumeByIdentity?.value ?? {}
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        if (pub.kind === Track.Kind.Audio && pub.track) {
          const v = vols[p.identity]
          const n = typeof v === 'number' && v >= 0 && v <= 1 ? v : 1
          try {
            pub.track.setVolume(n)
          } catch {
            /* */
          }
        }
      }
    }
  }

  function hasSubscribedVideoTrack(p) {
    return [...p.trackPublications.values()].some(
      (pub) => pub.kind === Track.Kind.Video && pub.isSubscribed && pub.track,
    )
  }

  const tileByIdentity = new Map()
  /** Єдине джерело truth для O(1) lookup; мутація Map + triggerRef при add/remove. */
  const tileMapRef = shallowRef(tileByIdentity)

  /** @type {import('vue').ShallowRef<Array<{ identity: string, participant: LkParticipant, isLocal: boolean, showVideo: boolean, isSpeaking: boolean, isMuted: boolean, label: string }>>} */
  const tiles = shallowRef([])

  let lastSubscriptionKey = ''
  /** Остання множина remote identity, для яких дозволене відео (топ-N після сорту). */
  let lastVideoPick = /** @type {Set<string>} */ (new Set())
  /** Для дельти ActiveSpeakersChanged без повного скану всіх тайлів. */
  let prevActiveSpeakerIds = /** @type {Set<string>} */ (new Set())

  /** @param {string} identity @param {LkParticipant} participant @param {boolean} isLocal */
  function getOrCreateTile(identity, participant, isLocal) {
    let tile = tileByIdentity.get(identity)
    if (!tile) {
      tile = reactive({
        identity,
        participant: markRaw(participant),
        isLocal,
        showVideo: false,
        isSpeaking: false,
        isMuted: false,
        label: '',
      })
      tileByIdentity.set(identity, tile)
      triggerRef(tileMapRef)
    } else {
      tile.participant = markRaw(participant)
      tile.isLocal = isLocal
    }
    return tile
  }

  function patchTileFromRoom(tile, room, videoSet, speaking, labels, local, localCam) {
    const id = tile.identity
    if (tile.isLocal) {
      tile.showVideo = localCam
      tile.isSpeaking = speaking.has(id)
      tile.isMuted = !local.isMicrophoneEnabled
    } else {
      const p = room.remoteParticipants.get(id)
      if (!p) return
      tile.showVideo = videoSet.has(id) && hasSubscribedVideoTrack(p)
      tile.isSpeaking = speaking.has(id)
      tile.isMuted = !p.isMicrophoneEnabled
    }
    tile.label = String(labels[id] || id)
  }

  /** Повне оновлення полів одного тайла з поточного стану кімнати. */
  function patchTileIdentity(room, identity) {
    const tile = tileByIdentity.get(identity)
    if (!tile) return
    const videoSet = computeVideoPickSet(room)
    const speaking = new Set(room.activeSpeakers.map((p) => p.identity))
    const labels = playerLabels.value ?? {}
    const local = room.localParticipant
    const localCam = local.isCameraEnabled === true
    patchTileFromRoom(tile, room, videoSet, speaking, labels, local, localCam)
  }

  /**
   * Повертає true, якщо виконано applySubscriptions (змінився контекст підписок).
   * Оновлює lastVideoPick і патчить showVideo лише для symmetric diff pick-множин + local.
   */
  function refreshSubscriptionsIfNeeded(room) {
    applyVolume(room)
    const sk = subscriptionContextKey(room)
    if (sk === lastSubscriptionKey) return false

    const oldPick = lastVideoPick
    applySubscriptions(room)
    lastSubscriptionKey = sk
    const newPick = computeVideoPickSet(room)

    for (const id of oldPick) {
      if (!newPick.has(id)) patchTileIdentity(room, id)
    }
    for (const id of newPick) {
      if (!oldPick.has(id)) patchTileIdentity(room, id)
    }
    patchTileIdentity(room, room.localParticipant.identity)

    lastVideoPick = newPick
    applySubscriberVideoQualityCap(room)
    return true
  }

  /** Дельта isSpeaking між кадрами (без зміни відео-слотів). */
  function patchSpeakingDelta(room) {
    const now = new Set(room.activeSpeakers.map((p) => p.identity))
    for (const id of now) {
      if (!prevActiveSpeakerIds.has(id)) {
        const t = tileByIdentity.get(id)
        if (t && !t.isSpeaking) t.isSpeaking = true
      }
    }
    for (const id of prevActiveSpeakerIds) {
      if (!now.has(id)) {
        const t = tileByIdentity.get(id)
        if (t && t.isSpeaking) t.isSpeaking = false
      }
    }
    prevActiveSpeakerIds = now
  }

  /**
   * Повне узгодження списку тайлів із room + порядок у масиві (O(n) — лише connect/disconnect/Reconcile).
   */
  function reconcileArrayOrder(room) {
    applyVolume(room)
    const speaking = new Set(room.activeSpeakers.map((p) => p.identity))
    const local = room.localParticipant
    const ordered = sortRemoteIds(room)
    const localCam = local.isCameraEnabled === true
    const _videoSet = computeVideoPickSet(room)
    const labels = playerLabels.value ?? {}
    const eliminated = eliminatedSlots?.value ?? new Set()

    const desired = []
    if (includeLocal.value) {
      desired.push({ id: local.identity, isLocal: true, p: local })
    }
    for (const id of ordered) {
      if (eliminated.has(id)) continue
      const p = room.remoteParticipants.get(id)
      if (p) desired.push({ id, isLocal: false, p })
    }

    const wantIds = new Set(desired.map((d) => d.id))
    for (const id of [...tileByIdentity.keys()]) {
      if (!wantIds.has(id)) {
        tileByIdentity.delete(id)
        triggerRef(tileMapRef)
      }
    }

    for (const d of desired) {
      const tile = getOrCreateTile(d.id, d.p, d.isLocal)
      patchTileFromRoom(tile, room, _videoSet, speaking, labels, local, localCam)
    }

    const nextArr = desired.map((d) => tileByIdentity.get(d.id)).filter(Boolean)
    const cur = tiles.value
    let orderDirty = cur.length !== nextArr.length
    if (!orderDirty) {
      for (let i = 0; i < nextArr.length; i++) {
        if (cur[i] !== nextArr[i]) {
          orderDirty = true
          break
        }
      }
    }
    if (orderDirty) {
      cur.splice(0, cur.length, ...nextArr)
      triggerRef(tiles)
    }

    prevActiveSpeakerIds = new Set(room.activeSpeakers.map((p) => p.identity))
  }

  function clearRoomState() {
    tileByIdentity.clear()
    triggerRef(tileMapRef)
    lastSubscriptionKey = ''
    lastVideoPick = new Set()
    prevActiveSpeakerIds = new Set()
    const cur = tiles.value
    if (cur.length) {
      cur.splice(0, cur.length)
      triggerRef(tiles)
    }
  }

  function bootstrapRoomSession(room) {
    lastSubscriptionKey = ''
    lastVideoPick = new Set()
    prevActiveSpeakerIds = new Set(room.activeSpeakers.map((p) => p.identity))
    applyVolume(room)
    applySubscriptions(room)
    lastSubscriptionKey = subscriptionContextKey(room)
    lastVideoPick = computeVideoPickSet(room)
    applySubscriberVideoQualityCap(room)
    reconcileArrayOrder(room)
  }

  /** Стан одного rAF-кадру (коалісація подій). */
  let flushRaf = 0
  let needSpeakingDelta = false
  let needReconcile = false
  const pendingTrackIdentities = new Set()

  function runFlushedFrame(room) {
    if (typeof document !== 'undefined' && document.hidden) {
      return
    }
    applyVolume(room)

    const sk = subscriptionContextKey(room)
    const subWouldChange = sk !== lastSubscriptionKey

    if (needReconcile || subWouldChange) {
      refreshSubscriptionsIfNeeded(room)
      reconcileArrayOrder(room)
      needReconcile = false
      needSpeakingDelta = false
      pendingTrackIdentities.clear()
      return
    }

    if (needSpeakingDelta) {
      patchSpeakingDelta(room)
      needSpeakingDelta = false
    }

    if (refreshSubscriptionsIfNeeded(room)) {
      reconcileArrayOrder(room)
      pendingTrackIdentities.clear()
      return
    }

    for (const id of pendingTrackIdentities) {
      patchTileIdentity(room, id)
    }
    pendingTrackIdentities.clear()
  }

  /** @param {import('livekit-client').Room | null} room */
  function scheduleFlush(room) {
    if (!room) {
      if (flushRaf) {
        cancelAnimationFrame(flushRaf)
        flushRaf = 0
      }
      clearRoomState()
      return
    }
    if (flushRaf) return
    flushRaf = requestAnimationFrame(() => {
      flushRaf = 0
      runFlushedFrame(room)
    })
  }

  watchEffect((onCleanup) => {
    const room = roomRef.value
    if (!room) {
      clearRoomState()
      return
    }

    function onParticipantConnected() {
      needReconcile = true
      scheduleFlush(room)
    }

    function onParticipantDisconnected(p) {
      const id = p.identity
      if (tileByIdentity.has(id)) {
        tileByIdentity.delete(id)
        triggerRef(tileMapRef)
      }
      const cur = tiles.value
      const idx = cur.findIndex((t) => t.identity === id)
      if (idx >= 0) {
        cur.splice(idx, 1)
        triggerRef(tiles)
      }
      prevActiveSpeakerIds.delete(id)
      needReconcile = true
      scheduleFlush(room)
    }

    function onActiveSpeakersChanged() {
      const sk = subscriptionContextKey(room)
      if (sk !== lastSubscriptionKey) {
        needReconcile = true
      } else {
        needSpeakingDelta = true
      }
      scheduleFlush(room)
    }

    function onLocalTrack() {
      needReconcile = true
      scheduleFlush(room)
    }

    /** @param {LkParticipant} participant */
    function onTrackSurface(participant) {
      pendingTrackIdentities.add(participant.identity)
      scheduleFlush(room)
    }

    const pairs = [
      [RoomEvent.ParticipantConnected, onParticipantConnected],
      [RoomEvent.ParticipantDisconnected, onParticipantDisconnected],
      [RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged],
      [RoomEvent.LocalTrackPublished, onLocalTrack],
      [RoomEvent.LocalTrackUnpublished, onLocalTrack],
      [
        RoomEvent.TrackMuted,
        (/** @type {unknown} */ _pub, participant) => onTrackSurface(participant),
      ],
      [
        RoomEvent.TrackUnmuted,
        (/** @type {unknown} */ _pub, participant) => onTrackSurface(participant),
      ],
      [
        RoomEvent.TrackSubscribed,
        (/** @type {unknown} */ _track, /** @type {unknown} */ _pub, participant) =>
          onTrackSurface(participant),
      ],
      [
        RoomEvent.TrackUnsubscribed,
        (/** @type {unknown} */ _track, /** @type {unknown} */ _pub, participant) =>
          onTrackSurface(participant),
      ],
      [
        RoomEvent.TrackSubscriptionStatusChanged,
        (/** @type {unknown} */ _pub, /** @type {unknown} */ _status, participant) =>
          onTrackSurface(participant),
      ],
    ]
    for (const [e, h] of pairs) {
      room.on(e, h)
    }

    function onVisibilityChange() {
      if (typeof document === 'undefined' || document.hidden) return
      scheduleFlush(room)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }

    bootstrapRoomSession(room)

    onCleanup(() => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
      if (flushRaf) {
        cancelAnimationFrame(flushRaf)
        flushRaf = 0
      }
      needSpeakingDelta = false
      needReconcile = false
      pendingTrackIdentities.clear()
      for (const [e, h] of pairs) {
        try {
          room.off(e, h)
        } catch {
          /* */
        }
      }
    })
  })

  if (volumeByIdentity) {
    watch(volumeByIdentity, () => {
      const room = roomRef.value
      if (room) applyVolume(room)
    })
  }

  watch(
    () => playerLabels.value,
    () => {
      const room = roomRef.value
      if (!room) return
      const labels = playerLabels.value ?? {}
      for (const t of tileByIdentity.values()) {
        t.label = String(labels[t.identity] || t.identity)
      }
    },
  )

  function fullExternalReconcile(room) {
    refreshSubscriptionsIfNeeded(room)
    reconcileArrayOrder(room)
  }

  watch(
    () => [
      String(spotlightSlot.value ?? ''),
      String(speakerSlot.value ?? ''),
      includeLocal.value,
      resolveMaxVideo(),
      resolveSubscriberQuality(),
    ],
    () => {
      const room = roomRef.value
      if (room) fullExternalReconcile(room)
    },
  )

  watch(
    () => {
      const s = eliminatedSlots?.value
      if (!s || s.size === 0) return ''
      return [...s].sort().join('\0')
    },
    () => {
      const room = roomRef.value
      if (room) fullExternalReconcile(room)
    },
  )

  return { tiles, tileMapRef }
}
