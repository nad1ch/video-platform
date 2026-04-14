/**
 * Той самий WebRTC-сигналінг, що й для Video call (VITE_SIGNALING_URL / dev localhost).
 * Overlay Eat First підключається до кімнати з ім’ям `gameId`.
 */
export function mediasoupSignalingAvailable() {
  if (import.meta.env.DEV) {
    return true
  }
  const u = import.meta.env.VITE_SIGNALING_URL
  return typeof u === 'string' && u.trim().length > 0
}
