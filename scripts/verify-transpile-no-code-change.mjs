/**
 * Compare HEAD vs working tree: TypeScript transpile with removeComments must match
 * for each .ts / .mts / .cts / .js / .cjs / .mjs and for each Vue <script> block.
 */
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const ROOT = path.join(fileURLToPath(new URL('.', import.meta.url)), '..')
const ts = require(require.resolve('typescript', { paths: [path.join(ROOT, 'apps', 'client')] }))

const SKIP = new Set([
  'eslint.config.mjs',
  'package.json',
  '.cursor/rules/code-comments-policy.mdc',
  'scripts/prune-low-signal-comments.mjs',
  'scripts/verify-comment-only-diff.mjs',
  'scripts/verify-transpile-no-code-change.mjs',
  // Intentional non-comment: `as keyof typeof panelByView`
  'apps/client/src/pages/EatFirstPage.vue',
])

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
  return execFileSync('git', ['-C', ROOT, 'diff', '--name-only', 'HEAD'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function transpileStrip(text, fileName) {
  const isTs = /\.(ts|mts|cts)$/.test(fileName)
  return ts.transpileModule(text, {
    fileName,
    compilerOptions: {
      removeComments: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: fileName.endsWith('.tsx') ? ts.JsxEmit.React : undefined,
    },
  }).outputText
}

let vueParse = null
async function getVueParse() {
  if (vueParse) return vueParse
  const vueSfc = require.resolve('@vue/compiler-sfc', { paths: [path.join(ROOT, 'apps', 'client')] })
  vueParse = (await import(pathToFileURL(vueSfc).href)).parse
  return vueParse
}

async function vueScriptsTranspiled(source, rel) {
  const parse = await getVueParse()
  const { descriptor, errors } = parse(source, { filename: rel })
  if (errors?.length) throw new Error(String(errors[0]))
  const parts = []
  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (!block?.content) continue
    const lang = String(block.lang || 'js').toLowerCase()
    if (lang === 'json') continue
    const fn = lang.includes('ts') ? `${rel}.ts` : `${rel}.js`
    parts.push(transpileStrip(block.content, fn))
  }
  return parts.join('\n;\n')
}

async function main() {
  const mismatches = []
  const skipped = []
  for (const rel of listChangedFiles()) {
    if (SKIP.has(rel) || rel.startsWith('.claude/')) {
      skipped.push(rel)
      continue
    }
    const abs = path.join(ROOT, rel)
    const oldText = gitShowHead(rel)
    if (oldText == null) {
      skipped.push(`${rel} (new)`)
      continue
    }
    const newText = normalizeEol(fs.readFileSync(abs, 'utf8'))

    let a
    let b
    try {
      if (rel.endsWith('.vue')) {
        a = await vueScriptsTranspiled(oldText, rel)
        b = await vueScriptsTranspiled(newText, rel)
      } else if (/\.(ts|mts|cts|js|cjs|mjs)$/.test(rel)) {
        const fake = rel.endsWith('.cjs') ? 'x.cjs' : rel.endsWith('.mjs') ? 'x.mjs' : rel
        a = transpileStrip(oldText, fake)
        b = transpileStrip(newText, fake)
      } else {
        skipped.push(rel)
        continue
      }
    } catch (e) {
      mismatches.push({ rel, reason: String(e?.message || e) })
      continue
    }

    if (a !== b) {
      let i = 0
      const L = Math.min(a.length, b.length)
      while (i < L && a[i] === b[i]) i++
      mismatches.push({
        rel,
        reason: 'transpile(removeComments) differs — likely non-comment code change in script',
        index: i,
        a: a.slice(Math.max(0, i - 60), i + 80),
        b: b.slice(Math.max(0, i - 60), i + 80),
      })
    }
  }

  const eatFirst = mismatches.find((m) => m.rel?.includes('EatFirstPage'))
  console.log(
    JSON.stringify(
      {
        ok: mismatches.length === 0,
        checkedTranspile: listChangedFiles().length - skipped.length,
        skippedCount: skipped.length,
        mismatches,
        note: eatFirst
          ? 'EatFirstPage may differ due to intentional type assertion (non-comment).'
          : undefined,
      },
      null,
      2,
    ),
  )
  process.exit(mismatches.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
