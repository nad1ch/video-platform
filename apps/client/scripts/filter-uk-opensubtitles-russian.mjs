#!/usr/bin/env node
/**
 * Прибирає з uk_opensubtitles_50k.txt російські токени (суржик із субтитрів).
 *
 * Критерії:
 * 1) Літери, яких немає в укр. правописі: ё ъ ы э
 * 2) Стоп-слова з російського ISO-списку (через stopword), яких немає в українському
 *    stopword, з винятками для спільних прийменників / частинок.
 * 3) Високочастотні російські леми з HermitDave ru_50k, яких немає в Hunspell uk_UA.dic
 *    (перші N рядків ru — типові рос. форми без укр. леми).
 * 4) Явний список русизмів, що трапляються в brown-uk Hunspell як запозичення.
 *
 * Запуск: node scripts/filter-uk-opensubtitles-russian.mjs
 */

import fs from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientRoot = path.resolve(__dirname, '..')
const rawDir = path.join(clientRoot, 'src/nadle/dictionary/raw')
const dicPath = path.join(rawDir, 'uk_UA.dic')
const freqPath = path.join(rawDir, 'uk_opensubtitles_50k.txt')

const UK_LETTERS = /^[абвгґдеєжзиіїйклмнопрстуфхцчшщьюя]+$/u
const RU_ORTHO = /[ёЁъЪыЫэЭ]/u
/** Якщо є типові укр. літери — не відкидаємо лише через ru_50k (спільні корені без і/ї/є/ґ). */
const UK_MARK = /[іїєґ]/u

const RU_FREQ_URL =
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ru/ru_50k.txt'
const RU_TOP_LINES = 9000

/** stopword: rus minus ukr, мінус форми, нормальні в українських субтитрах. */
const RUS_STOP_MINUS_UKR = [
  'и',
  'во',
  'что',
  'он',
  'с',
  'со',
  'как',
  'она',
  'его',
  'но',
  'ты',
  'к',
  'вы',
  'бы',
  'только',
  'ее',
  'мне',
  'было',
  'вот',
  'меня',
  'еще',
  'нет',
  'из',
  'ему',
  'теперь',
  'когда',
  'даже',
  'ну',
  'ли',
  'если',
  'уже',
  'или',
  'ни',
  'быть',
  'был',
  'него',
  'нибудь',
  'уж',
  'сказал',
  'ведь',
  'потом',
  'себя',
  'ничего',
  'ей',
  'может',
  'они',
  'где',
  'есть',
  'надо',
  'ней',
  'мы',
  'тебя',
  'их',
  'чем',
  'была',
  'чтоб',
  'будто',
  'чего',
  'раз',
  'тоже',
  'под',
  'будет',
  'тогда',
  'кто',
  'этот',
  'того',
  'потому',
  'этого',
  'какой',
  'совсем',
  'этом',
  'почти',
  'мой',
  'тем',
  'чтобы',
  'нее',
  'были',
  'куда',
  'всех',
  'никогда',
  'сегодня',
  'можно',
  'при',
  'об',
  'другой',
  'хоть',
  'после',
  'над',
  'больше',
  'тот',
  'через',
  'эти',
  'всего',
  'какая',
  'много',
  'разве',
  'эту',
  'этой',
  'перед',
  'иногда',
  'лучше',
  'чуть',
  'том',
  'нельзя',
  'такой',
  'им',
  'более',
  'всегда',
  'конечно',
  'всю',
  'между',
  'это',
  'лишь',
]

const STOP_OK_IN_UK_SUBS = new Set([
  'раз',
  'при',
  'об',
  'во',
  'через',
  'перед',
  'ну',
  'уж',
  'с',
  'том',
  'им',
])

/**
 * Русизми, що потрапляють у uk_UA.dic, але для частотника їх прибираємо
 * (ето/он/был тощо).
 */
