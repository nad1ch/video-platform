/**
 * Reusable mediasoup/WebRTC call stack. Prefer `useCallOrchestrator()` from app code (facade);
 * use `useCallEngine()` when composing inside this package or for tests. Submodules are for custom compositions.
 */
export {
  useCallEngine,
  type CallChatLine,
  type CallEngineOptions,
  type CallEngineRole,
  type CallSessionStore,
  type CallTile,
} from './useCallEngine'

export { useCallOrchestrator } from './useCallOrchestrator'

export {
  SCREEN_SHARE_GET_DISPLAY_MEDIA,
  useCallScreenShare,
  useScreenShare,
  type UseCallScreenShareDeps,
} from './screenShare/useCallScreenShare'
export { localPreviewStreamForOutbound } from './screenShare/previewStream'
export type { OutboundVideoSource } from './screenShare/outboundVideoSource'

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

export {
  applyWebcamContentHint,
  DEFAULT_CALL_AUDIO_CONSTRAINTS,
  DEFAULT_CALL_VIDEO_CONSTRAINTS,
  getVideoConstraintsForPreset,
} from './media/defaultMediaConstraints'
export type { ConsumerLifecycleStatus, ConsumerState } from './media/consumeLifecycle'
export { useLocalMedia, type CallMediaDeviceOption, type UseLocalMediaOptions } from './media/useLocalMedia'
export { gridSizeTierFromParticipantCount } from './media/gridTier'
export { mergeProducerLists } from './media/mergeProducerLists'
export {
  buildCallParticipantMap,
  guestDisplayNameForPeerId,
  mapTilesToParticipants,
  resolveParticipantDisplayName,
  type CallParticipant,
  type Participant,
  type ParticipantTileInput,
  type TileLike,
} from './utils/participantsMapper'
export {
  buildDisplayNameUiMap,
  resolvePeerDisplayNameForUi,
  type ResolvePeerDisplayNameForUiOptions,
} from './utils/resolvePeerDisplayName'
export { normalizeDisplayName } from './utils/normalizeDisplayName'
export {
  ACTIVE_CAMERA_SMALL_ROOM_MAX,
  AUTO_LARGE_ROOM_VIDEO_CAPTURE,
  AUTO_SMALL_ROOM_VIDEO_CAPTURE,
  countActiveCameraPublishersAtWire,
  getCallVideoConstraints,
  getSimulcastEncodingsForPreset,
  getSingleLayerEncodingsForPreset,
  isVideoQualityPreset,
  resolveOutgoingVideoPublishTier,
  resolveVideoPublishTier,
  VIDEO_QUALITY_PRESETS,
  type VideoPublishTier,
  type VideoQualityPreset,
} from './media/videoQualityPreset'
export {
  shouldUseVideoSimulcastForRoom,
  spatialLayerForGridSizeTier,
  VIDEO_SIMULCAST_MIN_PEERS_IN_ROOM,
  VP8_SIMULCAST_ENCODINGS,
  VP8_SINGLE_LAYER_ENCODING,
} from './media/videoSimulcast'
export { useMediasoupDevice } from './media/useMediasoupDevice'
export {
  useRemoteMedia,
  type InboundVideoDebugRow,
  type RemotePeerStream,
  type RemoteProducerInfo,
  type SetupReceivePathOptions,
} from './media/useRemoteMedia'

export { loadRemoteListeningPrefs, saveRemoteListeningPrefs, type RemoteListenEntry } from './audio/remoteListeningPrefs'

export {
  useRoomConnection,
  type RoomPeerInfo,
  type RoomStatePayload,
  type WsStatus,
} from './signaling/useRoomConnection'

export { parseProducerSyncPayload } from './signaling/producerSyncPayload'

export {
  useSendTransport,
  type PendingProducerNotice,
  type PublishLocalMediaOptions,
  type SendTransportRoomApi,
} from './transport/useSendTransport'

export { waitForCondition } from './utils/waitForCondition'
export { tryConsumeProducerOnce, type ConsumeOnceResult } from './utils/consumerDedup'
export { newCallTabPeerId, readOrCreateCallDeviceId } from './utils/callTabPeerId'
export { replyJsonPingIfNeeded } from './utils/jsonWsPing'
