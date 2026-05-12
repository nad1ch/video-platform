import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue'
import type { CallChatLine } from 'call-core'

/**
 * Shape of the context provided by `<GameCallShell>` to descendants
 * (`<GameCallVideoGrid>`, `<GameCallTile>`, page-level dock placements, etc.).
 *
 * This module is intentionally Mafia/game-agnostic. Any per-game UI consumes
 * the orchestrator surface only — game-specific state is owned by the page
 * that mounts the shell.
 */

export interface GameCallTileLike {
  peerId: string
  stream: MediaStream | null
  displayName: string
  isLocal: boolean
  videoEnabled: boolean
  audioEnabled: boolean
  playRev?: number
  videoFillCover?: boolean
  remoteListenVolume?: number
  remoteListenMuted?: boolean
  handRaised?: boolean
  videoPresentation?: 'camera' | 'screen' | 'none'
  avatarUrl?: string
}

export interface GameCallDeviceChoice {
  deviceId: string
  label: string
}

export interface GameCallShellContext {
  // Status
  joining: Ref<boolean>
  joinError: Ref<string | null>
  inCall: Ref<boolean>
  wsStatus: Ref<string>

  // Identity
  selfPeerId: Ref<string | null | undefined>
  selfDisplayName: Ref<string | null | undefined>

  // Tiles
  tiles: ShallowRef<readonly GameCallTileLike[]> | Ref<readonly GameCallTileLike[]>
  sizeTier: ComputedRef<'sm' | 'md' | 'lg'> | Ref<'sm' | 'md' | 'lg'>

  // Media controls
  micEnabled: Ref<boolean>
  camEnabled: Ref<boolean>
  callDeafened: Ref<boolean>
  toggleMic: () => Promise<void> | void
  toggleCam: () => Promise<void> | void
  toggleCallDeafen: () => Promise<void> | void
  handRaised: Ref<boolean>
  toggleRaiseHand: () => Promise<void> | void
  screenSharing: Ref<boolean>
  toggleScreenShare: () => Promise<void> | void

  // Devices
  audioInputDevices: Ref<readonly GameCallDeviceChoice[]>
  videoInputDevices: Ref<readonly GameCallDeviceChoice[]>
  audioOutputDevices: Ref<readonly GameCallDeviceChoice[]>
  refreshMediaDevices: () => Promise<void> | void
  localAudioInputDeviceId: Ref<string | null | undefined>
  localVideoInputDeviceId: Ref<string | null | undefined>
  setCallAudioInputDevice: (deviceId: string) => Promise<void> | void
  setCallVideoInputDevice: (deviceId: string) => Promise<void> | void

  // Lifecycle
  joinLabRoom: () => Promise<void>
  leaveCall: () => void

  // Chat (passthrough; lab does not render chat by default)
  callChatMessages: Ref<readonly CallChatLine[]>
  sendChatMessage: (text: string) => void
}

export const GAME_CALL_SESSION_KEY: InjectionKey<GameCallShellContext> =
  Symbol('GameCallShellSession')
