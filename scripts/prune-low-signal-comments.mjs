/**
 * Prune low-signal comments across apps/* and packages/* source.
 * Keeps high-signal comments (directives, realtime/security hints, long explanations).
 *
 * Usage (repo root): node scripts/prune-low-signal-comments.mjs
 */
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const ROOT = path.join(fileURLToPath(new URL('.', import.meta.url)), '..')

const ts = require(require.resolve('typescript', { paths: [path.join(ROOT, 'apps', 'client')] }))

const SHOULD_KEEP = new RegExp(
  [
    '^///\\s*<',
    'eslint',
    '@ts-\\w',
    '@vite',
    '@preserve',
    '\\b(TODO|FIXME|HACK|XXX)\\b',
    '\\b(INVARIANT|Invariant|invariant)\\b',
    '\\b(Security|SECURITY|authority|exploit|spoof|CSRF|XSS)\\b',
    '\\b(P0|P1|P2)\\b',
    '\\b(race|re-?entr|idempotent|stale|dead-?socket)\\b',
    '\\b(teardown|lifecycle|dispose|cleanup)\\b',
    '\\b(WebRTC|mediasoup|producer|consumer|transport|simulcast|layer)\\b',
    '\\b(signaling|socket|join-room|room-state|resync|producer-sync)\\b',
    '\\b(serialize|seriali[sz]e|replaceTrack|screen\\s*share)\\b',
    '\\b(workaround|regression|Chrome|Chromium|Safari|Firefox|WebKit|iOS)\\b',
    '\\b(must not|do not|never call|never be|should not|IMPORTANT|WARNING)\\b',
    'https?://',
    '\\bcrbug\\b',
  ].join('|'),
  'i',
)

function shouldKeepCommentBody(body) {
  const t = String(body ?? '').trim()
  if (!t) return false
  if (t.startsWith('///')) return true
  if (SHOULD_KEEP.test(t)) return true
  if (t.length >= 200) return true
  return false
}

function replaceRangePreservingNewlines(source, start, end) {
  const raw = source.slice(start, end)
  const nl = raw.match(/\n/g)
  if (nl && nl.length) return '\n'.repeat(nl.length)
  return ''
}

/** @param {string} text @param {string} fileName */
function pruneTsLike(text, fileName) {
  const kind = fileName.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : fileName.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : fileName.endsWith('.js') || fileName.endsWith('.cjs') || fileName.endsWith('.mjs')
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS

  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind)
  const full = sf.getFullText()
  const seen = new Set()

  /** @type {Array<{start:number,end:number}>} */
  const ranges = []

  function pushRange(start, end) {
    if (!(start < end)) return
    const key = `${start}:${end}`
    if (seen.has(key)) return
    seen.add(key)
    ranges.push({ start, end })
  }

  function scanCommentsAt(pos) {
    ts.forEachLeadingCommentRange(full, pos, (start, end) => {
      pushRange(start, end)
    })
    ts.forEachTrailingCommentRange(full, pos, (start, end) => {
      pushRange(start, end)
    })
  }

  function visit(node) {
    scanCommentsAt(node.getFullStart())
    ts.forEachChild(node, visit)
  }

  visit(sf)
  scanCommentsAt(sf.endOfFileToken.end)

  ranges.sort((a, b) => b.start - a.start)

  let out = full
  for (const { start, end } of ranges) {
    const body = full.slice(start, end)
    let inner = body
    if (body.startsWith('//')) inner = body.slice(2)
    else if (body.startsWith('/*')) inner = body.replace(/^\/\*+\s?/, '').replace(/\s?\*+\/$/, '')
    if (shouldKeepCommentBody(inner)) continue
    out = out.slice(0, start) + replaceRangePreservingNewlines(full, start, end) + out.slice(end)
  }
  return out
}

function pruneHtmlComments(html) {
  return html.replace(/<!--([\s\S]*?)-->/g, (m, inner) => {
    if (shouldKeepCommentBody(inner)) return m
    const nl = String(inner).match(/\n/g)
    if (nl && nl.length) return '\n'.repeat(nl.length)
    return ''
  })
}

