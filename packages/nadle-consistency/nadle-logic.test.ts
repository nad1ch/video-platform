/**
 * Ground-truth tests: client vs server nadle helpers must agree.
 * Run: npm run test:nadle (from repo root)
 */
import { describe, expect, it } from 'vitest'
import { computeFeedback as coreComputeFeedback, wordGraphemeCount as coreWordGraphemeCount } from 'nadle-core'
import {
  computeFeedback as clientComputeFeedback,
  normalizeWord as clientNormalizeWord,
  wordGraphemeCount as clientWordGraphemeCount,
} from '../../apps/client/src/nadle/nadleLogic.ts'
import {
  computeFeedback as serverComputeFeedback,
  normalizeWord as serverNormalizeWord,
  wordGraphemeCount as serverWordGraphemeCount,
} from '../../apps/server/src/nadle/nadleLogic.ts'

type Fb = 'correct' | 'present' | 'absent'

/** Length, per-index correctness, and multiset caps (present+correct per letter ≤ count in secret). */
function assertFeedbackInvariants(secret: string, guess: string, fb: Fb[]): void {
  const s = [...secret]
  const g = [...guess]
  expect(fb).toHaveLength(s.length)
  expect(fb).toHaveLength(g.length)

  const secretCount = new Map<string, number>()
  for (const ch of s) {
    secretCount.set(ch, (secretCount.get(ch) ?? 0) + 1)
  }

  const correctByChar = new Map<string, number>()
  const presentByChar = new Map<string, number>()

  for (let i = 0; i < fb.length; i++) {
    expect(['correct', 'present', 'absent']).toContain(fb[i])
    if (fb[i] === 'correct') {
      expect(g[i]).toBe(s[i])
      const ch = g[i]!
      correctByChar.set(ch, (correctByChar.get(ch) ?? 0) + 1)
    } else if (fb[i] === 'present') {
      expect(g[i]).not.toBe(s[i])
      const ch = g[i]!
      presentByChar.set(ch, (presentByChar.get(ch) ?? 0) + 1)
    }
  }

  const chars = new Set<string>([...secretCount.keys(), ...correctByChar.keys(), ...presentByChar.keys()])
  for (const ch of chars) {
    const sc = secretCount.get(ch) ?? 0
    const c = correctByChar.get(ch) ?? 0
    const p = presentByChar.get(ch) ?? 0
    expect(c + p).toBeLessThanOrEqual(sc)
  }
}

function assertSameFeedback(secret: string, guess: string, label: string): void {
  const a = clientComputeFeedback(secret, guess) as Fb[]
  const b = serverComputeFeedback(secret, guess) as Fb[]
  expect(a, label).toEqual(b)
  assertFeedbackInvariants(secret, guess, a)
}

describe('normalizeWord (client vs server)', () => {
  const pairs: { input: string; note?: string }[] = [
    { input: '  КІТ  ' },
    { input: 'ҐРУНТ' },
    { input: 'їжак' },
    { input: '\u0439\u0306' }, // й + combining breve — NFC may differ from precomposed
    { input: '  слово  ' },
    { input: '' },
    { input: 'a\u0301b' }, // decomposed é-like pattern on Latin (edge)
    { input: '\uD83D\uDE00', note: 'surrogate pair emoji' },
    { input: 'e\u0301', note: 'e + combining acute' },
    { input: '\u0045\u0301\u0323', note: 'mixed combining marks' },
  ]

  it.each(pairs)('matches for %# $note', ({ input, note }) => {
    const c = clientNormalizeWord(input)
    const s = serverNormalizeWord(input)
    expect(c, note ?? input).toBe(s)
  })
})

