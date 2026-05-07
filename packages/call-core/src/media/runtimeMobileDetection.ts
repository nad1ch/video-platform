/**
 * Cheap runtime "is this a phone-class device?" sniff.
 *
 * Used to bias `getUserMedia` constraints AND to gate publisher simulcast
 * (we never enable simulcast on mobile publishers in Phase 1 — the encode
 * cost dwarfs the receive-side savings on a single device, and we have no
 * production telemetry on mobile encoder behavior at 3 layers yet).
 *
 * Prefers `navigator.userAgentData.mobile` (UA Client Hints) when available;
 * falls back to a UA substring match. Never used as a hard authority for
 * any feature; only for biasing.
 */
export function detectIsMobileRuntime(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  if (uaData && typeof uaData.mobile === 'boolean') {
    return uaData.mobile
  }
  const ua = typeof navigator.userAgent === 'string' ? navigator.userAgent : ''
  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua)
}
