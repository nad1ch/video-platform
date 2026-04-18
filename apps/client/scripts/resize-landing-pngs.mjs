import sharp from 'sharp'
import { readdir, rename } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(__dirname, '../src/assets/landing')

for (const f of await readdir(dir)) {
  if (!f.endsWith('.png')) continue
  const p = path.join(dir, f)
  const out = p + '.tmp'
  await sharp(p).resize(128, 128).png().toFile(out)
  await rename(out, p)
  console.log('resized', f)
}
