export type UserRole = 'admin' | 'user' | 'host'

/** Stored in JWT / cookie payload (snake_case for backward-compatible tokens). */
export type SessionUser = {
  id: string
  display_name: string
  profile_image_url: string
  /** Set for app OAuth / email; omitted in older JWTs. */
  provider?: 'twitch' | 'google' | 'apple' | 'email'
  /** Google + email-password users; used for ADMIN_EMAILS matching. */
  email?: string
  /** Helix user id for Twitch (same value as `id` for Twitch logins); for ADMIN_TWITCH_IDS debugging/API clarity. */
  twitch_id?: string
  role: UserRole
}

/** Global app API shape (GET /api/auth/me). */
export type GlobalAuthUser = {
  id: string
  /** Prisma `User.id` when the session is linked to a database row (leaderboards use this id). */
  dbUserId?: string
  displayName: string
  avatar?: string
  provider: 'twitch' | 'google' | 'apple' | 'email' | null
  role: UserRole
  /** Present when the user signed in with Twitch (Helix user id). */
  twitchId?: string
  /** When this account matches an active `Streamer` row (owner or same Twitch id). */
  wordleStreamerId?: string
  /** Public `/wordle/:name` slug for that streamer. */
  wordleStreamerName?: string
}
