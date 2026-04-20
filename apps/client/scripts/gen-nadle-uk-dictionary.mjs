#!/usr/bin/env node
/**
 * 1) Hunspell uk_UA.dic (brown-uk/dict_uk, MPL-1.1) → усі прийнятні здогади.
 * 2) Частотний список OpenSubtitles (uk_opensubtitles_50k.txt, див. dictionary/SOURCES.md)
 *    → порядок відбору ~1000 «звичайніших» секретів (перетин із Hunspell).
 *
 * Регенерація: npm run gen:nadle-dict
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientRoot = path.resolve(__dirname, '..')
const rawDir = path.join(clientRoot, 'src/nadle/dictionary/raw')
const dicPath = path.join(rawDir, 'uk_UA.dic')
const freqPath = path.join(rawDir, 'uk_opensubtitles_50k.txt')
const wordsUkPath = path.join(clientRoot, 'src/nadle/words-uk.ts')
const outPath = path.join(clientRoot, 'src/nadle/words-uk-dictionary.generated.ts')

const ZIP_URL =
  'https://github.com/brown-uk/dict_uk/releases/download/v6.7.5/hunspell-uk_UA_6.7.5.zip'

const UK_LETTERS = /^[абвгґдеєжзиіїйклмнопрстуфхцчшщьюя]+$/u
const UK_VOWELS = new Set([...'аеєиіїоуюя'])
/** ~1000 секретів загалом: 333 + 333 + 334 */
const SECRET_CAP_BY_LEN = { 5: 333, 6: 333, 7: 334 }
const RNG_SEED = 0xbeefcafe

function normalizeWord(word) {
  return word.trim().toLocaleLowerCase('uk-UA').normalize('NFC')
}

function lemmaStartsWithUppercase(raw) {
  const t = raw.trim()
  if (!t) {
    return false
  }
  return /\p{Lu}/u.test(t[0])
}

function vowelCount(word) {
  return [...word].filter((ch) => UK_VOWELS.has(ch)).length
}

function maxConsonantRun(word) {
  let max = 0
  let run = 0
  for (const ch of word) {
    if (UK_VOWELS.has(ch)) {
      run = 0
    } else {
      run += 1
      if (run > max) {
        max = run
      }
    }
  }
  return max
}

function badSecretEnding(word, L) {
  if (word.endsWith('ія') || word.endsWith('іє')) {
    return true
  }
  if (L >= 6 && (word.endsWith('ція') || word.endsWith('зія') || word.endsWith('фія'))) {
    return true
  }
  if (L === 5 && (word.endsWith('ити') || word.endsWith('яти') || word.endsWith('іти'))) {
    return true
  }
  if (L === 5 && (word.endsWith('ого') || word.endsWith('ит'))) {
    return true
  }
  if (L === 5 && word.endsWith('мені')) {
    return true
  }
  if (word.includes('ись')) {
    return true
  }
  if (L === 5 && word.endsWith('ти')) {
    return true
  }
  if (L === 5 && word.endsWith('огло')) {
    return true
  }
  if (word.endsWith('ою') || word.endsWith('єю')) {
    return true
  }
  if (L === 5 && word.endsWith('у')) {
    return true
  }
  if (
    word === 'немає' ||
    word === 'нічого' ||
    word === 'нікого' ||
    word === 'ніяк' ||
    word === 'ніхто' ||
    word === 'ніде' ||
    word === 'абищо' ||
    word === 'абощо' ||
    word === 'абияк' ||
    word === 'абиде' ||
    word === 'аніщо' ||
    word === 'ніякий'
  ) {
    return true
  }
  return false
}

function onlyVowelLetterIsU(word) {
  const vowels = [...word].filter((ch) => UK_VOWELS.has(ch))
  if (vowels.length === 0) {
    return true
  }
  return vowels.every((ch) => ch === 'у')
}

function hasVowelTripletInFive(word, L) {
  if (L !== 5) {
    return false
  }
  const counts = new Map()
  for (const ch of word) {
    if (!UK_VOWELS.has(ch)) {
      continue
    }
    counts.set(ch, (counts.get(ch) ?? 0) + 1)
    if ((counts.get(ch) ?? 0) >= 3) {
      return true
    }
  }
  return false
}

