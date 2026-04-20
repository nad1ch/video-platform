import { prisma } from '../prisma'
import { normalizeNadrawPromptKey } from './nadrawGuess'

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

export async function saveNadrawPromptFromChat(
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
  const normalizedText = normalizeNadrawPromptKey(text)
  if (!normalizedText) {
    return { ok: false, code: 'bad_text' }
  }
  try {
    const dup = await prisma.nadrawPrompt.findFirst({
      where: { streamerId, normalizedText },
      select: { id: true },
    })
    if (dup) {
      return { ok: true, skippedDuplicate: true }
    }
    await prisma.nadrawPrompt.create({
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
    console.error('[nadraw-show] saveNadrawPromptFromChat failed', e)
    return { ok: false, code: 'server_error' }
  }
}
