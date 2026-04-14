/**
 * Reusable mediasoup/WebRTC call stack. Prefer `useCallEngine()` as the single entry point;
 * import submodules for custom compositions.
 */
export {
  useCallEngine,
  type CallEngineOptions,
  type CallEngineRole,
  type CallSessionStore,
  type CallTile,
} from './useCallEngine'

export { useCallSessionStore, type RoomPeerEntry } from './stores/callSession'

export {
  initAudioPlaybackUnlock,
  isAudioPlaybackUnlocked,
  playAllPageAudio,
  playAllPageAudioThrottled,
  registerAudioUnlockHook,
} from './audio/audioPlaybackUnlock'

export { getAudioAnalysisAudioContext } from './audio/audioAnalysisContext'
export { useActiveSpeaker, type ActiveSpeakerTile } from './audio/useActiveSpeaker'

export { useLocalMedia } from './media/useLocalMedia'
export { gridSizeTierFromParticipantCount } from './media/gridTier'
export { spatialLayerForGridSizeTier, VP8_SIMULCAST_ENCODINGS } from './media/videoSimulcast'
export { useMediasoupDevice } from './media/useMediasoupDevice'
export {
  useRemoteMedia,
  type RemotePeerStream,
  type RemoteProducerInfo,
} from './media/useRemoteMedia'

export {
  useRoomConnection,
  type RoomPeerInfo,
  type RoomStatePayload,
  type WsStatus,
} from './signaling/useRoomConnection'

export {
  useSendTransport,
  type PendingProducerNotice,
  type SendTransportRoomApi,
} from './transport/useSendTransport'

export { waitForCondition } from './utils/waitForCondition'
