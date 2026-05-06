import { describe, expect, it } from 'vitest'
import {
  decodeSpeakingNominationFlat,
  nominationTargetSeatsFromSpeakingFlat,
  seatsInvolvedInSpeakingNominationFlat,
} from '@/utils/speakingNominationQueue'

describe('speakingNominationQueue', () => {
  it('decodes pair-encoded even-length queues', () => {
    expect(decodeSpeakingNominationFlat([1, 3, 2, 5])).toEqual([
      { pairIndex: 0, bySeat: 1, targetSeat: 3 },
      { pairIndex: 1, bySeat: 2, targetSeat: 5 },
    ])
  })

  it('treats odd-length queues as legacy target-only', () => {
    expect(decodeSpeakingNominationFlat([3, 5, 7])).toEqual([
      { pairIndex: 0, bySeat: null, targetSeat: 3 },
      { pairIndex: 1, bySeat: null, targetSeat: 5 },
      { pairIndex: 2, bySeat: null, targetSeat: 7 },
    ])
  })

  it('collects seats for pair-encoded queues', () => {
    expect([...seatsInvolvedInSpeakingNominationFlat([1, 3, 2, 3])].sort((a, b) => a - b)).toEqual([1, 2, 3])
  })

  it('collects seats for legacy target-only queues', () => {
    expect([...seatsInvolvedInSpeakingNominationFlat([4, 2])].sort((a, b) => a - b)).toEqual([2, 4])
  })

  it('target seats: pair-encoded keeps only nominees (second of each pair)', () => {
    expect([...nominationTargetSeatsFromSpeakingFlat([1, 3, 2, 5])].sort((a, b) => a - b)).toEqual([3, 5])
  })

  it('target seats: legacy odd-length treats every entry as a target', () => {
    expect([...nominationTargetSeatsFromSpeakingFlat([4, 2, 6])].sort((a, b) => a - b)).toEqual([2, 4, 6])
  })
})
