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


export type SessionUser = {
  id: string
  display_name: string
  profile_image_url: string
  
  provider?: 'twitch' | 'google' | 'apple' | 'email'
  
  email?: string
  
  twitch_id?: string
  role: UserRole
}


export type GlobalAuthUser = {
  id: string
  
  dbUserId?: string
  displayName: string
  avatar?: string
  provider: 'twitch' | 'google' | 'apple' | 'email' | null
  email?: string
  emailVerified?: boolean
  emailVerifiedAt?: string | null
  role: UserRole
  roles?: SystemRole[]
  permissions?: FeaturePermission[]
  
  twitchId?: string
  
  streamer?: AuthStreamerContext
  
  nadleStreamerId?: string
  
  nadleStreamerName?: string
}
