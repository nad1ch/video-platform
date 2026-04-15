/** Stored in JWT / cookie payload (snake_case for backward-compatible tokens). */
export type SessionUser = {
  id: string
  display_name: string
  profile_image_url: string
  /** Set for app OAuth; omitted in older JWTs. */
  provider?: 'twitch' | 'google' | 'apple'
}

/** Global app API shape (GET /api/auth/me). */
export type GlobalAuthUser = {
  id: string
  displayName: string
  avatar?: string
  provider: 'twitch' | 'google' | 'apple' | null
}
