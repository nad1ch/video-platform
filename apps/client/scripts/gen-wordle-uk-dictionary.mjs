#!/usr/bin/env node
/**
 * Parses brown-uk Hunspell uk_UA.dic (or fetches release zip if missing),
 * builds allowed lemmas + secret pools for Wordle lengths 5, 6, 7.
 *
 * Source: https://github.com/brown-uk/dict_uk (MPL-1.1)
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientRoot = path.resolve(__dirname, '..')
const rawDir = path.join(clientRoot, 'src/wordle/dictionary/raw')
const dicPath = path.join(rawDir, 'uk_UA.dic')
const wordsUkPath = path.join(clientRoot, 'src/wordle/words-uk.ts')
const outPath = path.join(clientRoot, 'src/wordle/words-uk-dictionary.generated.ts')

const ZIP_URL =
  'https://github.com/brown-uk/dict_uk/releases/download/v6.7.5/hunspell-uk_UA_6.7.5.zip'

const UK_LETTERS = /^[абвгґдеєжзиіїйклмнопрстуфхцчшщьюя]+$/u
/** Голосні для евристик відбору «звичайніших» лем у пул секретів (й — приголосний). */
const UK_VOWELS = new Set([...'аеєиіїоуюя'])
const SECRET_TARGET = 800
const RNG_SEED = 0xbeefcafe

function normalizeWord(word) {
  return word.trim().toLocaleLowerCase('uk-UA').normalize('NFC')
}

/** У Hunspell dict_uk власні назви зазвичай з великої літери; загадане слово беремо лише з «звичайних» лем. */
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

/** Надто довгі приголосні низки частіше дають рідкі/технічні форми. */
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

/** Відсікає частину латинізмів / дієслівних закінчень у коротких лемах. */
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
  return false
}

/**
 * Додаткова фільтрація лише для пулу секретів (здогади лишаються з повного Hunspell).
 * Насіння з words-uk.ts можуть не проходити — їх додаємо окремо.
 */
function isFriendlySecretLemma(word, L) {
  if (badSecretEnding(word, L)) {
    return false
  }
  const v = vowelCount(word)
  const r = maxConsonantRun(word)
  if (L === 5) {
    return v >= 3 && r <= 3
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

function buildForLength(content, L, seedsForL) {
  const { allowed: allowedSet, secretEligible } = parseDic(content, L)
  const allowed = [...allowedSet].sort((a, b) => a.localeCompare(b, 'uk-UA'))
  const eligibleArr = [...secretEligible].sort((a, b) => a.localeCompare(b, 'uk-UA'))
  const rng = mulberry32(RNG_SEED + L * 9973)

  const seedsInSecret = seedsForL.filter((w) => secretEligible.has(w))
  const seedSet = new Set(seedsInSecret)

  const friendly = eligibleArr.filter((w) => isFriendlySecretLemma(w, L))
  const friendlySet = new Set(friendly)
  const seedsNotFriendly = seedsInSecret.filter((w) => !friendlySet.has(w))
  const seedsFriendly = seedsInSecret.filter((w) => friendlySet.has(w))

  const pool = friendly.filter((w) => !seedSet.has(w))
  const shuffled = shuffle(pool, rng)

  const maxPossible = seedsInSecret.length + pool.length
  const cap = Math.min(SECRET_TARGET, maxPossible)
  const secret = [...seedsNotFriendly, ...seedsFriendly, ...shuffled].slice(0, cap)

  if (allowed.length === 0) {
    throw new Error(`No ${L}-letter lemmas in dictionary`)
  }
  if (secret.length === 0) {
    throw new Error(`Empty secret pool for length ${L}`)
  }
  const needAtLeast = Math.min(400, maxPossible)
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
  const content = fs.readFileSync(dicPath, 'utf8')
  const seedsByLen = loadSeedsByLength()
  const parsed5 = parseDic(content, 5)
  for (const s of seedsByLen[5]) {
    if (!parsed5.allowed.has(s)) {
      console.warn('Seed not in Hunspell 5-letter set (skipped):', s)
    } else if (!parsed5.secretEligible.has(s)) {
      console.warn('Seed looks like proper noun in .dic (skipped from secret pool):', s)
    }
  }

  const header = `/* eslint-disable max-lines -- generated */
/**
 * AUTO-GENERATED by scripts/gen-wordle-uk-dictionary.mjs from Hunspell uk_UA.dic
 * (brown-uk/dict_uk, MPL-1.1). Do not edit.
 *
 * Regenerate: \`npm run gen:wordle-dict\` (needs uk_UA.dic or curl+unzip).
 */

`

  const chunks = []
  for (const L of LENGTHS) {
    const { allowed, secret } = buildForLength(content, L, seedsByLen[L])
    chunks.push(
      `export const WORDS_UK_${L}_ALLOWED: readonly string[] = [\n${allowed.map((w) => `  ${esc(w)},`).join('\n')}\n]\n\n` +
        `export const WORDS_UK_${L}_SECRET_POOL: readonly string[] = [\n${secret.map((w) => `  ${esc(w)},`).join('\n')}\n]\n\n`,
    )
    console.log(`length ${L}: allowed ${allowed.length}, secret ${secret.length}`)
  }

  fs.writeFileSync(outPath, header + chunks.join(''), 'utf8')
  console.log('Wrote', path.relative(clientRoot, outPath))
}

main()
