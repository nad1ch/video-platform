import tmi from 'tmi.js'
import { prisma } from '../prisma'
import {
  buildWordleRoundPersistencePayload,
  getCurrentGameId,
  getCurrentWordLength,
  submitGuess,
} from './gameStore'
import { persistWordleRound } from './persistRound'
import {
  broadcastTwitchChatLine,
  broadcastUserGuess,
  broadcastWordleIrcStatus,
} from './wordleSocket'
import { DEV_FALLBACK_STREAMER_ID } from './streamerContext'
import { isValidGuessShape, normalizeWord } from './wordleLogic'
import { readTwitchChatGuessCooldownMs, tryConsumeTwitchGuessThrottle } from './tmiGuessThrottle'

type IngestRow = { id: string; username: string; twitchId: string }

type Holder = {
  streamerId: string
  channel: string
  client: tmi.Client
  shuttingDown: boolean
  supplementalTimer: ReturnType<typeof setTimeout> | null
}

const holders = new Map<string, Holder>()
const ingestChannelByStreamer = new Map<string, string>()

function isDatabaseConfigured(): boolean {
  const u = process.env.DATABASE_URL
  return typeof u === 'string' && u.trim().length > 0
}

export async function listActiveStreamersForIngest(): Promise<IngestRow[]> {
  if (!isDatabaseConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[wordle] DATABASE_URL missing — no Twitch IRC ingest in production (add Streamer rows + DB).')
      return []
    }
    const username = (process.env.DEV_FALLBACK_STREAMER_USERNAME || 'nad1ch').trim().toLowerCase().replace(/^#/, '')
    return [
      {
        id: DEV_FALLBACK_STREAMER_ID,
        twitchId: 'dev',
        username,
      },
    ]
  }
  return prisma.streamer.findMany({
    where: { isActive: true },
    select: { id: true, username: true, twitchId: true },
  })
}

export function getIngestChannelForStreamer(streamerId: string): string | null {
  return ingestChannelByStreamer.get(streamerId) ?? null
}

function displayNameFromTags(tags: tmi.ChatUserstate): string {
  const raw = tags['display-name']
  if (typeof raw === 'string' && raw.length > 0) {
    return raw
  }
  return tags.username ?? 'unknown'
}

function clearSupplemental(h: Holder): void {
  if (h.supplementalTimer) {
    clearTimeout(h.supplementalTimer)
    h.supplementalTimer = null
  }
}

function armSupplementalReconnect(h: Holder, reason: string): void {
  clearSupplemental(h)
  h.supplementalTimer = setTimeout(() => {
    h.supplementalTimer = null
    if (h.shuttingDown) {
      return
    }
    if (!holders.has(h.streamerId)) {
      return
    }
    if (h.client.readyState() === 'CLOSED') {
      console.warn('[wordle/tmi] socket still CLOSED after delay; forcing connect()', {
        streamerId: h.streamerId,
        reason,
      })
      broadcastWordleIrcStatus(h.streamerId, { status: 'reconnecting', reason: 'supplemental-after-idle' })
      void h.client.connect().catch((err) => {
        console.error('[wordle/tmi] supplemental connect failed', { streamerId: h.streamerId, err })
        broadcastWordleIrcStatus(h.streamerId, { status: 'error', reason: String(err) })
        if (!h.shuttingDown && holders.get(h.streamerId) === h) {
          armSupplementalReconnect(h, 'after-supplemental-failure')
        }
      })
    }
  }, 10_000)
}