/** Легкий фільтр для слів, відібраних з частотного списку + Hunspell. */
function isOkSecretFromFrequency(word, L) {
  if (badSecretEnding(word, L)) {
    return false
  }
  if (onlyVowelLetterIsU(word) || hasVowelTripletInFive(word, L)) {
    return false
  }
  return true
}

/** Добір з евристик Hunspell, якщо частотного перетину не вистачає. */
function isFriendlySecretLemma(word, L) {
  if (!isOkSecretFromFrequency(word, L)) {
    return false
  }
  const v = vowelCount(word)
  const r = maxConsonantRun(word)
  if (L === 5) {
    return v >= 2 && v <= 4 && r <= 3
  }
  if (L === 6) {
    return v >= 3 && r <= 3
  }
  return v >= 3 && r <= 4
}

function ensureDic() {
  if (fs.existsSync(dicPath)) {
    return
  }
  fs.mkdirSync(rawDir, { recursive: true })
  const zipPath = path.join(rawDir, 'hunspell-download-temp.zip')
  console.log('uk_UA.dic not found; downloading', ZIP_URL)
  try {
    execSync(`curl -fsSL -L "${ZIP_URL}" -o "${zipPath}"`, { stdio: 'inherit' })
    execSync(`unzip -o -j "${zipPath}" uk_UA.dic -d "${rawDir}"`, { stdio: 'inherit' })
  } finally {
    try {
      fs.unlinkSync(zipPath)
    } catch {
      /* ignore */
    }
  }
  if (!fs.existsSync(dicPath)) {
    throw new Error(`Expected ${dicPath} after unzip`)
  }
}

function ensureFreq() {
  if (fs.existsSync(freqPath)) {
    return
  }
  throw new Error(
    `Missing ${freqPath}. Add uk_opensubtitles_50k.txt (see src/nadle/dictionary/SOURCES.md) or download HermitDave FrequencyWords content/2016/uk/uk_50k.txt`,
  )
}

function parseDic(content, targetLen) {
  const lines = content.split(/\r?\n/)
  const allowed = new Set()
  const secretEligible = new Set()
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.startsWith('+')) {
      continue
    }
    const raw = line.split('/')[0].split('#')[0].trim()
    if (!raw || raw.includes('-') || raw.includes("'")) {
      continue
    }
    const low = normalizeWord(raw)
    if ([...low].length !== targetLen) {
      continue
    }
    if (!UK_LETTERS.test(low)) {
      continue
    }
    allowed.add(low)
    if (!lemmaStartsWithUppercase(raw)) {
      secretEligible.add(low)
    }
  }
  return { allowed, secretEligible }
}

/**
 * Упорядкований список слів за частотою (перше входження = вища частота).
 * Формат рядка: `<слово> <лічильник>`.
 */
function loadFrequencyWordsOrdered() {
  const txt = fs.readFileSync(freqPath, 'utf8')
  const seen = new Set()
  const ordered = []
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) {
      continue
    }
    const m = t.match(/^(\S+)\s+(\d+)\s*$/)
    if (!m) {
      continue
    }
    const low = normalizeWord(m[1])
    if (!low || !UK_LETTERS.test(low)) {
      continue
    }
    if (seen.has(low)) {
      continue
    }
    seen.add(low)
    ordered.push(low)
  }
  return ordered
}

