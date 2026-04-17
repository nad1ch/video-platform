import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '../firebase.js'
import { callableRegion } from './callableApi.js'

function functionsInstance() {
  const region = callableRegion()
  if (!region) throw new Error('VITE_FUNCTIONS_REGION is not set')
  if (!app) throw new Error('Firebase is not configured')
  return getFunctions(app, region)
}

export async function callPromoteToHost(password) {
  const fn = httpsCallable(functionsInstance(), 'promoteToHost')
  const { data } = await fn({ password })
  return data
}

export async function callLinkPlayerSlot(gameId, playerId, joinToken) {
  const fn = httpsCallable(functionsInstance(), 'linkPlayerSlot')
  const { data } = await fn({ gameId, playerId, joinToken })
  return data
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function callSubmitVote(gameId, targetPlayer, choice) {
  const fn = httpsCallable(functionsInstance(), 'submitVote')
  try {
    const { data } = await fn({ gameId, targetPlayer, choice })
    return data && typeof data === 'object' ? data : { ok: false, reason: 'invalid' }
  } catch (e) {
    const code = e?.code || ''
    const msg = String(e?.message ?? '')
    if (code === 'functions/permission-denied' && msg.includes('not-linked')) {
      return { ok: false, reason: 'not-linked' }
    }
    if (code === 'functions/failed-precondition') {
      return { ok: false, reason: 'invalid' }
    }
    if (code === 'functions/invalid-argument') {
      return { ok: false, reason: 'invalid' }
    }
    throw e
  }
}

export async function callHostClearVotes(gameId) {
  const fn = httpsCallable(functionsInstance(), 'hostClearVotes')
  await fn({ gameId })
}

export async function callHostDeleteVote(gameId, voterId) {
  const fn = httpsCallable(functionsInstance(), 'hostDeleteVote')
  await fn({ gameId, voterId })
}

export async function callHostSetGamePhase(gameId, phase) {
  const fn = httpsCallable(functionsInstance(), 'hostSetGamePhase')
  await fn({ gameId, phase })
}
