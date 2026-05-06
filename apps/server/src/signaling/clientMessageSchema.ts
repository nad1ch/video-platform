import { z } from 'zod'
import { MafiaWs } from './mafiaWsProtocol'

const mafiaRoleSchema = z.enum(['mafia', 'don', 'sheriff', 'doctor', 'civilian'])

/**
 * Per-item upper bound: a 5 MB raw image inflates to ~6.8 MB after base64
 * (the client uploads custom backgrounds as `data:image/...;base64,...` via
 * `FileReader.readAsDataURL`). Anything above this is not a legit upload.
 */
const mafiaBackgroundItemSchema = z.object({
  id: z.string().min(1).max(128),
  url: z.string().min(1).max(7_000_000),
  type: z.union([z.literal('preset'), z.literal('custom')]),
})
const mafiaPageBackgroundItemSchema = z.object({
  id: z.string().min(1).max(128),
  url: z.string().min(1).max(7_000_000),
  type: z.union([z.literal('default'), z.literal('preset'), z.literal('custom')]),
})

/**
 * Total URL bytes cap for a full backgrounds array across a `mafia:settings-update`
 * or `mafia:page-background-settings` payload. Prevents broadcast amplification
 * (20 items × 7 MB per-item cap = 140 MB per peer without this check). Realistic
 * multi-upload use case is a handful of 4-5 MB customs — 20 MB leaves slack.
 */
const MAFIA_BACKGROUNDS_TOTAL_URL_BYTES_MAX = 20 * 1024 * 1024

function totalUrlBytes<T extends { url?: unknown }>(items: readonly T[]): number {
  let total = 0
  for (const it of items) {
    if (typeof it.url === 'string') {
      total += it.url.length
    }
  }
  return total
}

function backgroundsArrayUnderTotalCap<T extends { url?: unknown }>(items: readonly T[]): boolean {
  return totalUrlBytes(items) <= MAFIA_BACKGROUNDS_TOTAL_URL_BYTES_MAX
}

const directionSchema = z.enum(['send', 'recv'])

