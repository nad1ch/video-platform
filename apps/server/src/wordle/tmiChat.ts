import tmi from 'tmi.js'
import { getCurrentGameId, getCurrentWordLength, submitGuess } from './gameStore'
import { broadcastTwitchChatLine, broadcastUserGuess } from './wordleSocket'
import { isValidGuessShape, normalizeWord } from './wordleLogic'
import { readTwitchChatGuessCooldownMs, tryConsumeTwitchGuessThrottle } from './tmiGuessThrottle'

let client: tmi.Client | null = null

/** Channel the server IRC client is (or will be) joined to; null if ingest is off. */
let wordleIngestChannel: string | null = null

export function getWordleIngestChannel(): string | null {
  return wordleIngestChannel
}

function displayNameFromTags(tags: tmi.ChatUserstate): string {
  const raw = tags['display-name']
  if (typeof raw === 'string' && raw.length > 0) {
    return raw
  }
  return tags.username ?? 'unknown'
}

/** Dev-only fallback so local `npm run dev` can demo IRC without .env. Production must set TWITCH_CHANNEL. */
const DEFAULT_DEV_TWITCH_CHANNEL = 'nad1ch'

export function startTwitchChatIngest(): void {
  wordleIngestChannel = null
  const fromEnv = process.env.TWITCH_CHANNEL?.replace(/^#/, '').trim()
  let channel: string
  if (fromEnv && fromEnv.length > 0) {
    channel = fromEnv
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('[wordle] TWITCH_CHANNEL not set — Twitch chat ingest disabled (set TWITCH_CHANNEL on the server)')
    return
  } else {
    channel = DEFAULT_DEV_TWITCH_CHANNEL
    console.info(`[wordle] TWITCH_CHANNEL unset — dev demo ingest on "${channel}"`)
  }

  wordleIngestChannel = channel

  const oauth = process.env.TWITCH_IRC_OAUTH?.trim()
  const username = process.env.TWITCH_IRC_USERNAME?.trim()

  const options: tmi.Options = {
    channels: [channel],
    connection: { reconnect: true, secure: true },
  }

  if (oauth && username) {
    options.identity = { username, password: oauth.startsWith('oauth:') ? oauth : `oauth:${oauth}` }
  } else {
    const anon = `justinfan${Math.floor(Math.random() * 1e6)}`
    options.identity = { username: anon, password: 'SCHMOOPIIE' }
    console.info('[wordle] Using read-only IRC (justinfan); set TWITCH_IRC_USERNAME + TWITCH_IRC_OAUTH for named bot')
  }

  const c = new tmi.Client(options)
  client = c

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
    const wordLen = getCurrentWordLength()
    const normalized = normalizeWord(text)
    const looksLikeGuess = isValidGuessShape(normalized, wordLen)

    if (!looksLikeGuess) {
      broadcastTwitchChatLine({
        userId,
        displayName,
        text,
        validGuess: false,
      })
      return
    }

    if (!tryConsumeTwitchGuessThrottle(userId)) {
      broadcastTwitchChatLine({
        userId,
        displayName,
        text,
        validGuess: false,
        rateLimited: true,
        cooldownMs: readTwitchChatGuessCooldownMs(),
      })
      return
    }

    const result = submitGuess(userId, displayName, text, getCurrentGameId())
    if (!result.ok) {
      broadcastTwitchChatLine({
        userId,
        displayName,
        text,
        validGuess: false,
      })
      return
    }

    broadcastTwitchChatLine({
      userId,
      displayName,
      text,
      validGuess: true,
      guessFeedback: result.feedback,
    })

    broadcastUserGuess({
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
  })

  c.on('connected', (addr, port) => {
    console.info('[wordle] tmi connected', addr, port)
  })

  c.on('disconnected', (reason) => {
    console.warn('[wordle] tmi disconnected', reason)
  })

  void c.connect().catch((err) => {
    console.error('[wordle] tmi connect failed', err)
  })
}

export function stopTwitchChatIngest(): void {
  wordleIngestChannel = null
  if (client) {
    void client.disconnect()
    client = null
  }
}
