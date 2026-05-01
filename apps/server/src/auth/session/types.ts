export type UserRole = 'admin' | 'user' | 'host'
export type SystemRole = 'USER' | 'ADMIN' | 'STREAMER'
export type FeaturePermission = 'EAT_FIRST_OPERATOR'

export type AuthStreamerContext = {
  id: string
  twitchId: string
  username: string
  displayName: string | null
  profileImageUrl: string | null
  broadcasterType: string | null
  followersCount: number | null
  currentOnline: number | null
  avgOnline7d: number | null
  isLive: boolean
  tier: string | null
}

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
  roles?: SystemRole[]
  permissions?: FeaturePermission[]
  /** Present when the user signed in with Twitch (Helix user id). */
  twitchId?: string
  /** Backend-authoritative streamer context when this user owns a Streamer row. */
  streamer?: AuthStreamerContext
  /** When this account matches an active `Streamer` row (owner or same Twitch id). */
  nadleStreamerId?: string
  /** Public `/nadle/:name` slug for that streamer. */
  nadleStreamerName?: string
}