const RUSISM_FORCE_DROP_LIST = [
    'он',
    'она',
    'они',
    'оно',
    'его',
    'ее',
    'её',
    'ему',
    'ею',
    'ней',
    'ним',
    'ними',
    'них',
    'него',
    'нему',
    'нем',
    'нём',
    'все',
    'всё',
    'это',
    'этот',
    'эта',
    'эти',
    'эту',
    'этой',
    'этом',
    'этому',
    'этим',
    'этих',
    'этого',
    'сейчас',
    'здесь',
    'ничего',
    'потому',
    'тогда',
    'тот',
    'уже',
    'ещё',
    'еще',
    'опять',
    'сегодня',
    'конечно',
    'теперь',
    'спасибо',
    'пожалуйста',
    'здравствуй',
    'здравствуйте',
    'мы',
    'вы',
    'ты',
    'тебя',
    'меня',
    'мне',
    'вас',
    'вам',
    'нас',
    'нам',
    'их',
    'нет',
    'был',
    'была',
    'были',
    'было',
    'быть',
    'есть',
    'будет',
    'будто',
    'нужно',
    'надо',
    'нужен',
    'нужна',
    'нужны',
    'должен',
    'должна',
    'должно',
    'должны',
    'сказал',
    'сказала',
    'сказали',
    'сказать',
    'знаешь',
    'хочешь',
    'можешь',
    'иди',
    'идём',
    'идем',
    'идти',
    'иду',
    'идёт',
    'идет',
    'смотри',
    'слушай',
    'сделал',
    'сделала',
    'сделали',
    'сделать',
    'пошёл',
    'пошла',
    'пошли',
    'пошло',
    'понял',
    'поняла',
    'поняли',
    'понять',
    'видел',
    'видела',
    'видели',
    'видеть',
    'думал',
    'думала',
    'думали',
    'думать',
    'хотел',
    'хотела',
    'хотели',
    'хотеть',
    'мог',
    'могла',
    'могли',
    'могут',
    'мочь',
    'умер',
    'умерла',
    'умерли',
    'умереть',
    'который',
    'которая',
    'которые',
    'которой',
    'котором',
    'которому',
    'которым',
    'которых',
    'какой',
    'какая',
    'какие',
    'каким',
    'какому',
    'зажигалка',
    'зажигалку',
    'картошка',
    'картошки',
    'картошку',
]

function normalizeWord(word) {
  return word.trim().toLocaleLowerCase('uk-UA').normalize('NFC')
}

function loadHunspellLemmaSet() {
  const content = fs.readFileSync(dicPath, 'utf8')
  const lines = content.split(/\r?\n/)
  const lemmas = new Set()
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
    if (!low || !UK_LETTERS.test(low)) {
      continue
    }
    lemmas.add(low)
  }
  return lemmas
}

function downloadRuFreq(tmpPath) {
  return new Promise((resolve, reject) => {
    const f = fs.createWriteStream(tmpPath)
    https
      .get(RU_FREQ_URL, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        res.pipe(f)
        f.on('finish', () => {
          f.close(resolve)
        })
      })
      .on('error', reject)
  })
}

function loadRuTopNotInHunspell(lemmas, tmpPath) {
  const drop = new Set()
  const lines = fs.readFileSync(tmpPath, 'utf8').split(/\r?\n/)
  for (let i = 0; i < RU_TOP_LINES && i < lines.length; i++) {
    const m = lines[i].trim().match(/^(\S+)\s+\d+\s*$/)
    if (!m) {
      continue
    }
    const w = normalizeWord(m[1])
    if (!w || !UK_LETTERS.test(w)) {
      continue
    }
    if (!lemmas.has(w)) {
      drop.add(w)
    }
  }
  return drop
}

function buildStopDropSet() {
  const s = new Set()
  for (const w of RUS_STOP_MINUS_UKR) {
    if (STOP_OK_IN_UK_SUBS.has(w)) {
      continue
    }
    s.add(normalizeWord(w))
  }
  return s
}

function main() {
  if (!fs.existsSync(dicPath)) {
    console.error('Missing', dicPath)
    process.exit(1)
  }
  if (!fs.existsSync(freqPath)) {
    console.error('Missing', freqPath)
    process.exit(1)
  }

  const lemmas = loadHunspellLemmaSet()
  const tmpRu = path.join(os.tmpdir(), `ru_50k_${process.pid}.txt`)

  console.log('Downloading', RU_FREQ_URL)
  downloadRuFreq(tmpRu)
    .then(() => {
    const ruDrop = loadRuTopNotInHunspell(lemmas, tmpRu)
    try {
      fs.unlinkSync(tmpRu)
    } catch {
      /* ignore */
    }

    const stopDrop = buildStopDropSet()
    const rusism = new Set(RUSISM_FORCE_DROP_LIST.map((w) => normalizeWord(w)))

    let kept = 0
    let dropped = 0
    const reasons = { ortho: 0, stop: 0, ruTop: 0, rusism: 0 }

    const txt = fs.readFileSync(freqPath, 'utf8')
    const out = []
    const seen = new Set()

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
        dropped += 1
        continue
      }
      if (seen.has(low)) {
        continue
      }
      seen.add(low)

      let drop = false
      if (RU_ORTHO.test(low)) {
        drop = true
        reasons.ortho += 1
      } else if (rusism.has(low)) {
        drop = true
        reasons.rusism += 1
      } else if (stopDrop.has(low)) {
        drop = true
        reasons.stop += 1
      } else if (ruDrop.has(low) && !UK_MARK.test(low)) {
        drop = true
        reasons.ruTop += 1
      }

      if (drop) {
        dropped += 1
        continue
      }
      out.push(`${low} ${m[2]}`)
      kept += 1
    }

    fs.writeFileSync(freqPath, `${out.join('\n')}\n`, 'utf8')
    console.log('Kept:', kept, 'Dropped:', dropped, 'reasons:', reasons)
    console.log('Wrote', freqPath)
    })
    .catch((err) => {
      console.error(err)
      try {
        fs.unlinkSync(tmpRu)
      } catch {
        /* ignore */
      }
      process.exit(1)
    })
}

main()