const dtlsParametersSchema = z
  .object({
    fingerprints: z.array(
      z.object({
        algorithm: z.string(),
        value: z.string(),
      }),
    ),
  })
  .passthrough()

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join-room'),
    payload: z.object({
      roomId: z.string().min(1),
      peerId: z.string().min(1),
      userId: z.string().min(1).max(128).optional(),
      displayName: z.string().max(64).optional(),
      
      avatarUrl: z.string().max(2048).optional(),
    }),
  }),
  z.object({
    type: z.literal('update-display-name'),
    payload: z.object({
      displayName: z.string().min(1).max(64),
    }),
  }),
  z.object({
    type: z.literal('create-transport'),
    payload: z.object({
      direction: directionSchema,
    }),
  }),
  z.object({
    type: z.literal('connect-transport'),
    payload: z.object({
      transportId: z.string().min(1),
      dtlsParameters: dtlsParametersSchema,
    }),
  }),
  z.object({
    type: z.literal('produce'),
    payload: z.object({
      transportId: z.string().min(1),
      kind: z.enum(['audio', 'video']),
      rtpParameters: z.unknown(),
      requestId: z.string().min(1),
      
      videoSource: z.enum(['camera', 'screen']).optional(),
    }),
  }),
  z.object({
    type: z.literal('producer-video-source'),
    payload: z.object({
      producerId: z.string().min(1),
      source: z.enum(['camera', 'screen']),
    }),
  }),
  
  z.object({
    type: z.literal('set-outbound-video-paused'),
    payload: z.object({
      paused: z.boolean(),
    }),
  }),
  
  z.object({
    type: z.literal('set-audio-muted'),
    payload: z.object({
      muted: z.boolean(),
    }),
  }),
  z.object({
    type: z.literal('consume'),
    payload: z.object({
      transportId: z.string().min(1),
      producerId: z.string().min(1),
      rtpCapabilities: z.unknown(),
    }),
  }),
  z.object({
    type: z.literal('set-consumer-preferred-layers'),
    payload: z.object({
      consumerId: z.string().min(1),
      spatialLayer: z.number().int().min(0).max(2),
      temporalLayer: z.number().int().min(0).max(2).optional(),
    }),
  }),
  /**
   * Receiver-driven consumer pause/resume. Used by the client to ask the SFU to stop
   * forwarding RTP for a specific consumer when the corresponding tile is hidden /
   * offscreen / the tab is in the background. Audio consumers MUST NOT be paused
   * (preserves active speaker + mixing); the server enforces this guard.
   */
  z.object({
    type: z.literal('set-consumer-paused'),
    payload: z.object({
      consumerId: z.string().min(1),
      paused: z.boolean(),
    }),
  }),
  /** App-level keepalive so proxies / CDNs do not close idle signaling (background tabs). */
  z.object({
    type: z.literal('client-ping'),
    payload: z.object({}).optional(),
  }),
  
  z.object({
    type: z.literal('pong'),
    payload: z.object({}).optional(),
  }),
  z.object({
    type: z.literal('call-chat'),
    payload: z.object({
      text: z.string().min(1).max(500),
    }),
  }),
  z.object({
    type: z.literal('raise-hand'),
    payload: z.object({
      raised: z.boolean(),
    }),
  }),
  z.object({
    type: z.literal('request-producer-sync'),
    payload: z
      .object({
        /**
         * When true (default): client may `teardownAllRemoteConsumers` before re-consuming (tab refresh / recovery).
         * When false: merge-only catch-up — same producer list semantics as `recv-connected` (post-join race fix).
         */
        resetConsumers: z.boolean().optional(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal(MafiaWs.claimHost),
    payload: z.object({
      sessionId: z.string().min(1).max(128).optional(),
    }).optional(),
  }),
  z.object({
    type: z.literal(MafiaWs.transferHost),
    payload: z.object({
      userId: z.string().min(1).max(128),
    }),
  }),
  z.object({
    type: z.literal(MafiaWs.queueUpdate),
    payload: z.object({
      
      speakingQueue: z.array(z.number().int().min(1).max(12)).max(16),
    }),
  }),
  z.object({
    type: z.literal(MafiaWs.reshuffle),
    payload: z.object({
      players: z
        .array(
          z.object({
            peerId: z.string().min(1),
            seat: z.number().int().min(1).max(12),
            role: mafiaRoleSchema,
          }),
        )
        .min(1)
        .max(12),
    }),
  }),
  z.object({
    type: z.literal(MafiaWs.playersUpdate),
    payload: z.object({
      order: z.array(z.string().min(1)).min(1).max(12),
      clearRoles: z.boolean().optional(),
      oldMafiaMode: z.boolean().optional(),
      nightActions: z
        .object({
          mafia: z.number().int().min(1).max(12).optional(),
          doctor: z.number().int().min(1).max(12).optional(),
          sheriff: z.number().int().min(1).max(12).optional(),
          don: z.number().int().min(1).max(12).optional(),
        })
        .strict()
        .optional(),
      speakingQueue: z.array(z.number().int().min(1).max(12)).max(16),
    }),
  }),
  z.object({
    type: z.literal(MafiaWs.playerNameUpdate),
    payload: z.object({
      targetPeerId: z.string().min(1),
      /** Empty string resets back to the server-sanitized default. */
      displayName: z.string().max(64),
    }),
  }),
  z.object({
    type: z.literal(MafiaWs.modeUpdate),
    payload: z.object({
      mode: z.union([z.literal('old'), z.literal('new')]),
    }),
  }),
  z.object({
    type: z.literal(MafiaWs.settingsUpdate),
    payload: z.object({
      deadBackgrounds: z
        .array(mafiaBackgroundItemSchema)
        .min(1)
        .max(20)
        .refine(backgroundsArrayUnderTotalCap, {
          message: 'deadBackgrounds total URL bytes exceeds cap',
        }),
      activeBackgroundId: z.string().min(1).max(128).nullable(),
    }),
  }),
  z.object({
    type: z.literal(MafiaWs.pageBackgroundSettings),
    payload: z.object({
      backgrounds: z
        .array(mafiaPageBackgroundItemSchema)
        .min(1)
        .max(20)
        .refine(backgroundsArrayUnderTotalCap, {
          message: 'backgrounds total URL bytes exceeds cap',
        }),
      selectedBackgroundId: z.string().min(1).max(128).nullable(),
      forcedBackgroundId: z.string().min(1).max(128).nullable(),
    }),
  }),
  z.object({
    type: z.literal(MafiaWs.timerStart),
    payload: z.object({
      startedAt: z.number().int(),
      duration: z.number().int().min(30_000).max(7_200_000),
      isRunning: z.boolean().optional(),
    }),
  }),
  z.object({
    type: z.literal(MafiaWs.timerStop),
    payload: z.object({}).strict(),
  }),
  z.object({
    type: z.literal(MafiaWs.playerKick),
    payload: z.object({
      peerId: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal(MafiaWs.playerRevive),
    payload: z.object({
      peerId: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal(MafiaWs.forceCameraOff),
    payload: z.object({
      peerId: z.string().min(1),
      /**
       * Optional toggle (default `true` when omitted). Lets the host clear
       * `Peer.forcedCameraOff` for the target without changing the legacy
       * "force camera off" semantic of older clients (they send no `paused`
       * field, server defaults to `true`).
       */
      paused: z.boolean().optional(),
    }),
  }),
  z.object({
    type: z.literal(MafiaWs.forceMuteAll),
    payload: z.object({
      muted: z.boolean().optional(),
    }).strict(),
  }),
  z.object({
    type: z.literal('eat:force-mute-all'),
    payload: z.object({
      muted: z.boolean().optional(),
    }).strict(),
  }),
  z.object({
    type: z.literal('eat:trait-reveal-request'),
    payload: z.object({
      slotId: z.string().regex(/^p([1-9]|1[01])$/),
      traitKey: z.enum(['gender', 'age', 'profession', 'health', 'hobby', 'phobia', 'fact', 'baggage']),
      closed: z.boolean().optional(),
    }).strict(),
  }),
  z.object({
    type: z.literal('eat:trait-regenerate-request'),
    payload: z.object({
      slotId: z.string().regex(/^p([1-9]|1[01])$/),
      traitKey: z.enum(['gender', 'age', 'profession', 'health', 'hobby', 'phobia', 'fact', 'baggage']),
    }).strict(),
  }),
  z.object({
    type: z.literal('eat:trait-type-reroll-request'),
    payload: z.object({
      traitKey: z.enum(['gender', 'age', 'profession', 'health', 'hobby', 'phobia', 'fact', 'baggage']),
    }).strict(),
  }),
  /**
   * Reroll the action card for one slot or for every active slot. `'*'` is
   * the server-side wildcard for "every slot in the room". Anything else
   * must match `p1..p11`.
   */
  z.object({
    type: z.literal('eat:action-card-reroll-request'),
    payload: z.object({
      slotId: z.union([z.literal('*'), z.string().regex(/^p([1-9]|1[01])$/)]),
    }).strict(),
  }),
  /**
   * Eat First slot claim: the call peer announces which `EatFirstPlayer`
   * slot they own. Server validates `joinToken`+`deviceId` against the
   * stored `EatFirstPlayer.data` (mirrors REST player-action auth) before
   * binding `peer.eatFirstSlotId`. Host peers must not claim a seat (server rejects).
   * Sent after `room-state` so the
   * client already has its peerId; safe to retry on reconnect (idempotent).
   */
  z.object({
    type: z.literal('eat:slot-claim'),
    payload: z
      .object({
        slotId: z.string().regex(/^p([1-9]|1[01])$/),
        joinToken: z.string().min(1).max(128),
        deviceId: z.string().min(8).max(128),
      })
      .strict(),
  }),
  /** Host-only: persist+broadcast the seat order (slot ids). */
  z.object({
    type: z.literal('eat:players-update'),
    payload: z
      .union([
        z.object({
          playerOrder: z.array(z.string().regex(/^p([1-9]|1[01])$/)).min(1).max(11),
        }).strict(),
        z.object({
          order: z.array(z.string().regex(/^p([1-9]|1[01])$/)).min(1).max(11),
        }).strict(),
      ]),
  }),
  /** Host-only: sync nomination queue (1-based display seats) to all peers in the room. */
  z.object({
    type: z.literal('eat:speaking-queue-update'),
    payload: z
      .object({
        speakingQueue: z.array(z.number().int().min(1).max(11)).max(16),
      })
      .strict(),
  }),
  /** Host-only: full table deal/shuffle — server persists order + traits/cards; payload unused. */
  z.object({
    type: z.literal('eat:table-round-deal'),
    payload: z.object({}).strict(),
  }),
  /** Host-only: start the speaking timer (preset durations only). */
  z.object({
    type: z.literal('eat:timer-start'),
    payload: z.object({
      startedAt: z.number().int(),
      duration: z.number().int().min(5_000).max(7_200_000),
    }).strict(),
  }),
  /** Host-only: stop the speaking timer immediately. */
  z.object({
    type: z.literal('eat:timer-stop'),
    payload: z.object({}).strict(),
  }),
  /** Seat owner marks their card used; host may mark any seated slot. Persists + broadcast. */
  z.object({
    type: z.literal('eat:action-card-use'),
    payload: z.object({
      slotId: z.string().regex(/^p([1-9]|1[01])$/),
    }).strict(),
  }),
])

export type ClientMessage = z.infer<typeof clientMessageSchema>
