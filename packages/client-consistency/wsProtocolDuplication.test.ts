import { describe, expect, it } from 'vitest'

/**
 * Per-side WS protocol constants are intentionally duplicated between
 * `apps/server/src/<domain>/wsProtocol.ts` and the matching client mirror,
 * because there is no shared package across the server↔client boundary
 * for signaling strings (see Mafia/Nadle/Nadraw client mirror comments).
 *
 * This test guards the duplication: if anyone changes one side without
 * updating the other, the per-domain string maps will stop matching and
 * this suite fails. It is the lightest-weight alternative to introducing
 * a new shared workspace package.
 *
 * Checkers is intentionally omitted from this suite because the client
 * mirror file (`apps/client/src/features/checkers/ws/checkersWs.ts`)
 * imports `vue` and `apiUrl` runtime — it is not a pure-constant module.
 * Add it later if the client side gets a constants-only split.
 */

import { MafiaWs as MafiaWsServer } from '../../apps/server/src/signaling/mafiaWsProtocol'
import { MafiaWs as MafiaWsClient } from '../../apps/client/src/composables/mafiaWsProtocol'
import { NadleWs as NadleWsServer } from '../../apps/server/src/nadle/wsProtocol'
import { NadleWs as NadleWsClient } from '../../apps/client/src/nadle/ws/nadleWsTypes'
import { NadrawWs as NadrawWsServer } from '../../apps/server/src/nadraw-show/wsProtocol'
import { NadrawWs as NadrawWsClient } from '../../apps/client/src/features/nadraw-show/core/nadrawWsProtocol'

describe('cross-boundary WS protocol mirrors', () => {
  it('Mafia client const equals server const', () => {
    expect(MafiaWsClient).toEqual(MafiaWsServer)
  })

  it('Nadle client const equals server const', () => {
    expect(NadleWsClient).toEqual(NadleWsServer)
  })

  it('Nadraw client const equals server const', () => {
    expect(NadrawWsClient).toEqual(NadrawWsServer)
  })
})
