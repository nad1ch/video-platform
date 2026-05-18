import { prisma } from '../../prisma'

export type StreamerEconomySettingsDto = {
  streamerId: string
  chatRewardsEnabled: boolean
  predictionsEnabled: boolean
  caseDropsEnabled: boolean
  maxCoinsPerViewerPerStream: number
  maxPredictionStake: number
  maxActivePredictions: number
}

const DEFAULTS = {
  chatRewardsEnabled: true,
  predictionsEnabled: true,
  caseDropsEnabled: true,
  maxCoinsPerViewerPerStream: 500,
  maxPredictionStake: 10_000,
  maxActivePredictions: 3,
}

/**
 * Read the per-streamer settings, falling back to defaults when no row exists.
 * Pure read — does NOT create a row implicitly so settings stay absent for
 * untouched streamers and DB writes are reserved for explicit owner edits.
 */
export async function getStreamerSettings(
  streamerId: string,
): Promise<StreamerEconomySettingsDto> {
  const row = await prisma.streamerEconomySettings.findUnique({
    where: { streamerId },
    select: {
      streamerId: true,
      chatRewardsEnabled: true,
      predictionsEnabled: true,
      caseDropsEnabled: true,
      maxCoinsPerViewerPerStream: true,
      maxPredictionStake: true,
      maxActivePredictions: true,
    },
  })
  if (!row) {
    return { streamerId, ...DEFAULTS }
  }
  return row
}

export type StreamerSettingsPatch = Partial<{
  chatRewardsEnabled: boolean
  predictionsEnabled: boolean
  caseDropsEnabled: boolean
  maxCoinsPerViewerPerStream: number
  maxPredictionStake: number
  maxActivePredictions: number
}>

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

/**
 * Upsert per-streamer settings. Caller must have already authorized the
 * action (see `streamerOwnership.isStreamerOwner`). Numeric fields are
 * server-clamped to sane ranges to prevent obviously-broken values.
 */
export async function upsertStreamerSettings(
  streamerId: string,
  patch: StreamerSettingsPatch,
): Promise<StreamerEconomySettingsDto> {
  const data = {
    chatRewardsEnabled:
      typeof patch.chatRewardsEnabled === 'boolean'
        ? patch.chatRewardsEnabled
        : DEFAULTS.chatRewardsEnabled,
    predictionsEnabled:
      typeof patch.predictionsEnabled === 'boolean'
        ? patch.predictionsEnabled
        : DEFAULTS.predictionsEnabled,
    caseDropsEnabled:
      typeof patch.caseDropsEnabled === 'boolean'
        ? patch.caseDropsEnabled
        : DEFAULTS.caseDropsEnabled,
    maxCoinsPerViewerPerStream: clampInt(
      patch.maxCoinsPerViewerPerStream,
      0,
      1_000_000,
      DEFAULTS.maxCoinsPerViewerPerStream,
    ),
    maxPredictionStake: clampInt(
      patch.maxPredictionStake,
      1,
      1_000_000,
      DEFAULTS.maxPredictionStake,
    ),
    maxActivePredictions: clampInt(
      patch.maxActivePredictions,
      0,
      20,
      DEFAULTS.maxActivePredictions,
    ),
  }
  const row = await prisma.streamerEconomySettings.upsert({
    where: { streamerId },
    create: { streamerId, ...data },
    update: data,
    select: {
      streamerId: true,
      chatRewardsEnabled: true,
      predictionsEnabled: true,
      caseDropsEnabled: true,
      maxCoinsPerViewerPerStream: true,
      maxPredictionStake: true,
      maxActivePredictions: true,
    },
  })
  return row
}
