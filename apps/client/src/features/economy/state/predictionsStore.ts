import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  cancelPrediction,
  createPrediction,
  joinPrediction,
  listPredictions,
  lockPrediction,
  resolvePrediction,
  type CreatePredictionPayload,
  type EconomyApiError,
  type PredictionDto,
} from '../api/economyApi'

export const usePredictionsStore = defineStore('economyPredictions', () => {
  const predictions = ref<PredictionDto[]>([])
  const listLoading = ref(false)
  const listError = ref<EconomyApiError | null>(null)
  const lastStreamerId = ref<string | null>(null)

  const actionInflight = ref<string | null>(null)
  const actionError = ref<EconomyApiError | null>(null)
  const lastJoinedEntry = ref<{ predictionId: string; coinBalanceAfter: number } | null>(null)

  function applyError(slot: 'list' | 'action', err: unknown): void {
    const e: EconomyApiError =
      err && typeof err === 'object' && 'status' in (err as Record<string, unknown>)
        ? (err as EconomyApiError)
        : { status: 0, code: 'NETWORK', message: (err as Error)?.message ?? 'Network error' }
    if (slot === 'list') listError.value = e
    else actionError.value = e
  }

  async function loadForStreamer(streamerId: string, status?: string): Promise<void> {
    if (!streamerId) return
    listLoading.value = true
    listError.value = null
    lastStreamerId.value = streamerId
    try {
      const r = await listPredictions(streamerId, status)
      predictions.value = r.predictions
    } catch (err) {
      applyError('list', err)
    } finally {
      listLoading.value = false
    }
  }

  async function create(payload: CreatePredictionPayload): Promise<string | null> {
    if (actionInflight.value) return null
    actionInflight.value = 'create'
    actionError.value = null
    try {
      const r = await createPrediction(payload)
      if (lastStreamerId.value) await loadForStreamer(lastStreamerId.value)
      return r.predictionId
    } catch (err) {
      applyError('action', err)
      return null
    } finally {
      actionInflight.value = null
    }
  }

  async function join(
    predictionId: string,
    optionId: string,
    stake: number,
  ): Promise<boolean> {
    if (actionInflight.value) return false
    actionInflight.value = `join:${predictionId}`
    actionError.value = null
    try {
      const r = await joinPrediction(predictionId, optionId, stake)
      lastJoinedEntry.value = { predictionId, coinBalanceAfter: r.coinBalanceAfter }
      if (lastStreamerId.value) await loadForStreamer(lastStreamerId.value)
      return true
    } catch (err) {
      applyError('action', err)
      return false
    } finally {
      actionInflight.value = null
    }
  }

  async function lock(predictionId: string): Promise<boolean> {
    if (actionInflight.value) return false
    actionInflight.value = `lock:${predictionId}`
    actionError.value = null
    try {
      await lockPrediction(predictionId)
      if (lastStreamerId.value) await loadForStreamer(lastStreamerId.value)
      return true
    } catch (err) {
      applyError('action', err)
      return false
    } finally {
      actionInflight.value = null
    }
  }

  async function resolve(predictionId: string, winningOptionId: string): Promise<boolean> {
    if (actionInflight.value) return false
    actionInflight.value = `resolve:${predictionId}`
    actionError.value = null
    try {
      await resolvePrediction(predictionId, winningOptionId)
      if (lastStreamerId.value) await loadForStreamer(lastStreamerId.value)
      return true
    } catch (err) {
      applyError('action', err)
      return false
    } finally {
      actionInflight.value = null
    }
  }

  async function cancel(predictionId: string): Promise<boolean> {
    if (actionInflight.value) return false
    actionInflight.value = `cancel:${predictionId}`
    actionError.value = null
    try {
      await cancelPrediction(predictionId)
      if (lastStreamerId.value) await loadForStreamer(lastStreamerId.value)
      return true
    } catch (err) {
      applyError('action', err)
      return false
    } finally {
      actionInflight.value = null
    }
  }

  return {
    predictions,
    listLoading,
    listError,
    lastStreamerId,
    actionInflight,
    actionError,
    lastJoinedEntry,
    loadForStreamer,
    create,
    join,
    lock,
    resolve,
    cancel,
  }
})
