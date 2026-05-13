/**
 * Diagnostics + GameSessionReport schema — client-side type-only copy.
 *
 * The server keeps a mirrored type module at
 * `apps/server/src/signaling/roomDiagnosticsTypes.ts`. The two files define
 * the same JSON wire format used by `POST /api/events/room` and the admin
 * report endpoint; runtime never crosses the boundary, matching the existing
 * `mafiaWsProtocol.ts` client/server duplication pattern.
 *
 * Deliberately not placed under `packages/call-core/` — diagnostics is
 * broader than the call/media stack and we do not want app-level event
 * vocabularies to bleed into the reusable WebRTC package.
 */

export type DiagnosticLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical'

export type DiagnosticArea =
  | 'room'
  | 'ws'
  | 'webrtc'
  | 'media'
  | 'playback'
  | 'game'
  | 'auth'
  | 'twitch'
  | 'ui'
  | 'performance'
  | 'backend'

export type DiagnosticGameType =
  | 'mafia'
  | 'game-room'
  | 'eat-first'
  | 'nadle'
  | 'nadraw-show'
  | 'checkers'
  | null

export type DiagnosticEventType =
  | 'room_created'
  | 'room_joined'
  | 'room_left'
  | 'room_closed'
  | 'ws_connecting'
  | 'ws_connected'
  | 'ws_disconnected'
  | 'ws_reconnecting'
  | 'ws_reconnected'
  | 'ws_error'
  | 'ws_message_send_failed'
  | 'stale_socket_ignored'
  | 'media_join_started'
  | 'media_join_completed'
  | 'producer_created'
  | 'producer_closed'
  | 'consumer_created'
  | 'consumer_closed'
  | 'consumer_failed'
  | 'replace_track_started'
  | 'replace_track_failed'
  | 'screen_share_started'
  | 'screen_share_stopped'
  | 'camera_restore_failed'
  | 'video_play_failed'
  | 'audio_play_failed'
  | 'uncaught_client_error'
  | 'unhandled_promise_rejection'
  | 'backend_handler_error'
  | 'game_started'
  | 'game_state_changed'
  | 'game_ended'
  | 'host_claimed'
  | 'host_conflict'
  | 'timer_started'
  | 'timer_stopped'

export interface DiagnosticEvent {
  id: string
  reportVersion: 1
  timestamp: number
  source: 'client' | 'server'
  level: DiagnosticLevel
  area: DiagnosticArea
  type: DiagnosticEventType
  roomId: string | null
  gameType: DiagnosticGameType
  peerId: string | null
  userId: string | null
  sessionId: string | null
  correlationId: string | null
  message: string
  context: Record<string, unknown>
  error?: {
    name: string
    stack?: string
    code?: string
  }
  env?: {
    ua?: string
    platform?: 'desktop' | 'mobile'
    isView?: boolean
    hidden?: boolean
    deviceMemory?: number
    hardwareConcurrency?: number
  }
}

export interface GameSessionReport {
  reportVersion: 1
  generatedAt: string
  exportedBy: 'admin' | 'self-export'
  room: {
    roomId: string
    baseRoomId: string
    gameType: DiagnosticGameType
    createdAt: string
    endedAt?: string
    durationMs?: number
    workerIndex?: number
  }
  participants: Array<{
    peerId: string
    userId: string | null
    displayName: string
    joinedAt: string
    leftAt?: string
    reconnectCount: number
    role?: 'host' | 'player' | 'viewer' | 'obs-view'
    finalPresence: 'present' | 'left' | 'kicked' | 'ghost'
    flags?: { forcedAudioMuted?: boolean; forcedCameraOff?: boolean }
  }>
  summary: {
    totalEvents: number
    errors: number
    criticals: number
    warns: number
    truncated: boolean
    eventsDroppedOlderThan?: string
    networkQuality?: 'good' | 'degraded' | 'unstable'
    reconnectStorms: number
    workerEvacuated: boolean
  }
  timeline: DiagnosticEvent[]
  groupedErrors: Array<{
    signature: string
    count: number
    firstAt: string
    lastAt: string
    affectedPeerIds: string[]
    sampleMessage: string
    sampleStackHash?: string
  }>
  mediaTimeline: DiagnosticEvent[]
  wsTimeline: DiagnosticEvent[]
  reconnectTimeline: DiagnosticEvent[]
  gameTimeline: DiagnosticEvent[]
  criticalMoments: Array<{
    at: string
    label: string
    around: DiagnosticEvent[]
  }>
  hints: Array<{
    confidence: 'low' | 'medium' | 'high'
    summary: string
    suggestedFiles?: string[]
  }>
  environment: {
    server: {
      nodeVersion: string
      mediasoupWorkerCount: number
      worker: { dead: boolean; roomCount: number } | null
    }
    clientSamples: Array<{
      peerId: string
      ua: string
      platform: 'desktop' | 'mobile'
      isView: boolean
      deviceMemory?: number
      hardwareConcurrency?: number
    }>
  }
  caps: {
    maxEvents: 2000
    maxTimelineBytes: 1000000
  }
}
