import WebSocket from 'ws'
import type { Consumer, Producer, WebRtcTransport } from 'mediasoup/types'

export class Peer {
  readonly id: string
  readonly socket: WebSocket
  readonly roomId: string
  readonly userId: string
  /**
   * Server-authoritative Prisma `User.id` resolved from the WS-upgrade session
   * cookie via `resolvePrismaUserIdFromSession`. Empty string for anonymous
   * sockets or sockets where DB lookup is unavailable. Used by Eat First host
   * authority to compare `peer.prismaUserId === room.ownerUserId` (audit R3).
   *
   * Distinct from `userId`: `userId` is the session JWT `id` (e.g. Twitch
   * profile id for Twitch users), while `prismaUserId` is the internal Prisma
   * row id. For Twitch users they differ; for email users they may coincide.
   * Mafia/GameRoom continue to authorize by `userId` (session id) and are
   * unaffected by this field.
   */
  readonly prismaUserId: string
  /** Shown to other participants (from join-room / update-display-name). */
  displayName: string
  /** HTTPS profile URL from join-room (opaque to SFU). */
  avatarUrl: string
  
  audioMuted = false
  /**
   * Mafia host enforcement: when true, the SFU keeps this peer's audio
   * producers paused regardless of the peer's own `set-audio-muted`. UI
   * mute icon reflects `audioMuted || forcedAudioMuted` so remote peers
   * see "muted" even if the user has not muted themselves.
   */
  forcedAudioMuted = false
  /**
   * Mafia host enforcement: when true, the SFU keeps this peer's video
   * producers paused (both camera and screen — spoof-resistant). The peer's
   * own `set-outbound-video-paused: false` is ignored while this is set.
   * Cleared when the peer leaves the room (Peer destroyed) or when the host
   * resends `mafia:force-camera-off` with `paused: false`.
   */
  forcedCameraOff = false
  
  mafiaSessionId = ''
  /**
   * Generic game-room (Phase 3A) host session id. Parallel to
   * `mafiaSessionId` but for the `gameroom:<base>` namespace. The two are
   * intentionally separate so a user who hosts a Mafia room and a game-room
   * with the same base id keeps independent host identities per namespace.
   */
  gameRoomSessionId = ''
  /**
   * Eat First identity: server-validated slot id (`p1`..`p11`) the peer
   * claimed via `eat:slot-claim` (token/device auth). Call moderator never binds a seat.
   * Used by Eat First trait-overlay logic to map call peers to authoritative `EatFirstPlayer`
   * rows; never trusted from the client without server verification.
   */
  eatFirstSlotId: string | null = null
  /**
   * Set during full-peer removal (`removePeerFromNetwork`) before
   * `closeAllMedia()` is invoked. The `transportclose` listeners installed
   * on producers run synchronously inside `closeAllMedia()` and would each
   * broadcast `producer-closed` to every peer — N redundant messages on top
   * of the single authoritative `peer-left`. Checking this flag lets those
   * listeners no-op during teardown while still firing for legitimate
   * transport-lost-but-peer-stays cases (e.g. one-direction ICE failure).
   */
  isTearingDown = false

  private readonly transports = new Map<string, WebRtcTransport>()
  private readonly producers = new Map<string, Producer>()
  private readonly consumers = new Map<string, Consumer>()
  /** Outbound video semantic (`replaceTrack` does not change id). */
  private readonly videoProducerSourceById = new Map<string, 'camera' | 'screen'>()
  /**
   * Reverse index: producerId → set of this peer's consumers for that producer.
   * Used by `requestVideoKeyframesForProducerConsumers` to avoid O(peers × consumers)
   * linear scans on every `producer-video-source` change (a 12-peer call
   * previously iterated ~144 consumers per replaceTrack).
   *
   * A peer normally has exactly one consumer per producer, but this keeps a
   * Set to stay correct if simulcast or a reconnect ever produces duplicates.
   */
  private readonly consumersByProducerId = new Map<string, Set<Consumer>>()

