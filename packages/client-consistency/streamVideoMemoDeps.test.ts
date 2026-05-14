import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Regression guard: `streamVideoMemoDeps` controls the `v-memo` binding on
 * the video subtree. Removing or shrinking these deps would cause stale
 * video frames or missed re-renders on label / mic / life-state change.
 * Keep both the computed and the template binding intact.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const participantTilePath = path.resolve(
  here,
  '../../apps/client/src/components/call/ParticipantTile.vue',
)
const source = readFileSync(participantTilePath, 'utf8')

describe('ParticipantTile.vue streamVideoMemoDeps regression guard', () => {
  it('streamVideoMemoDeps is defined as a computed array', () => {
    expect(source).toMatch(/const streamVideoMemoDeps = computed\(\(\) => \[/)
  })

  it('template still binds v-memo="streamVideoMemoDeps"', () => {
    expect(source).toMatch(/v-memo="streamVideoMemoDeps"/)
  })

  it('memo deps include the core video subtree inputs', () => {
    const match = source.match(
      /const streamVideoMemoDeps = computed\(\(\) => \[([\s\S]*?)\]\)/,
    )
    expect(match, 'streamVideoMemoDeps computed block not found').not.toBeNull()
    const body = match![1]
    expect(body).toMatch(/props\.stream\b/)
    expect(body).toMatch(/props\.playRev/)
    expect(body).toMatch(/showVideo\.value/)
    expect(body).toMatch(/hasLiveVideoTrack\.value/)
    expect(body).toMatch(/props\.isLocal\b/)
    expect(body).toMatch(/props\.videoPresentation/)
    expect(body).toMatch(/props\.mafiaLifeState/)
  })
})
