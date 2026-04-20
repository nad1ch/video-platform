/**
 * Twitch user id (numeric string) of the channel owner / moderator who may call "next-word".
 * Prefer env in production; placeholder matches product spec until you set it.
 */
export const TWITCH_ADMIN_USER_ID = process.env.TWITCH_ADMIN_USER_ID ?? 'YOUR_TWITCH_ID'

export function isAdminConfigured(): boolean {
  return TWITCH_ADMIN_USER_ID !== 'YOUR_TWITCH_ID'
}

export function isAdminTwitchUserId(userId: string): boolean {
  if (!isAdminConfigured()) {
    return false
  }
  return userId === TWITCH_ADMIN_USER_ID
}
