/**
 * Phase 1 adaptive-receiver-simulcast feature gates. Constants only — no UI knob.
 *
 * Rollback: flip both `ENABLE_*` to false → call stack reverts to the historical
 * single-encoding / no-preferred-layers behavior end-to-end.
 *
 * Threshold rationale: at 6 active camera publishers a desktop receiver still
 * decodes inside its CPU envelope (~5 × 854×480/20 fps VP8). At 7+ phones and
 * weak laptops start to thermal-throttle, so that's where simulcast pays for
 * the extra publisher cost. Tunable via this constant; do not scatter the
 * threshold across files.
 */
export const ENABLE_PUBLISHER_SIMULCAST = true

/**
 * Receiver picks one baseline layer for all normal webcam consumers based on
 * device profile + sustained pressure. Screen-share consumers always pin to
 * the highest available layer regardless of baseline (see receiverBaselineLayerPolicy).
 */
export const ENABLE_RECEIVER_ADAPTIVE_LAYERS = true

/**
 * Strictly greater-than threshold: rooms with `> SIMULCAST_ACTIVE_CAMERA_THRESHOLD`
 * active camera publishers turn on publisher simulcast (desktop only). 1–6 stays
 * on today's single-encoding path so small rooms see zero behavior change.
 */
export const SIMULCAST_ACTIVE_CAMERA_THRESHOLD = 6
