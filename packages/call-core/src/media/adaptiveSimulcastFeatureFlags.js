/**
 * Phase 1 adaptive-receiver-simulcast feature gates. Constants only — no UI knob.
 *
 * Rollback: flip both `ENABLE_*` to false → call stack reverts to the historical
 * single-encoding / no-preferred-layers behavior end-to-end.
 */
export const ENABLE_PUBLISHER_SIMULCAST = true;
/**
 * Receiver picks one baseline layer for all normal webcam consumers based on
 * device profile + sustained pressure. Screen-share consumers always pin to
 * the highest available layer regardless of baseline (see receiverBaselineLayerPolicy).
 */
export const ENABLE_RECEIVER_ADAPTIVE_LAYERS = true;
/**
 * Publisher simulcast threshold (strictly greater-than). With value `1`:
 *   - 1 active camera in the room → desktop publishers emit ONE 480p encoding
 *     (today's behavior; no simulcast supply, no policy work).
 *   - 2+ active cameras            → desktop publishers emit 3 simulcast
 *                                    encodings (q/h/f). Receivers can then
 *                                    pick a baseline layer from the supply.
 *   - mobile / tablet publishers   → always single encoding (gated by `isMobile`
 *                                    inside `shouldUsePublisherSimulcast`).
 *   - publisher screen-sharing at wire → always single encoding (gated by
 *                                       `isScreenSharingAtWire`).
 *
 * Why threshold=1: the moment a second camera joins, at least one receiver in
 * the room is decoding two streams; simulcast supply lets weak receivers and
 * OBS viewers pick a lower rung based on their profile / runtime pressure
 * without affecting strong receivers. Cost on desktop publishers is ~3 libvpx
 * encoders running in parallel; libwebrtc's `CpuOveruseDetector` adapts FPS /
 * resolution per-rid automatically if a publisher CPU is overloaded.
 *
 * Tunable via this constant; do not scatter the threshold across files.
 */
export const SIMULCAST_ACTIVE_CAMERA_THRESHOLD = 1;
