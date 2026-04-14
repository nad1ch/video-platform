/** Дуже тихий клік після відправки голосу (лише клієнт, без файлів). */
export function playVoteSubmitSound(volume = 0.15) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 920
    const v = Math.min(0.2, Math.max(0.05, volume))
    gain.gain.setValueAtTime(v, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.05)
    osc.onended = () => ctx.close().catch(() => {})
  } catch {
    /* ignore */
  }
}

/** Легкий «переворот карти» при відкритті/закритті характеристики (клієнт). */
export function playRevealFlipSound(volume = 0.1) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(380, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.06)
    const v = Math.min(0.18, Math.max(0.04, volume))
    gain.gain.setValueAtTime(v, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.09)
    osc.onended = () => ctx.close().catch(() => {})
  } catch {
    /* ignore */
  }
}