function pruneCssBlock(css) {
  return css.replace(/\/\*([\s\S]*?)\*\//g, (m, inner) => {
    if (shouldKeepCommentBody(inner)) return m
    const nl = String(inner).match(/\n/g)
    if (nl && nl.length) return '\n'.repeat(nl.length)
    return ''
  })
}

let vueParseFn = null
async function ensureVueParse() {
  if (vueParseFn) return vueParseFn
  const vueSfc = require.resolve('@vue/compiler-sfc', { paths: [path.join(ROOT, 'apps', 'client')] })
  const mod = await import(pathToFileURL(vueSfc).href)
  vueParseFn = mod.parse
  return vueParseFn
}

async function pruneVueAsync(source, filePath) {
  const parse = await ensureVueParse()
  const { descriptor, errors } = parse(source, { filename: filePath })
  if (errors?.length) return null

  /** @type {Array<{start:number,end:number,type:'ts'|'css'|'html'}>} */
  const blocks = []

  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (!block?.loc?.start?.offset || block.loc.end?.offset == null) continue
    const lang = String(block.lang || '').toLowerCase()
    if (lang === 'json') continue
    blocks.push({
      start: block.loc.start.offset,
      end: block.loc.end.offset,
      type: 'ts',
    })
  }

  for (const block of descriptor.styles ?? []) {
    if (block.loc?.start?.offset == null || block.loc.end?.offset == null) continue
    blocks.push({ start: block.loc.start.offset, end: block.loc.end.offset, type: 'css' })
  }

  if (descriptor.template?.loc?.start?.offset != null && descriptor.template.loc.end?.offset != null) {
    blocks.push({
      start: descriptor.template.loc.start.offset,
      end: descriptor.template.loc.end.offset,
      type: 'html',
    })
  }

  blocks.sort((a, b) => b.start - a.start)
  let out = source
  for (const b of blocks) {
    const chunk = out.slice(b.start, b.end)
    const next =
      b.type === 'css'
        ? pruneCssBlock(chunk)
        : b.type === 'html'
          ? pruneHtmlComments(chunk)
          : pruneTsLike(chunk, filePath)
    out = out.slice(0, b.start) + next + out.slice(b.end)
  }
  return out
}

function* walkFiles(dir) {
  const skip = new Set(['node_modules', 'dist', '.git', 'coverage', 'build', '.turbo'])
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const ent of entries) {
    if (skip.has(ent.name)) continue
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) yield* walkFiles(p)
    else yield p
  }
}

function isTargetFile(p) {
  if (p.endsWith('.d.ts')) return false
  const rel = path.relative(ROOT, p).replaceAll('\\', '/')
  if (!rel.startsWith('apps/') && !rel.startsWith('packages/')) return false
  if (rel.includes('/node_modules/')) return false
  if (rel.endsWith('.ts') || rel.endsWith('.tsx') || rel.endsWith('.mts') || rel.endsWith('.cts')) return true
  if (rel.endsWith('.js') || rel.endsWith('.cjs') || rel.endsWith('.mjs')) return true
  if (rel.endsWith('.vue')) return true
  return false
}

async function main() {
  const dirs = [path.join(ROOT, 'apps'), path.join(ROOT, 'packages')]
  let changed = 0
  let scanned = 0
  const failures = []

  for (const dir of dirs) {
    for (const file of walkFiles(dir)) {
      if (!isTargetFile(file)) continue
      scanned++
      const raw = fs.readFileSync(file, 'utf8')
      let next
      if (file.endsWith('.vue')) {
        next = await pruneVueAsync(raw, file)
        if (next == null) {
          failures.push(file)
          continue
        }
      } else {
        next = pruneTsLike(raw, file)
      }
      if (next !== raw) {
        fs.writeFileSync(file, next, 'utf8')
        changed++
      }
    }
  }

  console.log(JSON.stringify({ scanned, changed, failures: failures.slice(0, 20), failureCount: failures.length }, null, 2))
  if (failures.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
