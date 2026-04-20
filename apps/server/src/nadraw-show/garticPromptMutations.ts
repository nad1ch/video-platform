import { prisma } from '../prisma'
import { normalizeGarticPromptKey } from './garticGuess'

function isDatabaseConfigured(): boolean {
  const u = process.env.DATABASE_URL
  return typeof u === 'string' && u.trim().length > 0
}

function sanitizePromptText(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, ' ')
  if (t.length < 1 || t.length > 80) {
    return null
  }
  return t
}

export async function saveGarticPromptFromChat(
  streamerId: string,
  createdByTwitchUserId: string,
  rawText: string,
): Promise<{ ok: true } | { ok: true; skippedDuplicate: true } | { ok: false; code: string }> {
  if (!isDatabaseConfigured()) {
    return { ok: false, code: 'no_database' }
  }
  const text = sanitizePromptText(rawText)
  if (!text) {
    return { ok: false, code: 'bad_text' }
  }
  const normalizedText = normalizeGarticPromptKey(text)
  if (!normalizedText) {
    return { ok: false, code: 'bad_text' }
  }
  try {
    const dup = await prisma.garticPrompt.findFirst({
      where: { streamerId, normalizedText },
      select: { id: true },
    })
    if (dup) {
      return { ok: true, skippedDuplicate: true }
    }
    await prisma.garticPrompt.create({
      data: {
        streamerId,
        text,
        normalizedText,
        source: 'chat',
        createdBy: createdByTwitchUserId,
        approved: false,
      },
    })
    return { ok: true }
  } catch (e) {
    console.error('[gartic-show] saveGarticPromptFromChat failed', e)
    return { ok: false, code: 'server_error' }
  }
}
