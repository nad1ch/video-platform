import { reactive } from 'vue'


export const hostControlChromeStore = reactive({
  active: false,
  summaryLine: '',
  round: 1,
  gameRoom: {},
  votesLive: [],
  allPlayersVoted: false,
  speakingDuration: 30,
  phaseOptions: [],
  
  actions: null,
  
  voteHistorySessions: [],
  
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
