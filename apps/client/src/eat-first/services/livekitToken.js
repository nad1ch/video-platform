import { getLiveKitTokenUrl } from '../config/livekit.js'

/**
 * Отримує JWT для LiveKit (з вашого бекенду або Vite dev middleware).
 * @param {{ roomName: string, identity: string, name?: string, canPublish?: boolean }} params
 * @returns {Promise<string>}
 */
export async function fetchLiveKitToken(params) {
  const { roomName, identity, name, canPublish } = params
  const base = getLiveKitTokenUrl()
  const absolute =
    base.startsWith('http://') || base.startsWith('https://')
      ? base
      : `${typeof window !== 'undefined' ? window.location.origin : ''}${base.startsWith('/') ? '' : '/'}${base}`

  const res = await fetch(absolute, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomName: String(roomName ?? '').trim(),
      identity: String(identity ?? '').trim(),
      name: String(name ?? identity ?? '').trim().slice(0, 128),
      canPublish: Boolean(canPublish),
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`LiveKit token ${res.status}: ${errText || res.statusText}`)
  }

  const data = await res.json()
  if (!data?.token || typeof data.token !== 'string') {
    throw new Error('LiveKit token: invalid response')
  }
  return data.token
}
