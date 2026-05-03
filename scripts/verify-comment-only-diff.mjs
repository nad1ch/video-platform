/**
 * Verify working tree vs HEAD: for each changed source file, stripping ALL comments
 * from both sides must yield identical text (only comment/whitespace-from-comments changed).
 *
 * Excludes known intentional non-comment edits.
 */
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const ROOT = path.join(fileURLToPath(new URL('.', import.meta.url)), '..')
const ts = require(require.resolve('typescript', { paths: [path.join(ROOT, 'apps', 'client')] }))

const EXCLUDE_EXACT = new Set([
  path.join(ROOT, 'eslint.config.mjs'),
  path.join(ROOT, 'package.json'),
  path.join(ROOT, '.cursor', 'rules', 'code-comments-policy.mdc'),
  path.join(ROOT, 'scripts', 'prune-low-signal-comments.mjs'),
  path.join(ROOT, 'scripts', 'verify-comment-only-diff.mjs'),
])

/** EatFirstPage: non-comment type fix + JSDoc text change */
const EXCLUDE_IF_MISMATCH = new Set([path.join(ROOT, 'apps', 'client', 'src', 'pages', 'EatFirstPage.vue')])

function stripAllTsLike(text, fileName) {
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
  const ranges = []

  function pushRange(start, end) {
    if (!(start < end)) return
    const key = `${start}:${end}`
    if (seen.has(key)) return
    seen.add(key)
    ranges.push({ start, end })
  }

  function scanCommentsAt(pos) {
    ts.forEachLeadingCommentRange(full, pos, (start, end) => pushRange(start, end))
    ts.forEachTrailingCommentRange(full, pos, (start, end) => pushRange(start, end))
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
    const raw = full.slice(start, end)
    const nl = raw.match(/\n/g)
    const repl = nl && nl.length ? '\n'.repeat(nl.length) : ''
    out = out.slice(0, start) + repl + out.slice(end)
  }
  return out
}

function stripHtmlCommentsAll(html) {
  return html.replace(/<!--([\s\S]*?)-->/g, (m, inner) => {
    const nl = String(inner).match(/\n/g)
    return nl && nl.length ? '\n'.repeat(nl.length) : ''
  })
}

function stripCssCommentsAll(css) {
  return css.replace(/\/\*([\s\S]*?)\*\//g, (m, inner) => {
    const nl = String(inner).match(/\n/g)
    return nl && nl.length ? '\n'.repeat(nl.length) : ''
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

async function stripVueAll(source, filePath) {
  const parse = await ensureVueParse()
  const { descriptor, errors } = parse(source, { filename: filePath })
  if (errors?.length) throw new Error(String(errors[0]))

  const blocks = []
  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (!block?.loc?.start?.offset || block.loc.end?.offset == null) continue
    if (String(block.lang || '').toLowerCase() === 'json') continue
    blocks.push({ start: block.loc.start.offset, end: block.loc.end.offset, type: 'ts' })
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
        ? stripCssCommentsAll(chunk)
        : b.type === 'html'
          ? stripHtmlCommentsAll(chunk)
          : stripAllTsLike(chunk, filePath)
    out = out.slice(0, b.start) + next + out.slice(b.end)
  }
  return out
}

function normalizeEol(s) {
  return String(s ?? '').replaceAll('\r\n', '\n')
}

function gitShowHead(relPath) {
  try {
    return normalizeEol(execFileSync('git', ['-C', ROOT, 'show', `HEAD:${relPath}`], { encoding: 'utf8' }))
  } catch {
    return null
  }
}

function listChangedFiles() {
  const out = execFileSync('git', ['-C', ROOT, 'diff', '--name-only', 'HEAD'], { encoding: 'utf8' })
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function isSource(rel) {
  return (
    rel.endsWith('.ts') ||
    rel.endsWith('.tsx') ||
    rel.endsWith('.mts') ||
    rel.endsWith('.cts') ||
    rel.endsWith('.js') ||
    rel.endsWith('.cjs') ||
    rel.endsWith('.mjs') ||
    rel.endsWith('.vue')
  )
}

async function main() {
  const changed = listChangedFiles()
  const mismatches = []
  const skipped = []

  for (const rel of changed) {
    if (!rel.startsWith('apps/') && !rel.startsWith('packages/') && !rel.startsWith('scripts/')) {
      if (rel === 'eslint.config.mjs' || rel === 'package.json' || rel.startsWith('.cursor/')) {
        skipped.push({ rel, reason: 'intentional non-comment or config' })
      }
      continue
    }
    if (!isSource(rel)) {
      skipped.push({ rel, reason: 'not ts/js/vue' })
      continue
    }

    const abs = path.join(ROOT, rel)
    if (EXCLUDE_EXACT.has(abs)) {
      skipped.push({ rel, reason: 'excluded exact' })
      continue
    }

    const oldText = gitShowHead(rel)
    if (oldText == null) {
      skipped.push({ rel, reason: 'no HEAD version (new file)' })
      continue
    }

    const newText = normalizeEol(fs.readFileSync(abs, 'utf8'))

    let oldNorm
    let newNorm
    try {
      if (rel.endsWith('.vue')) {
        oldNorm = await stripVueAll(oldText, abs)
        newNorm = await stripVueAll(newText, abs)
      } else {
        oldNorm = stripAllTsLike(oldText, abs)
        newNorm = stripAllTsLike(newText, abs)
      }
    } catch (e) {
      mismatches.push({ rel, reason: `strip failed: ${e?.message || e}` })
      continue
    }

    if (oldNorm !== newNorm) {
      if (EXCLUDE_IF_MISMATCH.has(abs)) {
        skipped.push({ rel, reason: 'allowed mismatch (EatFirstPage non-comment fix)' })
        continue
      }
      const oLen = oldNorm.length
      const nLen = newNorm.length
      let i = 0
      while (i < oLen && i < nLen && oldNorm[i] === newNorm[i]) i++
      mismatches.push({
        rel,
        reason: 'normalized source differs (non-comment change suspected)',
        firstDiffIndex: i,
        oldSnippet: oldNorm.slice(Math.max(0, i - 40), i + 60),
        newSnippet: newNorm.slice(Math.max(0, i - 40), i + 60),
      })
    }
  }

  console.log(JSON.stringify({ ok: mismatches.length === 0, mismatches, skipped: skipped.slice(0, 30), skippedTotal: skipped.length }, null, 2))
  process.exit(mismatches.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