async function wireClient(h: Holder): Promise<void> {
  const { streamerId } = h
  const c = h.client

  c.on('message', (_channel, tags, message, self) => {
    if (self) {
      return
    }
    const userId = tags['user-id']
    if (!userId) {
      return
    }
    const displayName = displayNameFromTags(tags)
    const text = message.trim()
    const wordLen = getCurrentWordLength(streamerId)
    const normalized = normalizeWord(text)
    const looksLikeGuess = isValidGuessShape(normalized, wordLen)

    if (!looksLikeGuess) {
      broadcastTwitchChatLine(streamerId, {
        userId,
        displayName,
        text,
        validGuess: false,
      })
      return
    }

    if (!tryConsumeTwitchGuessThrottle(streamerId, userId)) {
      broadcastTwitchChatLine(streamerId, {
        userId,
        displayName,
        text,
        validGuess: false,
        rateLimited: true,
        cooldownMs: readTwitchChatGuessCooldownMs(),
      })
      return
    }

    const result = submitGuess(streamerId, userId, displayName, text, getCurrentGameId(streamerId))
    if (!result.ok) {
      broadcastTwitchChatLine(streamerId, {
        userId,
        displayName,
        text,
        validGuess: false,
      })
      return
    }

    broadcastTwitchChatLine(streamerId, {
      userId,
      displayName,
      text,
      validGuess: true,
      guessFeedback: result.feedback,
    })

    broadcastUserGuess(streamerId, {
      gameId: result.gameId,
      userId: result.userId,
      displayName: result.displayName,
      guess: result.guess,
      feedback: result.feedback,
      word: result.guess,
      result: result.feedback,
      attempts: result.attempts,
      guessed: result.guessed,
    })

    if (result.guessed) {
      const payload = buildWordleRoundPersistencePayload(streamerId, result.userId)
      if (payload) {
        void persistWordleRound(payload)
      }
    }
  })

  c.on('connecting', (addr, port) => {
    console.info('[wordle/tmi] connecting', { streamerId, addr, port })
    broadcastWordleIrcStatus(streamerId, { status: 'connecting' })
  })

  c.on('connected', (addr, port) => {
    clearSupplemental(h)
    console.info('[wordle/tmi] connected', { streamerId, addr, port })
    broadcastWordleIrcStatus(streamerId, { status: 'connected' })
  })

  c.on('disconnected', (reason) => {
    const r = typeof reason === 'string' ? reason : String(reason ?? '')
    console.warn('[wordle/tmi] disconnected', { streamerId, r })
    broadcastWordleIrcStatus(streamerId, { status: 'disconnected', reason: r })
    if (!h.shuttingDown) {
      armSupplementalReconnect(h, r)
    }
  })

  c.on('reconnect', () => {
    console.warn('[wordle/tmi] reconnecting (tmi internal backoff)', { streamerId })
    broadcastWordleIrcStatus(streamerId, { status: 'reconnecting', reason: 'tmi-internal' })
  })

  // @ts-expect-error TS2769 — event exists on Client at runtime
  c.on('maxreconnect', () => {
    console.error('[wordle/tmi] max reconnect attempts reached', { streamerId })
    broadcastWordleIrcStatus(streamerId, { status: 'error', reason: 'maxreconnect' })
  })

  c.on('notice', (_channel, _msgid, message) => {
    if (
      typeof message === 'string' &&
      (message.includes('Login unsuccessful') || message.includes('Login authentication failed'))
    ) {
      console.error('[wordle/tmi] IRC login notice', { streamerId, message })
      broadcastWordleIrcStatus(streamerId, { status: 'error', reason: message })
    }
  })

  try {
    await c.connect()
  } catch (err) {
    console.error('[wordle/tmi] initial connect failed', { streamerId, err })
    broadcastWordleIrcStatus(streamerId, { status: 'error', reason: String(err) })
    if (!h.shuttingDown) {
      armSupplementalReconnect(h, 'initial-connect-failed')
    }
  }
}

async function startIngestForStreamer(row: IngestRow): Promise<void> {
  await stopIngestForStreamer(row.id)

  const channel = row.username.replace(/^#/, '').toLowerCase()
  ingestChannelByStreamer.set(row.id, channel)

  const oauth = process.env.TWITCH_IRC_OAUTH?.trim()
  const username = process.env.TWITCH_IRC_USERNAME?.trim()

  const options: tmi.Options = {
    channels: [channel],
    connection: {
      reconnect: true,
      secure: true,
      timeout: 28_000,
      reconnectInterval: 3_000,
      reconnectDecay: 1.5,
      maxReconnectInterval: 60_000,
      maxReconnectAttempts: Infinity,
    },
  }

  if (oauth && username) {
    options.identity = { username, password: oauth.startsWith('oauth:') ? oauth : `oauth:${oauth}` }
  } else {
    const anon = `justinfan${Math.floor(Math.random() * 1e6)}`
    options.identity = { username: anon, password: 'SCHMOOPIIE' }
  }

  const client = new tmi.Client(options)
  const h: Holder = {
    streamerId: row.id,
    channel,
    client,
    shuttingDown: false,
    supplementalTimer: null,
  }
  holders.set(row.id, h)

  await wireClient(h)
}

export async function stopIngestForStreamer(streamerId: string): Promise<void> {
  const h = holders.get(streamerId)
  if (!h) {
    return
  }
  h.shuttingDown = true
  clearSupplemental(h)
  holders.delete(streamerId)
  ingestChannelByStreamer.delete(streamerId)
  try {
    await h.client.disconnect()
  } catch (err) {
    console.warn('[wordle/tmi] disconnect() finished with error (ignored)', { streamerId, err })
  }
}

export async function startTwitchChatIngest(): Promise<void> {
  await stopTwitchChatIngest()
  const rows = await listActiveStreamersForIngest()
  if (rows.length === 0) {
    console.warn('[wordle] No active Streamer rows — Twitch chat ingest disabled')
    return
  }
  const oauth = process.env.TWITCH_IRC_OAUTH?.trim()
  const namedUser = process.env.TWITCH_IRC_USERNAME?.trim()
  if (!oauth || !namedUser) {
    console.info('[wordle] Using read-only IRC (justinfan) for ingest; set TWITCH_IRC_USERNAME + TWITCH_IRC_OAUTH for a named bot')
  }
  for (const row of rows) {
    try {
      await startIngestForStreamer(row)
    } catch (e) {
      console.error('[wordle/tmi] failed to start ingest for streamer', row.id, e)
    }
  }
}

export async function stopTwitchChatIngest(): Promise<void> {
  const ids = [...holders.keys()]
  for (const id of ids) {
    await stopIngestForStreamer(id)
  }
}