  constructor(
    id: string,
    socket: WebSocket,
    roomId: string,
    displayName: string,
    avatarUrl = '',
    userId = '',
    prismaUserId = '',
  ) {
    this.id = id
    this.socket = socket
    this.roomId = roomId
    this.userId = userId
    this.prismaUserId = prismaUserId
    this.displayName = displayName
    this.avatarUrl = avatarUrl
  }

  sendJson(payload: unknown): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload))
    }
  }

  /**
   * Send a payload that has already been serialised. Used by broadcast helpers
   * that stringify once and reuse the same string for every peer in the room
   * (avoids N redundant `JSON.stringify` calls on identical messages such as
   * `peer-left`, `producer-closed`, mafia state updates).
   */
  sendRaw(serialized: string): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(serialized)
    }
  }

  addTransport(transport: WebRtcTransport): void {
    this.transports.set(transport.id, transport)
  }

  getTransport(transportId: string): WebRtcTransport | undefined {
    return this.transports.get(transportId)
  }

  removeTransport(transportId: string): void {
    const transport = this.transports.get(transportId)
    if (transport && !transport.closed) {
      transport.close()
    }
    this.transports.delete(transportId)
  }

  closeTransportsForDirection(direction: 'send' | 'recv'): void {
    for (const transport of [...this.transports.values()]) {
      const appData = transport.appData as { direction?: string }
      if (appData?.direction === direction) {
        this.removeTransport(transport.id)
      }
    }
  }

  addProducer(producer: Producer): void {
    this.producers.set(producer.id, producer)
    if (producer.kind === 'video' && !this.videoProducerSourceById.has(producer.id)) {
      this.videoProducerSourceById.set(producer.id, 'camera')
    }
  }

  getProducer(producerId: string): Producer | undefined {
    return this.producers.get(producerId)
  }

  removeProducer(producerId: string): void {
    const producer = this.producers.get(producerId)
    if (producer && !producer.closed) {
      producer.close()
    }
    this.producers.delete(producerId)
    this.videoProducerSourceById.delete(producerId)
  }

  getVideoProducerSource(producerId: string): 'camera' | 'screen' | undefined {
    return this.videoProducerSourceById.get(producerId)
  }

  setVideoProducerSource(producerId: string, source: 'camera' | 'screen'): void {
    const producer = this.producers.get(producerId)
    if (!producer || producer.closed || producer.kind !== 'video') {
      return
    }
    this.videoProducerSourceById.set(producerId, source)
  }

  getProducers(): Producer[] {
    return [...this.producers.values()]
  }

  addConsumer(consumer: Consumer): void {
    this.consumers.set(consumer.id, consumer)
    let set = this.consumersByProducerId.get(consumer.producerId)
    if (!set) {
      set = new Set()
      this.consumersByProducerId.set(consumer.producerId, set)
    }
    set.add(consumer)
  }

  getConsumer(consumerId: string): Consumer | undefined {
    return this.consumers.get(consumerId)
  }

  /** O(1) lookup for keyframe / per-producer signaling; empty array when none. */
  getConsumersByProducerId(producerId: string): Consumer[] {
    const set = this.consumersByProducerId.get(producerId)
    return set ? [...set] : []
  }

  removeConsumer(consumerId: string): void {
    const consumer = this.consumers.get(consumerId)
    if (consumer) {
      if (!consumer.closed) {
        consumer.close()
      }
      const set = this.consumersByProducerId.get(consumer.producerId)
      if (set) {
        set.delete(consumer)
        if (set.size === 0) {
          this.consumersByProducerId.delete(consumer.producerId)
        }
      }
    }
    this.consumers.delete(consumerId)
  }

  getConsumers(): Consumer[] {
    return [...this.consumers.values()]
  }

  closeAllMedia(): void {
    for (const consumer of [...this.consumers.values()]) {
      if (!consumer.closed) {
        consumer.close()
      }
    }
    this.consumers.clear()
    this.consumersByProducerId.clear()

    for (const producer of [...this.producers.values()]) {
      if (!producer.closed) {
        producer.close()
      }
    }
    this.producers.clear()
    this.videoProducerSourceById.clear()

    for (const transport of [...this.transports.values()]) {
      if (!transport.closed) {
        transport.close()
      }
    }
    this.transports.clear()
  }
}