describe('computeFeedback (client vs server)', () => {
  const cases: { secret: string; guess: string; note?: string }[] = [
    { secret: 'кіт', guess: 'кіт', note: 'all correct' },
    { secret: 'кіт', guess: 'тін', note: 'mixed' },
    { secret: 'кіт', guess: 'пив', note: 'all absent' },
    { secret: 'мама', guess: 'амам', note: 'duplicate letters' },
    { secret: 'мама', guess: 'aaaa', note: 'guess more of one letter than secret has' },
    { secret: 'aabbb', guess: 'bbbaa', note: 'length 5 duplicates' },
    { secret: 'ааа', guess: 'ааа', note: 'triple same' },
    { secret: 'абва', guess: 'вааб', note: 'permute' },
    { secret: 'рілля', guess: 'яллір', note: 'йотовані / довші слова' },
    { secret: 'слово', guess: 'олвос', note: '6 letters if same length — use 5' },
  ]

  for (const { secret, guess, note } of cases) {
    if ([...secret].length !== [...guess].length) {
      continue
    }
    it(`agrees: ${note ?? secret + ' / ' + guess}`, () => {
      assertSameFeedback(secret, guess, note ?? '')
    })
  }

  it('throws on length mismatch (client and server use nadle-core)', () => {
    expect(() => serverComputeFeedback('ab', 'a')).toThrow(/length mismatch/)
    expect(() => clientComputeFeedback('ab', 'abc')).toThrow(/length mismatch/)
  })

  it('agrees on surrogate-pair “words” (code-point length 2)', () => {
    const secret = '\uD83D\uDE00\uD83D\uDE00'
    const guess = '\uD83D\uDE00\uD83D\uDCA8'
    assertSameFeedback(secret, guess, 'emoji row')
  })
})

describe('computeFeedback (re-exported from nadle-core)', () => {
  it('client and server use the same implementation as nadle-core', () => {
    expect(clientComputeFeedback).toBe(coreComputeFeedback)
    expect(serverComputeFeedback).toBe(coreComputeFeedback)
  })
})

describe('computeFeedback (randomized smoke)', () => {
  const alphabet = [...'абвгдеєжзиіїйклмнопрстуфхцчшщьюяabcdefghijklmnopqrstuvwxyz']

  function randomWord(len: number): string {
    let s = ''
    for (let i = 0; i < len; i++) {
      s += alphabet[Math.floor(Math.random() * alphabet.length)]!
    }
    return s
  }

  it('client vs server agree on many random same-length pairs', () => {
    for (let t = 0; t < 400; t++) {
      const n = 1 + Math.floor(Math.random() * 12)
      const secret = randomWord(n)
      const guess = randomWord(n)
      assertSameFeedback(secret, guess, `trial ${t}`)
    }
  })

  it('identity: all cells are correct when guess equals secret', () => {
    for (let t = 0; t < 80; t++) {
      const n = 1 + Math.floor(Math.random() * 10)
      const w = randomWord(n)
      const fb = clientComputeFeedback(w, w) as Fb[]
      expect(fb.every((x) => x === 'correct')).toBe(true)
    }
  })

  it('correct slots match code points at that index', () => {
    for (let t = 0; t < 200; t++) {
      const n = 1 + Math.floor(Math.random() * 10)
      const secret = randomWord(n)
      const guess = randomWord(n)
      const fb = clientComputeFeedback(secret, guess) as Fb[]
      const g = [...guess]
      const s = [...secret]
      for (let i = 0; i < n; i++) {
        if (fb[i] === 'correct') {
          expect(g[i]).toBe(s[i])
        }
      }
    }
  })

  it('still throws on random length mismatch', () => {
    for (let t = 0; t < 40; t++) {
      const a = 1 + Math.floor(Math.random() * 8)
      const b = a + 1 + Math.floor(Math.random() * 4)
      const secret = randomWord(a)
      const guess = randomWord(b)
      expect(() => clientComputeFeedback(secret, guess)).toThrow(/length mismatch/)
      expect(() => serverComputeFeedback(secret, guess)).toThrow(/length mismatch/)
    }
  })
})

describe('wordGraphemeCount (client, server, package nadle-core)', () => {
  const samples = ['', 'a', 'кіт', '\uD83D\uDE00', 'a\uD83D\uDE00b', 'e\u0301']

  it.each(samples)('matches [...s].length for %#', (s) => {
    const ref = [...s].length
    expect(clientWordGraphemeCount(s)).toBe(ref)
    expect(serverWordGraphemeCount(s)).toBe(ref)
    expect(coreWordGraphemeCount(s)).toBe(ref)
  })
})
