import { reactive } from 'vue'

/** Дані та дії для пульта ведучого в глобальному header (ControlPage → App). */
export const hostControlChromeStore = reactive({
  active: false,
  summaryLine: '',
  round: 1,
  gameRoom: {},
  votesLive: [],
  allPlayersVoted: false,
  speakingDuration: 30,
  phaseOptions: [],
  /** @type {Record<string, Function> | null} */
  actions: null,
  /** @type {Array<{ id: string, endedAt: number, round: number, target: string, votes: Array<{ voter: string, choice: string }> }>} */
  voteHistorySessions: [],
  /** @type {Record<string, number>} */
  handRaises: {},
})

export function syncHostControlChrome(patch) {
  Object.assign(hostControlChromeStore, patch)
  hostControlChromeStore.active = true
}

export function clearHostControlChrome() {
  hostControlChromeStore.active = false
  hostControlChromeStore.actions = null
  hostControlChromeStore.summaryLine = ''
  hostControlChromeStore.voteHistorySessions = []
  hostControlChromeStore.handRaises = {}
}