function parseConstStringArray(name) {
  const txt = fs.readFileSync(wordsUkPath, 'utf8')
  const re = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\]\\s+as const`)
  const m = txt.match(re)
  if (!m) {
    return []
  }
  const out = []
  for (const q of m[1].matchAll(/'([^']*)'/g)) {
    out.push(normalizeWord(q[1]))
  }
  return out
}

function loadSeedsByLength() {
  const five = parseConstStringArray('WORDS_UK').filter((w) => [...w].length === 5)
  const six = parseConstStringArray('WORDS_UK_6').filter((w) => [...w].length === 6)
  const seven = parseConstStringArray('WORDS_UK_7').filter((w) => [...w].length === 7)
  return { 5: five, 6: six, 7: seven }
}

const LENGTHS = [5, 6, 7]

function buildForLength(content, L, seedsForL, freqOrdered, cap) {
  const { allowed: allowedSet, secretEligible } = parseDic(content, L)
  const allowed = [...allowedSet].sort((a, b) => a.localeCompare(b, 'uk-UA'))
  const rng = mulberry32(RNG_SEED + L * 9973)

  const secret = []
  const used = new Set()

  for (const s of seedsForL) {
    if (!allowedSet.has(s) || !secretEligible.has(s)) {
      continue
    }
    if (used.has(s)) {
      continue
    }
    secret.push(s)
    used.add(s)
    if (secret.length >= cap) {
      break
    }
  }

  for (const w of freqOrdered) {
    if (secret.length >= cap) {
      break
    }
    if ([...w].length !== L) {
      continue
    }
    if (!allowedSet.has(w) || !secretEligible.has(w)) {
      continue
    }
    if (!isOkSecretFromFrequency(w, L)) {
      continue
    }
    if (used.has(w)) {
      continue
    }
    secret.push(w)
    used.add(w)
  }

  if (secret.length < cap) {
    const eligibleArr = [...secretEligible].sort((a, b) => a.localeCompare(b, 'uk-UA'))
    const friendly = eligibleArr.filter((w) => isFriendlySecretLemma(w, L) && !used.has(w))
    const shuffled = shuffle(friendly, rng)
    for (const w of shuffled) {
      if (secret.length >= cap) {
        break
      }
      secret.push(w)
      used.add(w)
    }
  }

  if (allowed.length === 0) {
    throw new Error(`No ${L}-letter lemmas in dictionary`)
  }
  if (secret.length === 0) {
    throw new Error(`Empty secret pool for length ${L}`)
  }
  const needAtLeast = Math.min(200, cap)
  if (secret.length < needAtLeast) {
    throw new Error(`${L}L secret pool too small: ${secret.length} (expected at least ${needAtLeast})`)
  }
  return { allowed, secret }
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function esc(s) {
  return JSON.stringify(s)
}

function main() {
  ensureDic()
  ensureFreq()
  const content = fs.readFileSync(dicPath, 'utf8')
  const freqOrdered = loadFrequencyWordsOrdered()
  console.log('Frequency list unique words:', freqOrdered.length)

  const seedsByLen = loadSeedsByLength()
  const parsed5 = parseDic(content, 5)
  for (const s of seedsByLen[5]) {
    if (!parsed5.allowed.has(s)) {
      console.warn('Seed not in Hunspell 5-letter set (skipped):', s)
    } else if (!parsed5.secretEligible.has(s)) {
      console.warn('Seed looks like proper noun in .dic (skipped from secret pool):', s)
    }
  }

  const header = `/**
 * AUTO-GENERATED by scripts/gen-nadle-uk-dictionary.mjs
 *
 * - WORDS_UK_*_ALLOWED: усі леми з Hunspell uk_UA.dic (brown-uk/dict_uk, MPL-1.1) — прийнятні здогади.
 * - WORDS_UK_*_SECRET_POOL: ~1000 слів (333+333+334) — перетин частотного списку OpenSubtitles
 *   із Hunspell + насіння з words-uk.ts; див. src/nadle/dictionary/SOURCES.md
 *
 * Regenerate: \`npm run gen:nadle-dict\`
 */

`

  const chunks = []
  let totalSecret = 0
  for (const L of LENGTHS) {
    const cap = SECRET_CAP_BY_LEN[L]
    const { allowed, secret } = buildForLength(content, L, seedsByLen[L], freqOrdered, cap)
    totalSecret += secret.length
    chunks.push(
      `export const WORDS_UK_${L}_ALLOWED: readonly string[] = [\n${allowed.map((w) => `  ${esc(w)},`).join('\n')}\n]\n\n` +
        `export const WORDS_UK_${L}_SECRET_POOL: readonly string[] = [\n${secret.map((w) => `  ${esc(w)},`).join('\n')}\n]\n\n`,
    )
    console.log(`length ${L}: allowed ${allowed.length}, secret ${secret.length} (cap ${cap})`)
  }
  console.log('secret total:', totalSecret)

  fs.writeFileSync(outPath, header + chunks.join(''), 'utf8')
  console.log('Wrote', path.relative(clientRoot, outPath))
}

main()
