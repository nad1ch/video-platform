'use strict'

function wordGraphemeCount(s) {
  return [...s].length
}

function computeFeedback(answer, guess) {
  const secretArr = [...answer]
  const guessArr = [...guess]
  const n = secretArr.length
  if (guessArr.length !== n) {
    throw new Error('computeFeedback: length mismatch')
  }

  const result = Array.from({ length: n }, () => 'absent')
  const letterCount = new Map()
  for (const ch of secretArr) {
    letterCount.set(ch, (letterCount.get(ch) ?? 0) + 1)
  }

  for (let i = 0; i < n; i++) {
    if (guessArr[i] === secretArr[i]) {
      result[i] = 'correct'
      const ch = guessArr[i]
      letterCount.set(ch, (letterCount.get(ch) ?? 0) - 1)
    }
  }

  for (let i = 0; i < n; i++) {
    if (result[i] === 'correct') {
      continue
    }
    const ch = guessArr[i]
    const left = letterCount.get(ch) ?? 0
    if (left > 0) {
      result[i] = 'present'
      letterCount.set(ch, left - 1)
    }
  }

  return result
}

module.exports = { wordGraphemeCount, computeFeedback }
