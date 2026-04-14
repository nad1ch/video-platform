<script setup>
import { useControlOrchestrator } from '../composables/control/useControlOrchestrator.js'
import AppPageLoader from '../ui/molecules/AppPageLoader.vue'
import ConfirmDialog from '../ui/molecules/ConfirmDialog.vue'
import ShowDeskHeader from '../components/showdesk/ShowDeskHeader.vue'
import ShowPlayersRoster from '../components/showdesk/ShowPlayersRoster.vue'
import UiMenuSelect from '../ui/molecules/UiMenuSelect.vue'

const {
  route,
  router,
  t,
  te,
  ANTI_GHOST_PLAYER_MS,
  EAT_FIRST_ONBOARDING_EXPAND,
  GAME_ID_UNSAFE,
  HOST_BLOCKS_KEY,
  PHASE_OPTIONS,
  PLAYER_SLOTS,
  PLAYER_TRAIT_COL_LEFT,
  PLAYER_TRAIT_COL_RIGHT,
  activeAntiGhostPlayerSlots,
  activeCardPanelKey,
  adminAccessDenied,
  adminClearTimer,
  adminKeyOk,
  adminNextSpeaker,
  adminPauseTimerOnly,
  adminResumeTimer,
  adminStartSpeakingTimer,
  aggregateForVotesByTarget,
  aliveCount,
  alivePlayersCount,
  allAlivePlayersReady,
  allPlayers,
  allPlayersVoted,
  analyzeVoteOutcome,
  antiGhostPlayerUntil,
  appendVoteTargetsThisRound,
  applyFromFirestoreSnapshot,
  applyNewGame,
  applyPlayerListFromFirestore,
  askBulkDeletePlayers,
  askGenerateRandomCharacter,
  askGlobalChaos,
  askGlobalRollField,
  askGlobalRollSelected,
  askRegenerateActiveCardOne,
  askRegenerateActiveCardsAll,
  askRegenerateAllPlayers,
  ballotSummaryOpen,
  ballotSummarySessions,
  bootstrappedControl,
  buildUsedStateExcludingEditorSlot,
  bulkSelectedSlots,
  bumpHandRaiseSlot,
  characterReadsFemale,
  characterState,
  cleanupSubs,
  clearBulkSelection,
  clearCardRequest,
  computeRevealMaxForRound,
  confirmActiveCardEffect,
  controlPauseShow,
  controlQuery,
  controlReset,
  controlStartRound,
  copyGlobal,
  copyPersonal,
  countPlayerRevealSlotsUsed,
  countRevealedCoreTraits,
  createAndGoToPlayer,
  defaultHostBlocksOpen,
  draftGameId,
  editorPlayerId,
  editorPlayerInRoster,
  elimSuggestForVotes,
  elimSuggestHandLines,
  elimSuggestOpen,
  elimSuggestSlot,
  eliminatedBySlot,
  ensureEditorSlotHasPlayerDoc,
  fieldConfig,
  fieldMenuOptions,
  focusFirstSlotWhenRosterEmpty,
  formatGenderDisplay,
  gameId,
  gameIdHasUnsafeChars,
  gameRoom,
  genDialogMessage,
  genDialogOpen,
  genDialogRunner,
  genDialogShowCountInput,
  genDialogTitle,
  genEmptyRosterCount,
  generateRandomCharacter,
  globalChaos,
  globalFieldPick,
  globalRollField,
  globalRollSelected,
  globalUrlAbsolute,
  goToPlayer,
  gotGameRoomSnap,
  gotPlayersSnap,
  hostApplyBallotFromNominations,
  hostBlocksOpen,
  hostChromeActions,
  hostClearHands,
  hostClearSessionStatsOnly,
  hostCollapseAllBlocks,
  hostConfirmEliminateSuggested,
  hostDismissEliminateSuggested,
  hostEliminateSuggestedPlayer,
  hostExecuteBulkDeletePlayers,
  hostExecuteDeletePlayer,
  hostExpandAllBlocks,
  hostFinishVoting,
  hostForgetSavedAndLeave,
  hostHandRaiseRows,
  hostModeRequested,
  hostRemoveVote,
  hostResetPlayerRoles,
  hostReviveAllPlayers,
  hostRoundDelta,
  hostSessionEndedLabel,
  hostSessionStats,
  hostSessionVoteTally,
  hostSetVoteSlotDuration,
  hostSummaryLine,
  hostTieDefenseDuration,
  hostTimerRemaining,
  hostToggleNomination,
  hostVotingStart,
  isAdmin,
  isLastNominationBallotSlot,
  lastAutoFinishedVoteSlotMs,
  lastPlayersFirestoreList,
  loadError,
  modeLabel,
  myHandRaised,
  myPlayerReady,
  myStatusLabel,
  navigateQuery,
  newPlayerId,
  nominatedPlayerActive,
  nominationsList,
  onEatFirstOnboardingExpand,
  onHostGenDialogClose,
  onHostGenDialogConfirm,
  onRosterHostCommand,
  onToggleBulkSelection,
  openHostGenConfirm,
  orderTieSlotsByNominationOrder,
  overlayHrefGlobal,
  overlayHrefPersonal,
  panelHydrating,
  pendingPlayerDeletes,
  persistHostStats,
  persistNominationOnePerRound,
  persistScenarioChoice,
  personalUrlAbsolute,
  playerDocJoinToken,
  playerHasVotedThisRound,
  playerId,
  playerIsVotingTarget,
  playerJoinGateReady,
  playerPhaseDisplay,
  playerReadyPillLabel,
  playerRevealLocked,
  playerSlotAccessBlocked,
  playerVoteBusy,
  playerVoteSlotLabel,
  playerVotingTargetId,
  playersReadyMap,
  prevHandsForStats,
  pruneAntiGhostPlayerUntil,
  raisedHandsCount,
  readHostBlocksOpen,
  readyPlayersCount,
  reconcilePendingDeletesWithSnapshot,
  reconcilePlayerRevealLedgerCount,
  regenerateActiveCardForCurrentSlot,
  regenerateActiveCardsForAllPlayers,
  regenerateAllPlayers,
  requestCardFromHost,
  rerollActiveCardOnly,
  rerollIdentity,
  rerollSingleTrait,
  revealDemographics,
  revealTrait,
  roomRoundLive,
  rosterOrderHint,
  rosterSlotNum,
  runCreateNPlayersFromDialog,
  saveTimer,
  scenarioForRolls,
  scenarioMenuOptions,
  scheduleSave,
  selectedDeskPlayerId,
  selectedScenario,
  sessionVoteForCount,
  setMyHandRaised,
  setMyPlayerReady,
  setPhase,
  setSpotlightPlayer,
  showControlPageLoader,
  showPlayerVotingUi,
  showToast,
  skipRemoteAutosave,
  slotsToSkipPersistOnSwitch,
  speakingDuration,
  submitPlayerVote,
  suggestedNextPlayerId,
  syncRevealLedgerForOpenAttempt,
  syncing,
  tick,
  tickTimer,
  tieBreakOpen,
  tieBreakSlots,
  timerSpeakerSlot,
  toast,
  toastTimer,
  unsubCharacter,
  urlKey,
  votes,
  votesLiveRound,
  votesLiveRoundVoterIds,
  votesPayloadFingerprint,
} = useControlOrchestrator()
</script>

<template>
  <div v-if="adminAccessDenied" class="access-denied">
    <h1 class="denied-title">{{ t('control.accessDenied') }}</h1>
    <p class="denied-text">{{ t('control.deniedBefore') }}<code>key</code>{{ t('control.deniedAfter') }}</p>
  </div>

  <div v-else-if="playerSlotAccessBlocked" class="access-denied">
    <h1 class="denied-title">{{ t('control.slotAccessTitle') }}</h1>
    <p class="denied-text">{{ t('control.slotAccessHint') }}</p>
    <router-link class="denied-back" :to="{ name: 'eat', query: { view: 'join', game: gameId } }">
      {{ t('control.slotAccessCta') }}
    </router-link>
  </div>

  <div v-else class="desk">
    <AppPageLoader
      :visible="showControlPageLoader"
      :label="t('loader.control')"
    />
    <p v-if="loadError" class="error error--alert" role="alert">{{ loadError }}</p>

    <div
      class="mode-strip"
      :class="{ admin: isAdmin, player: !isAdmin }"
      :data-onb="isAdmin ? 'control-host-strip' : undefined"
    >
      <span class="mode-label">{{ modeLabel }}</span>
      <span v-if="!isAdmin" class="status-pill" :data-s="myStatusLabel">{{ myStatusLabel }}</span>
      <div v-if="isAdmin" class="host-mode-actions">
        <button type="button" class="host-strip-btn" @click="hostCollapseAllBlocks">
          {{ t('control.hostCollapseAll') }}
        </button>
        <button type="button" class="host-strip-btn" @click="hostExpandAllBlocks">
          {{ t('control.hostExpandAll') }}
        </button>
        <button type="button" class="host-forget-btn" @click="hostForgetSavedAndLeave">
          {{ t('control.hostForgetKey') }}
        </button>
      </div>
    </div>

    <template v-if="isAdmin">
      <section
        class="admin-zone admin-zone--live admin-card admin-zone--live-priority"
        :aria-label="t('control.ariaLive')"
        data-onb="control-host-live"
      >
        <button
          type="button"
          class="host-block-fold"
          :aria-expanded="hostBlocksOpen.live"
          @click="hostBlocksOpen.live = !hostBlocksOpen.live"
        >
          <span
            class="host-block-fold__chev"
            :class="{ 'host-block-fold__chev--open': hostBlocksOpen.live }"
            aria-hidden="true"
          >▶</span>
          <span class="host-block-fold__label">{{ t('control.hostBlockLive') }}</span>
        </button>
        <div class="host-fold-anim" :class="{ 'host-fold-anim--open': hostBlocksOpen.live }">
          <div class="host-fold-anim__inner">
            <div class="host-block-fold__body">
          <ShowDeskHeader
            class="admin-zone__header"
            :game-title="t('game.title')"
            :game-id="gameId"
            :game-phase="String(gameRoom.gamePhase || 'intro')"
            :scenario-label="t(`scenarios.${selectedScenario}.label`)"
            :alive-count="aliveCount"
            :personal-url="personalUrlAbsolute"
            :global-url="globalUrlAbsolute"
            @copy-personal="copyPersonal"
            @copy-global="copyGlobal"
          />
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="isAdmin"
        class="admin-zone admin-zone--host-session admin-card"
        :aria-label="t('control.hostSessionTitle')"
      >
        <button
          type="button"
          class="host-block-fold"
          :aria-expanded="hostBlocksOpen.sessionStats"
          @click="hostBlocksOpen.sessionStats = !hostBlocksOpen.sessionStats"
        >
          <span
            class="host-block-fold__chev"
            :class="{ 'host-block-fold__chev--open': hostBlocksOpen.sessionStats }"
            aria-hidden="true"
          >▶</span>
          <span class="host-block-fold__label zone-kicker zone-kicker--fold">{{ t('control.hostSessionTitle') }}</span>
        </button>
        <div class="host-fold-anim" :class="{ 'host-fold-anim--open': hostBlocksOpen.sessionStats }">
          <div class="host-fold-anim__inner">
            <div class="host-block-fold__body">
              <div class="host-session-stats host-session-stats--standalone">
                <div class="host-session-stats__inner">
                  <section class="host-session-stats__block" :aria-label="t('control.hostSessionHands')">
                    <h4 class="host-session-stats__h">{{ t('control.hostSessionHands') }}</h4>
                    <p class="host-session-stats__hint">{{ t('control.hostSessionHandsHint') }}</p>
                    <ul class="host-session-hands">
                      <li v-for="row in hostHandRaiseRows" :key="row.id" class="host-session-hands__li">
                        <span class="host-session-hands__id">{{ row.id }}</span>
                        <span class="host-session-hands__n">✋ × {{ row.n }}</span>
                      </li>
                    </ul>
                  </section>
                  <section class="host-session-stats__block" :aria-label="t('control.hostSessionVotes')">
                    <h4 class="host-session-stats__h">{{ t('control.hostSessionVotes') }}</h4>
                    <p v-if="!(hostSessionStats.voteSessions && hostSessionStats.voteSessions.length)" class="host-session-muted">
                      {{ t('control.hostSessionVotesEmpty') }}
                    </p>
                    <div
                      v-for="sess in hostSessionStats.voteSessions"
                      :key="sess.id"
                      class="host-session-vote-card"
                    >
                      <div class="host-session-vote-card__head">
                        <span class="host-session-vote-card__meta"
                          >R{{ sess.round }} · {{ t('control.hostSessionTarget') }} {{ sess.target || '—' }}</span
                        >
                        <span class="host-session-vote-card__tally"
                          >👍 {{ hostSessionVoteTally(sess).forC }} · 👎 {{ hostSessionVoteTally(sess).ag
                          }}<template v-if="sess.syntheticEmptyRun && (sess.slotCount || 1) > 1">
                            · {{ t('control.ballotSummaryMergedSlots', { n: sess.slotCount || 1 }) }}</template
                          >
                          · {{ hostSessionEndedLabel(sess.endedAt) }}</span
                        >
                      </div>
                      <ul v-if="sess.votes && sess.votes.length" class="host-session-vote-card__ul">
                        <li v-for="(v, idx) in sess.votes" :key="sess.id + '-' + idx + '-' + v.voter" class="host-session-vote-card__li">
                          <span class="host-session-vote-card__voter">{{ v.voter }}</span>
                          <span class="host-session-vote-card__arrow">→</span>
                          <span class="host-session-vote-card__tgt">{{ sess.target || '—' }}</span>
                          <span class="host-session-vote-card__ch">{{ v.choice === 'against' ? '👎' : '👍' }}</span>
                        </li>
                      </ul>
                      <p v-else class="host-session-muted host-session-muted--tight">{{ t('control.hostSessionNoBallots') }}</p>
                    </div>
                  </section>
                  <button type="button" class="btn-soft host-session-clear" @click="hostClearSessionStatsOnly">
                    {{ t('control.hostSessionClear') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="isAdmin"
        class="admin-zone admin-zone--players admin-zone--host-active-card"
        :aria-label="t('control.ariaActiveCard')"
      >
        <button
          type="button"
          class="host-block-fold"
          :aria-expanded="hostBlocksOpen.activeCard"
          @click="hostBlocksOpen.activeCard = !hostBlocksOpen.activeCard"
        >
          <span
            class="host-block-fold__chev"
            :class="{ 'host-block-fold__chev--open': hostBlocksOpen.activeCard }"
            aria-hidden="true"
          >▶</span>
          <span class="host-block-fold__label zone-kicker zone-kicker--fold">{{ t('control.activeCard') }} · {{ editorPlayerId }}</span>
        </button>
        <div class="host-fold-anim" :class="{ 'host-fold-anim--open': hostBlocksOpen.activeCard }">
          <div class="host-fold-anim__inner">
            <div class="host-block-fold__body">
        <div class="active-card-box active-card-box--host-standalone">
          <div v-if="characterState.activeCardRequest" class="card-request-host">
            <p class="card-request-host__text">{{ t('control.cardRequestHost') }}</p>
            <button
              type="button"
              class="btn-confirm-card"
              :disabled="characterState.activeCard.used"
              @click="confirmActiveCardEffect"
            >
              {{ t('control.confirmCard') }}
            </button>
          </div>
          <label class="field-label" for="host-standalone-ac-title">{{ t('control.acFieldTitle') }}</label>
          <input
            id="host-standalone-ac-title"
            v-model="characterState.activeCard.title"
            type="text"
            class="input"
            :placeholder="t('control.titlePh')"
            autocomplete="off"
          />
          <label class="field-label" for="host-standalone-ac-desc">{{ t('control.acFieldDesc') }}</label>
          <textarea
            id="host-standalone-ac-desc"
            v-model="characterState.activeCard.description"
            class="textarea"
            rows="3"
            :placeholder="t('control.descPh')"
            autocomplete="off"
          />
          <p class="ac-meta">effectId: <code>{{ characterState.activeCard.effectId || '—' }}</code></p>
          <div class="ac-actions">
            <button type="button" class="btn-soft" @click="rerollActiveCardOnly">{{ t('control.newCardRandom') }}</button>
            <button
              v-if="characterState.activeCardRequest"
              type="button"
              class="btn-soft"
              @click="clearCardRequest"
            >
              {{ t('control.clearPlayerRequest') }}
            </button>
            <button
              v-if="!characterState.activeCardRequest"
              type="button"
              class="btn-primary btn-primary--solid"
              :disabled="characterState.activeCard.used"
              @click="confirmActiveCardEffect"
            >
              {{ t('control.applyEffect') }}
            </button>
          </div>
        </div>
            </div>
          </div>
        </div>
      </section>

      <section
        class="admin-zone admin-zone--players"
        :class="{ 'admin-zone--nominated-active': nominatedPlayerActive }"
        :aria-label="t('control.ariaPlayers')"
        data-onb="control-host-roster"
      >
        <button
          type="button"
          class="host-block-fold"
          :aria-expanded="hostBlocksOpen.players"
          @click="hostBlocksOpen.players = !hostBlocksOpen.players"
        >
          <span
            class="host-block-fold__chev"
            :class="{ 'host-block-fold__chev--open': hostBlocksOpen.players }"
            aria-hidden="true"
          >▶</span>
          <span class="host-block-fold__label zone-kicker zone-kicker--fold">{{ t('control.zonePlayers') }}</span>
        </button>
        <div class="host-fold-anim" :class="{ 'host-fold-anim--open': hostBlocksOpen.players }">
          <div class="host-fold-anim__inner">
            <div class="host-block-fold__body">
        <ShowPlayersRoster
          v-model:selected-player-id="selectedDeskPlayerId"
          :players="allPlayers"
          :hands-map="gameRoom.hands || {}"
          :players-ready-map="gameRoom.playersReady || {}"
          :current-player-id="editorPlayerId"
          :spotlight-player-id="String(gameRoom.activePlayer || '')"
          :speaker-id="String(gameRoom.currentSpeaker || '')"
          :voting-target-id="String(gameRoom.voting?.targetPlayer || '')"
          :voting-active="Boolean(gameRoom.voting?.active)"
          :nominations="nominationsList"
          :player-slots="PLAYER_SLOTS"
          :bulk-selected-ids="bulkSelectedSlots"
          :order-hint="rosterOrderHint"
          :voted-player-ids-this-round="votesLiveRoundVoterIds"
          :prioritize-non-voter-hands="isLastNominationBallotSlot"
          :use-host-panel="true"
          @open-editor="goToPlayer"
          @host-command="onRosterHostCommand"
          @toggle-nomination="hostToggleNomination"
          @toggle-bulk="onToggleBulkSelection"
          @bulk-delete-request="askBulkDeletePlayers"
          @bulk-clear="clearBulkSelection"
          @apply-ballot-order="hostApplyBallotFromNominations"
        />
        <div class="host-nom-rule-wrap">
          <label class="host-nom-rule ui-checkbox ui-checkbox--text ui-checkbox--lg">
            <span class="ui-checkbox__hit">
              <input
                type="checkbox"
                :checked="Boolean(gameRoom.nominationOneTargetPerRound)"
                @change="persistNominationOnePerRound($event.target.checked)"
              />
              <span class="ui-checkbox__box" aria-hidden="true" />
            </span>
            <span>{{ t('control.nominationOnePerRound') }}</span>
          </label>
        </div>
        <aside class="side-tools side-tools--inline">
          <label class="field-label" for="host-side-game-id">{{ t('control.gameId') }}</label>
          <div class="inline">
            <input id="host-side-game-id" v-model="draftGameId" type="text" class="input" autocomplete="off" />
            <button type="button" class="btn-soft btn-lift" @click="applyNewGame">OK</button>
          </div>
          <p v-if="gameIdHasUnsafeChars" class="hint-sc hint-sc--tight hint-sc--warn">
            {{ t('control.gameIdUnsafeHint') }}
          </p>
          <label class="field-label mt" for="host-side-new-player-id">{{ t('control.newPlayerId') }}</label>
          <div class="inline">
            <input
              id="host-side-new-player-id"
              v-model="newPlayerId"
              type="text"
              class="input"
              :placeholder="suggestedNextPlayerId"
              autocomplete="off"
            />
            <button type="button" class="btn-soft btn-lift" @click="createAndGoToPlayer">+</button>
          </div>
        </aside>
            </div>
          </div>
        </div>
      </section>

      <section
        class="admin-zone admin-zone--generate admin-zone--tier-lower"
        :aria-label="t('control.ariaGen')"
        data-onb="control-host-gen"
      >
        <button
          type="button"
          class="host-block-fold host-block-fold--soft"
          :aria-expanded="hostBlocksOpen.gen"
          @click="hostBlocksOpen.gen = !hostBlocksOpen.gen"
        >
          <span
            class="host-block-fold__chev"
            :class="{ 'host-block-fold__chev--open': hostBlocksOpen.gen }"
            aria-hidden="true"
          >▶</span>
          <span class="host-block-fold__label zone-kicker zone-kicker--soft zone-kicker--gen-title zone-kicker--fold">{{
            t('control.zoneGen')
          }}</span>
        </button>
        <div class="host-fold-anim" :class="{ 'host-fold-anim--open': hostBlocksOpen.gen }">
          <div class="host-fold-anim__inner">
            <div class="host-block-fold__body">
        <div class="gen-bar gen-bar--actions gen-bar--compact">
          <button type="button" class="btn-neon btn-neon--compact" @click="askGenerateRandomCharacter">
            {{ t('control.genPlayer') }}
          </button>
          <button type="button" class="btn-neon btn-neon--wide btn-neon--compact" @click="askRegenerateAllPlayers">
            {{ t('control.genAll') }}
          </button>
          <button
            type="button"
            class="btn-neon btn-neon--soft btn-neon--compact"
            @click="askRegenerateActiveCardOne"
          >
            {{ t('control.genActiveOne') }}
          </button>
          <button
            type="button"
            class="btn-neon btn-neon--soft btn-neon--compact"
            @click="askRegenerateActiveCardsAll"
          >
            {{ t('control.genActiveAll') }}
          </button>
        </div>
        <p class="hint-sc hint-sc--tight hint-sc--muted">{{ t(`scenarios.${selectedScenario}.hint`) }}</p>
        <div class="scenario-row">
          <label class="field-label field-label--inline">{{ t('control.scenario') }}</label>
          <UiMenuSelect
            v-model="selectedScenario"
            class="control-menu-select"
            :options="scenarioMenuOptions"
            :aria-label="t('control.scenario')"
            variant="block"
            @change="persistScenarioChoice"
          />
        </div>
        <h3 class="sub-kicker sub-kicker--soft">{{ t('control.globalAll') }}</h3>
        <div class="global-btns global-btns--compact">
          <button type="button" class="gbtn" @click="askGlobalRollField('profession')">{{ t('traits.profession') }}</button>
          <button type="button" class="gbtn" @click="askGlobalRollField('health')">{{ t('traits.health') }}</button>
          <button type="button" class="gbtn" @click="askGlobalRollField('phobia')">{{ t('traits.phobia') }}</button>
          <button type="button" class="gbtn" @click="askGlobalChaos">{{ t('control.chaos') }}</button>
        </div>
        <div class="pick-row pick-row--compact">
          <label class="field-label">{{ t('control.fieldForAll') }}</label>
          <UiMenuSelect
            v-model="globalFieldPick"
            class="control-menu-select"
            :options="fieldMenuOptions"
            :aria-label="t('control.fieldForAll')"
            variant="block"
          />
          <button type="button" class="btn-primary btn-primary--compact" @click="askGlobalRollSelected">OK</button>
        </div>
            </div>
          </div>
        </div>
      </section>

      <ConfirmDialog
        v-model:open="genDialogOpen"
        :title="genDialogTitle"
        :message="genDialogMessage"
        :confirm-label="t('control.genConfirmProceed')"
        :cancel-label="t('control.genConfirmCancel')"
        @close="onHostGenDialogClose"
        @confirm="onHostGenDialogConfirm"
      >
        <template v-if="genDialogShowCountInput" #extra>
          <label class="field-label" for="gen-empty-count">{{ t('control.genEmptyCountLabel') }}</label>
          <input
            id="gen-empty-count"
            v-model.number="genEmptyRosterCount"
            type="number"
            min="1"
            max="10"
            class="input"
            style="width: 100%; margin-top: 0.35rem"
          />
        </template>
      </ConfirmDialog>
    </template>

    <div v-else class="player-hero">
      <h1 class="player-title">{{ t('game.title') }}</h1>
      <p class="player-phase">{{ t('control.playerPhase', { phase: playerPhaseDisplay }) }}</p>
      <div
        v-if="characterState.eliminated !== true"
        class="player-hero-actions"
        role="group"
        :aria-label="t('control.playerQuickActionsAria')"
        data-onb="control-player-actions"
      >
        <div class="hand-toggle" role="group" :aria-label="t('control.handGroup')">
          <button
            type="button"
            class="hand-icon-btn"
            :class="{ 'hand-icon-btn--up': myHandRaised }"
            :aria-pressed="myHandRaised"
            :aria-label="myHandRaised ? t('control.handLower') : t('control.handRaise')"
            :title="myHandRaised ? t('control.handLowerTitle') : t('control.handRaiseTitle')"
            @click="setMyHandRaised(!myHandRaised)"
          >
            <span class="hand-icon-btn__ico" aria-hidden="true">✋</span>
          </button>
          <span class="hand-toggle__caption">{{ myHandRaised ? t('control.handUp') : t('control.handDown') }}</span>
        </div>
        <div class="ready-toggle" role="group" :aria-label="t('control.readyGroup')">
          <button
            type="button"
            class="ready-pill"
            :class="{ 'ready-pill--on': myPlayerReady, 'ready-pill--off': !myPlayerReady }"
            :aria-pressed="myPlayerReady"
            :aria-label="playerReadyPillLabel"
            :title="playerReadyPillLabel"
            @click="setMyPlayerReady(!myPlayerReady)"
          >
            {{ playerReadyPillLabel }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showPlayerVotingUi" class="player-vote-panel">
      <p class="player-vote-panel__k">{{ t('control.votingTitle') }}</p>
      <p class="player-vote-panel__line">{{ t('control.voteAgainst', { name: playerVoteSlotLabel }) }}</p>
      <p v-if="playerIsVotingTarget" class="player-vote-panel__warn">{{ t('control.youAreVoted') }}</p>
      <p v-if="playerHasVotedThisRound" class="player-vote-panel__done">{{ t('control.youVotedAlready') }}</p>
      <div v-else class="player-vote-panel__row">
        <button
          type="button"
          class="player-vote-btn player-vote-btn--for"
          :disabled="playerVoteBusy"
          @click="submitPlayerVote('for')"
        >
          {{ t('control.voteFor') }}
        </button>
        <button
          type="button"
          class="player-vote-btn player-vote-btn--against"
          :disabled="playerVoteBusy"
          @click="submitPlayerVote('against')"
        >
          {{ t('control.voteAgainstBtn') }}
        </button>
      </div>
    </div>

    <section
      id="host-editor-panel"
      class="panel editor-panel editor-panel--calm"
      :class="{ 'editor-panel--hydrating': panelHydrating }"
    >
      <div v-if="panelHydrating" class="panel-hydrate-overlay" aria-busy="true" :aria-label="t('control.panelLoadingAria')">
        <span class="panel-hydrate-spinner" />
        <span class="panel-hydrate-label">{{ t('loader.panelCard') }}</span>
      </div>
      <div class="editor-panel__head">
        <button
          v-if="isAdmin"
          type="button"
          class="host-block-fold host-block-fold--editor"
          :aria-expanded="hostBlocksOpen.editor"
          :aria-label="hostBlocksOpen.editor ? t('control.hostSectionCollapse') : t('control.hostSectionExpand')"
          @click="hostBlocksOpen.editor = !hostBlocksOpen.editor"
        >
          <span
            class="host-block-fold__chev"
            :class="{ 'host-block-fold__chev--open': hostBlocksOpen.editor }"
            aria-hidden="true"
          >▶</span>
          <h2 class="panel-kicker host-block-fold__label">{{ t('control.editorTitle', { id: editorPlayerId }) }}</h2>
        </button>
        <h2 v-else class="panel-kicker">{{ t('control.yourChar') }}</h2>
      </div>

      <div
        class="host-fold-anim host-fold-anim--editor"
        :class="{ 'host-fold-anim--open': !isAdmin || hostBlocksOpen.editor }"
      >
        <div class="host-fold-anim__inner">
          <div class="editor-panel__collapsible">
      <div v-if="isAdmin" class="trait-block trait-block--identity">
        <div class="trait-toolbar">
          <span class="trait-label">{{ t('control.profileOverlay') }}</span>
          <div class="trait-actions">
            <button type="button" class="icon-btn icon-btn--reroll" :title="t('control.reroll')" @click="rerollIdentity">
              🎲
            </button>
            <button
              type="button"
              class="reveal-toggle"
              :title="t('control.demographicsOnOverlay')"
              :class="{ 'reveal-toggle--open': characterState.demographicsRevealed }"
              @click="revealDemographics(!characterState.demographicsRevealed)"
            >
              {{ characterState.demographicsRevealed ? t('control.open') : t('control.closed') }}
            </button>
          </div>
        </div>
        <div class="meta-grid">
          <div>
            <label class="field-label" for="host-editor-char-name">{{ t('control.name') }}</label>
            <input id="host-editor-char-name" v-model="characterState.name" type="text" class="input" autocomplete="name" />
          </div>
          <div>
            <label class="field-label" for="host-editor-char-age">{{ t('control.age') }}</label>
            <input id="host-editor-char-age" v-model="characterState.age" type="text" class="input" inputmode="numeric" />
          </div>
          <div>
            <label class="field-label" for="host-editor-char-gender">{{ t('control.gender') }}</label>
            <input
              id="host-editor-char-gender"
              v-model="characterState.gender"
              type="text"
              class="input"
              :placeholder="t('control.genderPh')"
              autocomplete="sex"
            />
          </div>
        </div>
      </div>

      <div v-else class="player-char-grid" data-onb="control-player-card">
        <div class="trait-block trait-block--player trait-block--identity player-char-grid__identity">
          <div class="trait-toolbar">
            <span class="trait-label">{{ t('control.profile') }}</span>
            <button
              v-if="!playerRevealLocked"
              type="button"
              class="reveal-toggle reveal-toggle--player"
              :title="t('control.demographicsOnOverlay')"
              :class="{ 'reveal-toggle--open': characterState.demographicsRevealed }"
              @click="revealDemographics(!characterState.demographicsRevealed)"
            >
              {{ characterState.demographicsRevealed ? t('control.open') : t('control.closed') }}
            </button>
          </div>
          <div class="identity-reveal-block">
            <p class="pv-line"><span class="mk">{{ t('control.name') }}</span> {{ characterState.name || '—' }}</p>
            <p class="pv-line">
              <span class="mk">{{ t('control.ageGender') }}</span> {{ characterState.age || '—' }} ·
              {{ formatGenderDisplay(characterState.gender) }}
            </p>
            <p class="pv-hint">{{ t('control.playerPanelRevealHint') }}</p>
          </div>
        </div>

        <div class="player-char-grid__traits player-traits-cols">
          <div class="player-traits-col" :aria-label="t('control.ariaTraitsL')">
            <div v-for="row in PLAYER_TRAIT_COL_LEFT" :key="row.key" class="trait-block trait-block--player">
              <div class="trait-toolbar">
                <span class="trait-label">{{ t(`traits.${row.key}`) }}</span>
                <button
                  v-if="!playerRevealLocked"
                  type="button"
                  class="reveal-toggle reveal-toggle--player"
                  :class="{ 'reveal-toggle--open': characterState[row.key].revealed }"
                  @click="revealTrait(row.key, !characterState[row.key].revealed)"
                >
                  {{ characterState[row.key].revealed ? t('control.open') : t('control.closed') }}
                </button>
              </div>
              <p class="trait-value-preview trait-value-preview--on">
                {{ characterState[row.key].value || '—' }}
              </p>
            </div>
          </div>
          <div class="player-traits-col" :aria-label="t('control.ariaTraitsR')">
            <div v-for="row in PLAYER_TRAIT_COL_RIGHT" :key="row.key" class="trait-block trait-block--player">
              <div class="trait-toolbar">
                <span class="trait-label">{{ t(`traits.${row.key}`) }}</span>
                <button
                  v-if="!playerRevealLocked"
                  type="button"
                  class="reveal-toggle reveal-toggle--player"
                  :class="{ 'reveal-toggle--open': characterState[row.key].revealed }"
                  @click="revealTrait(row.key, !characterState[row.key].revealed)"
                >
                  {{ characterState[row.key].revealed ? t('control.open') : t('control.closed') }}
                </button>
              </div>
              <p class="trait-value-preview trait-value-preview--on">
                {{ characterState[row.key].value || '—' }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="isAdmin" class="traits-stack">
        <div v-for="row in fieldConfig" :key="row.key" class="trait-block">
          <div class="trait-toolbar">
            <label class="trait-label" :for="'host-editor-trait-' + row.key">{{ t(`traits.${row.key}`) }}</label>
            <div class="trait-actions">
              <button
                type="button"
                class="icon-btn icon-btn--reroll"
                :title="t('control.rerollField')"
                @click="rerollSingleTrait(row.key)"
              >
                🎲
              </button>
              <button
                type="button"
                class="reveal-toggle"
                :class="{ 'reveal-toggle--open': characterState[row.key].revealed }"
                @click="revealTrait(row.key, !characterState[row.key].revealed)"
              >
                {{ characterState[row.key].revealed ? t('control.open') : t('control.closed') }}
              </button>
            </div>
          </div>
          <input
            :id="'host-editor-trait-' + row.key"
            v-model="characterState[row.key].value"
            type="text"
            class="input trait-value-input"
          />
        </div>
      </div>

      <div v-if="!isAdmin" class="active-card-box" data-onb="control-player-active-card">
        <h3 class="ac-title">{{ t('control.activeCard') }}</h3>
        <Transition name="ac-swap" mode="out-in">
          <div :key="activeCardPanelKey" class="active-card-player-block">
            <p class="ac-t">{{ characterState.activeCard.title || '—' }}</p>
            <p class="ac-d">{{ characterState.activeCard.description || '—' }}</p>
            <p v-if="characterState.activeCard.used" class="ac-used">{{ t('control.used') }}</p>
            <p v-else-if="characterState.activeCardRequest" class="ac-pending">
              {{ t('control.awaitHost') }}
            </p>
            <button
              v-else
              type="button"
              class="btn-request"
              @click="requestCardFromHost"
            >
              Використати карту
            </button>
          </div>
        </Transition>
      </div>

          </div>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="ballotSummaryOpen"
        class="host-modal-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="t('control.ballotSummaryTitle')"
        @click.self="ballotSummaryOpen = false"
      >
        <div class="host-modal host-modal--wide">
          <h3 class="host-modal__title">{{ t('control.ballotSummaryTitle') }}</h3>
          <ul class="host-ballot-summary-list">
            <li v-for="s in ballotSummarySessions" :key="s.id" class="host-ballot-summary-li">
              <span class="host-ballot-summary-meta">
                R{{ s.round }} · {{ t('hostChrome.target') }} {{ s.target || '—' }} · 👍
                {{ hostSessionVoteTally(s).forC }} · 👎 {{ hostSessionVoteTally(s).ag
                }}<template v-if="s.syntheticEmptyRun && (s.slotCount || 1) > 1">
                  · {{ t('control.ballotSummaryMergedSlots', { n: s.slotCount || 1 }) }}</template
                >
              </span>
            </li>
          </ul>
          <button type="button" class="btn-primary host-modal__ok" @click="ballotSummaryOpen = false">
            OK
          </button>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="tieBreakOpen"
        class="host-modal-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="t('control.tieBreakTitle')"
        @click.self="tieBreakOpen = false"
      >
        <div class="host-modal host-modal--wide">
          <h3 class="host-modal__title">{{ t('control.tieBreakTitle') }}</h3>
          <p class="host-modal__p">
            {{ t('control.tieBreakBodyN', { list: (tieBreakSlots || []).join(', ') }) }}
          </p>
          <p class="host-modal__hint">{{ t('control.tieBreakHintN') }}</p>
          <p class="host-modal__micro">{{ t('control.tieBreakDurPick') }}</p>
          <div class="host-modal__chips">
            <button
              v-for="s in [5, 10, 15, 30, 60]"
              :key="'tie-dur-' + s"
              type="button"
              class="host-tie-dur-chip"
              @click="hostTieDefenseDuration(s)"
            >
              {{ s >= 60 ? `1 ${t('control.tieBreakMin')}` : `${s} s` }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="elimSuggestOpen"
        class="host-modal-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="t('control.elimSuggestTitle')"
        @click.self="hostDismissEliminateSuggested"
      >
        <div class="host-modal host-modal--wide">
          <h3 class="host-modal__title">{{ t('control.elimSuggestTitle') }}</h3>
          <p class="host-modal__p">
            {{
              t('control.elimSuggestBody', { slot: elimSuggestSlot || '—', votes: elimSuggestForVotes })
            }}
          </p>
          <p v-if="elimSuggestHandLines?.key === 'agree'" class="host-modal__hint">
            {{ t('control.elimSuggestHandsAgree') }}
          </p>
          <p v-else-if="elimSuggestHandLines?.key === 'top'" class="host-modal__hint">
            {{ t('control.elimSuggestHandsTop', { list: elimSuggestHandLines.list }) }}
          </p>
          <div class="host-modal__row host-modal__row--stack">
            <button type="button" class="btn-primary" @click="hostConfirmEliminateSuggested">
              {{ t('control.elimSuggestConfirm') }}
            </button>
            <button type="button" class="btn-soft" @click="hostDismissEliminateSuggested">
              {{ t('control.elimSuggestSkip') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.desk {
  width: 100%;
  max-width: min(1200px, 100%);
  margin: 0 auto;
  padding: 0 1.25rem 4rem;
  box-sizing: border-box;
  min-width: 0;
}

.admin-zone--live-priority.admin-card {
  border-color: var(--border-strong);
  box-shadow: 0 0 32px var(--accent-glow);
}

.host-block-fold {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  margin: 0;
  padding: 0.38rem 0.35rem;
  min-height: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: var(--text-muted-soft);
  border-radius: 10px;
  box-sizing: border-box;
}

.host-block-fold:hover {
  color: var(--text-heading);
  background: var(--bg-muted);
}

.host-block-fold--soft {
  color: var(--text-muted);
}

.host-block-fold__chev {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.1rem;
  height: 1.1rem;
  font-size: 0.58rem;
  line-height: 1;
  opacity: 0.9;
  transform: rotate(0deg);
  transform-origin: center center;
  transition: transform 0.45s cubic-bezier(0.32, 0.72, 0, 1);
  /* вирівнювання гліфа ▶ відносно шрифтового центру */
  margin-top: 0.06em;
}

.host-block-fold__chev--open {
  transform: rotate(90deg);
}

.host-block-fold__label {
  flex: 1;
  margin: 0;
  line-height: 1.25;
  display: flex;
  align-items: center;
}

.zone-kicker--fold {
  margin: 0;
  text-align: left;
  line-height: 1.25;
}

.host-block-fold__body {
  min-width: 0;
}

.host-fold-anim {
  display: grid;
  grid-template-rows: 0fr;
  margin-top: 0;
  transition: grid-template-rows 0.58s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.host-fold-anim--open {
  grid-template-rows: 1fr;
  /* лише для відкритого: відступ від смуги згортання; у закритому — margin-top: 0 на .host-fold-anim */
  margin-top: 0.5rem;
}

.host-fold-anim__inner {
  overflow: hidden;
  min-height: 0;
  opacity: 0;
  transform: translateY(-6px);
  transition:
    opacity 0.52s ease,
    transform 0.52s ease;
}

.host-fold-anim--open .host-fold-anim__inner {
  overflow: visible;
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .host-fold-anim {
    transition: none;
  }

  .host-fold-anim__inner {
    opacity: 1;
    transform: none;
    transition: none;
  }

  .host-block-fold__chev {
    transition: none;
  }
}

/* як інші згортання: уся смуга клікабельна */
.host-block-fold--editor {
  color: var(--editor-trait-label, var(--text-muted-soft));
}

.host-block-fold--editor:hover {
  color: var(--text-heading);
}

.editor-panel--calm .host-block-fold--editor .panel-kicker {
  margin: 0;
  color: inherit;
}

.editor-panel__head {
  margin-bottom: 0;
}

.editor-panel__head > .panel-kicker {
  margin: 0;
}

.editor-panel__collapsible {
  min-width: 0;
}

.admin-zone {
  margin-bottom: 1.65rem;
}

.admin-card {
  border-radius: 16px;
  padding: 12px;
  background: var(--bg-card-solid);
  border: 1px solid var(--border);
  box-sizing: border-box;
  box-shadow: var(--panel-desk-shadow);
}

.admin-zone--players {
  border-radius: 16px;
  padding: clamp(0.75rem, 2vw, 1rem) 12px 12px;
  background: var(--bg-card-solid);
  border: 1px solid var(--border);
  box-sizing: border-box;
  box-shadow: var(--panel-desk-shadow);
}

.admin-zone--players :deep(.roster--embedded) {
  margin-bottom: 0;
}

.admin-zone--players :deep(.roster) {
  background: transparent;
  border: none;
  margin-bottom: 0;
  padding: 0.35rem 0 0;
}

.admin-zone--host-active-card .active-card-box--host-standalone {
  margin-top: 0.25rem;
}

.admin-zone--voting.admin-card :deep(.vp) {
  background: transparent;
  border: none;
  margin-bottom: 0;
}

.admin-zone--round.admin-card :deep(.rp) {
  background: transparent;
  border: none;
  margin-bottom: 0;
}

.admin-zone--live .admin-zone__header {
  margin-top: 0.35rem;
}

.zone-kicker--section {
  margin-bottom: 0.45rem;
  color: var(--text-muted);
}

.admin-zone--voting.admin-zone--glow {
  border-radius: 16px;
  padding: 0.15rem;
  border: 1px solid var(--border-cyan-strong);
  box-shadow: 0 0 28px var(--glow-vote);
  background: linear-gradient(
    135deg,
    var(--glow-vote-inner) 0%,
    var(--glow-vote-inner-2) 100%
  );
}

.admin-zone--round {
  margin-bottom: 1.25rem;
}

.admin-zone--nominated-active {
  border-radius: 16px;
  padding: 0.65rem 0.5rem 0.85rem;
  border: 1px solid var(--danger-border);
  box-shadow: 0 0 22px var(--danger-glow);
  background: var(--danger-bg);
}

.admin-zone--players.admin-zone--nominated-active {
  padding: 0.65rem 0.5rem 0.85rem;
}

.zone-kicker {
  margin: 0 0 0.55rem;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-muted-soft);
  font-family: 'Orbitron', sans-serif;
}

/* .zone-kicker нижче перебивав margin: 0 у --fold (лішнє місце знизу в смузі згортання) */
.zone-kicker.zone-kicker--fold {
  margin: 0;
}

.admin-zone--players > .zone-kicker {
  margin-bottom: 0.85rem;
}

.vote-log-details {
  margin-top: 0.75rem;
  padding: 0.5rem 0.65rem;
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-muted);
  font-size: 0.68rem;
  line-height: 1.4;
  color: var(--text-secondary);
}

.vote-log-details__sum {
  cursor: pointer;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.vote-log-details__list {
  margin: 0.45rem 0 0;
  padding: 0 0 0 1rem;
  max-height: 7.5rem;
  overflow-y: auto;
}

.vote-log-details__li {
  margin: 0.2rem 0;
}

.host-session-stats {
  margin-top: 0.75rem;
  padding: 0.5rem 0.65rem 0.65rem;
  border-radius: 12px;
  border: 1px solid var(--border-cyan-strong, var(--border-subtle));
  background: color-mix(in srgb, var(--bg-muted) 88%, var(--bg-card-solid));
  font-size: 0.7rem;
  line-height: 1.45;
  color: var(--text-secondary);
}

.host-session-stats--standalone {
  margin-top: 0;
  padding: 0;
  border: none;
  background: transparent;
}

.host-session-stats--standalone .host-session-stats__inner {
  margin-top: 0;
}

.host-session-stats__sum {
  cursor: pointer;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 0.62rem;
  color: var(--text-cyan, var(--text-muted));
  list-style: none;
}

.host-session-stats__sum::-webkit-details-marker {
  display: none;
}

.host-session-stats__inner {
  margin-top: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.host-session-stats__block {
  min-width: 0;
}

.host-session-stats__h {
  margin: 0 0 0.35rem;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.host-session-stats__hint {
  margin: 0 0 0.45rem;
  font-size: 0.62rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.host-session-muted {
  margin: 0.25rem 0 0;
  font-size: 0.65rem;
  color: var(--text-muted);
  font-style: italic;
}

.host-session-muted--tight {
  margin: 0.2rem 0 0;
}

.host-session-hands {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
  gap: 0.35rem 0.65rem;
}

.host-session-hands__li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.35rem;
  padding: 0.28rem 0.45rem;
  border-radius: 8px;
  background: var(--bg-card-solid);
  border: 1px solid var(--border-subtle);
  font-family: var(--font-display, monospace);
  font-size: 0.68rem;
}

.host-session-hands__n {
  font-weight: 800;
  color: var(--text-highlight, var(--text-heading));
}

.host-session-vote-card {
  margin-top: 0.5rem;
  padding: 0.45rem 0.55rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-card-solid);
}

.host-session-vote-card__head {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.host-session-vote-card__meta {
  font-weight: 700;
  color: var(--text-heading);
  font-size: 0.66rem;
}

.host-session-vote-card__tally {
  font-size: 0.6rem;
  color: var(--text-muted);
}

.host-session-vote-card__ul {
  margin: 0.45rem 0 0;
  padding: 0 0 0 1rem;
  font-size: 0.64rem;
}

.host-session-vote-card__li {
  margin: 0.15rem 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
}

.host-session-vote-card__voter {
  font-weight: 700;
  font-family: var(--font-display, monospace);
}

.host-session-vote-card__arrow {
  opacity: 0.45;
}

.host-session-vote-card__tgt {
  opacity: 0.85;
}

.host-session-vote-card__ch {
  margin-left: auto;
}

.host-session-clear {
  align-self: flex-start;
  font-size: 0.62rem;
}

.admin-zone--generate {
  padding: 0.85rem 1rem 1rem;
  border-radius: 14px;
  background: var(--bg-generate);
  border: 1px solid var(--border-subtle);
  margin-bottom: 1.2rem;
}

.admin-zone--tier-lower {
  opacity: 0.92;
  border-color: var(--border);
}

.zone-kicker--soft {
  color: var(--text-muted);
  letter-spacing: 0.16em;
}

.gen-bar--compact {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.35rem;
}

.gen-bar--compact .btn-neon--wide {
  width: auto;
  flex: 1 1 160px;
}

.btn-neon--compact {
  padding: 0.4rem 0.7rem;
  font-size: 0.7rem;
}

.hint-sc--muted {
  color: var(--text-muted);
  font-size: 0.66rem;
  line-height: 1.45;
}

.hint-sc--warn {
  color: var(--error-text, #fecaca);
  border-left: 3px solid var(--error-border, rgba(248, 113, 113, 0.55));
  padding-left: 0.5rem;
  margin-top: 0.35rem;
}

.scenario-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin: 0.25rem 0 0.45rem;
}

.field-label--inline {
  margin: 0;
}

.control-menu-select {
  flex: 1 1 12rem;
  min-width: 10rem;
  max-width: 22rem;
}

.sub-kicker--soft {
  margin: 0.55rem 0 0.35rem;
  color: var(--text-muted);
}

.global-btns--compact .gbtn {
  padding: 0.32rem 0.5rem;
  font-size: 0.7rem;
}

.pick-row--compact {
  margin-top: 0.45rem;
  align-items: center;
}

.btn-primary--compact {
  padding: 0.38rem 0.7rem;
  font-size: 0.76rem;
}

.zone-kicker--gen-title {
  letter-spacing: 0.2em;
  font-size: 0.68rem;
  color: var(--text-muted);
}

.sub-kicker {
  margin: 0.85rem 0 0.45rem;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.hint-sc--tight {
  margin: 0.4rem 0 0.5rem;
}

.gen-bar--actions {
  margin-bottom: 0.5rem;
}

.scenario-actions--top {
  margin: 0 0 0.35rem;
}

#host-editor-panel {
  scroll-margin-top: 5.5rem;
}

@media (max-width: 720px) {
  #host-editor-panel {
    scroll-margin-top: 4.5rem;
  }
}

.editor-panel {
  --editor-space: 0.7rem;
}

.editor-panel--calm {
  border-color: var(--border-editor-calm);
  background: var(--bg-editor-calm);
}

.editor-panel--calm .trait-label,
.editor-panel--calm .panel-kicker {
  color: var(--editor-trait-label);
}

.editor-panel--calm .trait-block,
.editor-panel--calm .trait-block--identity {
  border-color: var(--border-editor-calm);
}

.editor-panel--calm .trait-block--identity {
  background: transparent;
  border: none;
  padding-left: 0;
  padding-right: 0;
  padding-top: 0;
  border-radius: 0;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.editor-panel--calm .trait-block--identity .field-label {
  margin-bottom: 0.45rem;
}

.editor-panel--hydrating {
  position: relative;
  pointer-events: none;
  opacity: 0.88;
}

.panel-hydrate-overlay {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  border-radius: inherit;
  background: color-mix(in srgb, var(--bg-editor-calm) 82%, transparent);
  backdrop-filter: blur(6px);
  pointer-events: none;
}

.panel-hydrate-spinner {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 3px solid color-mix(in srgb, var(--border-strong) 55%, transparent);
  border-top-color: var(--accent-fill);
  animation: panelSpin 0.72s linear infinite;
}

.panel-hydrate-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

@keyframes panelSpin {
  to {
    transform: rotate(360deg);
  }
}

.player-char-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  align-self: stretch;
  min-width: 0;
}

/* Дві колонки: без container queries (уникаємо хибного max-width у scoped / containment) */
.player-char-grid__traits.player-traits-cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: clamp(0.65rem, 2vw, 1.15rem);
  row-gap: 0.5rem;
  align-items: start;
  width: 100%;
  min-width: 0;
}

.player-traits-col {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.player-traits-cols .trait-block--player {
  width: 100%;
  margin-bottom: 0;
}

@media (max-width: 540px) {
  .player-char-grid__traits.player-traits-cols {
    grid-template-columns: 1fr;
    column-gap: 0.5rem;
  }
}

.active-card-player-block {
  min-height: 2rem;
}

.ac-swap-enter-active {
  animation: acSwapIn 0.42s var(--motion-ease, cubic-bezier(0.22, 1, 0.36, 1)) both;
}

.ac-swap-leave-active {
  animation: acSwapOut 0.28s ease both;
}

@keyframes acSwapIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.97);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@keyframes acSwapOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.96);
    filter: blur(3px);
  }
}

.editor-panel--calm .input:focus,
.editor-panel--calm .textarea:focus,
.editor-panel--calm .trait-value-input:focus,
.editor-panel--calm .select:focus {
  outline: none;
  border-color: var(--border-strong);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.editor-panel .trait-block {
  margin-bottom: var(--editor-space);
}

.editor-panel .traits-stack .trait-block:last-child {
  margin-bottom: 0;
}

.editor-panel .trait-block--identity {
  margin-bottom: 1rem;
}

.mode-strip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  margin-bottom: 0.85rem;
  border-bottom: 1px solid var(--border-subtle);
}

.mode-strip.admin {
  border-color: var(--border-panel);
}

.host-mode-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.host-strip-btn {
  padding: 0.32rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(196, 181, 253, 0.42);
  background: rgba(15, 23, 42, 0.45);
  color: var(--text-secondary);
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.host-strip-btn:hover {
  color: var(--text-title);
  border-color: rgba(196, 181, 253, 0.7);
  background: rgba(88, 28, 135, 0.22);
  box-shadow: 0 0 14px rgba(168, 85, 247, 0.18);
}

.host-forget-btn {
  margin-left: 0;
  padding: 0.32rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(248, 113, 113, 0.45);
  background: var(--danger-bg);
  color: #fecaca;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.host-forget-btn:hover {
  color: #ffe4e6;
  border-color: rgba(248, 113, 113, 0.65);
  background: rgba(60, 22, 28, 0.45);
  box-shadow: 0 0 16px var(--danger-glow);
}

html[data-theme='light'] .host-strip-btn {
  background: rgba(255, 255, 255, 0.75);
  border-color: rgba(124, 58, 237, 0.35);
  color: rgba(30, 27, 46, 0.88);
  box-shadow: 0 1px 3px rgba(91, 33, 168, 0.08);
}

html[data-theme='light'] .host-strip-btn:hover {
  border-color: rgba(124, 58, 237, 0.55);
  background: rgba(243, 232, 255, 0.95);
}

html[data-theme='light'] .host-forget-btn {
  color: #b91c1c;
  border-color: rgba(220, 38, 38, 0.4);
  background: rgba(254, 226, 226, 0.85);
}

html[data-theme='light'] .host-forget-btn:hover {
  color: #991b1b;
  border-color: rgba(220, 38, 38, 0.55);
  background: rgba(254, 202, 202, 0.95);
}

.mode-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-heading);
}

.status-pill {
  font-size: 0.78rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: var(--accent-fill-soft);
  border: 1px solid var(--border-strong);
  color: var(--text-title);
}

.status-pill[data-s='ГОВОРИШ'] {
  border-color: rgba(251, 191, 36, 0.55);
  background: rgba(120, 53, 15, 0.28);
}

.status-pill[data-s='SPOTLIGHT'] {
  border-color: rgba(168, 85, 247, 0.55);
}

.status-pill[data-s='ВИБУВ'] {
  border-color: rgba(248, 113, 113, 0.4);
  background: rgba(80, 20, 30, 0.35);
}

.player-hero {
  text-align: center;
  padding: 1.5rem 0 1rem;
}

.player-title {
  margin: 0;
  font-size: 1.5rem;
  font-family: 'Orbitron', sans-serif;
  color: var(--text-title);
}

.player-phase {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.player-hero-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(1rem, 4vw, 2.25rem);
  margin-top: 1.1rem;
  flex-wrap: wrap;
}

.player-hero-actions .hand-toggle {
  margin-top: 0;
}

.hand-toggle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.1rem;
  flex-wrap: wrap;
}

.ready-toggle {
  display: flex;
  align-items: center;
}

.ready-pill {
  margin: 0;
  padding: 0.55rem 1rem;
  border-radius: 999px;
  border: 2px solid rgba(248, 113, 113, 0.55);
  background: rgba(80, 20, 30, 0.42);
  color: rgba(254, 226, 226, 0.96);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.22s ease,
    color 0.2s ease;
  box-shadow:
    0 0 14px rgba(239, 68, 68, 0.28),
    0 0 28px rgba(239, 68, 68, 0.12);
}

.ready-pill--off:hover {
  border-color: rgba(252, 165, 165, 0.75);
  box-shadow:
    0 0 18px rgba(239, 68, 68, 0.38),
    0 0 36px rgba(239, 68, 68, 0.16);
}

.ready-pill--on {
  border-color: rgba(74, 222, 128, 0.72);
  background: rgba(20, 83, 45, 0.42);
  color: rgba(220, 252, 231, 0.98);
  box-shadow:
    0 0 16px rgba(74, 222, 128, 0.38),
    0 0 32px rgba(74, 222, 128, 0.14);
}

.ready-pill--on:hover {
  border-color: rgba(134, 239, 172, 0.88);
  box-shadow:
    0 0 20px rgba(74, 222, 128, 0.48),
    0 0 40px rgba(74, 222, 128, 0.2);
}

.hand-toggle__caption {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.hand-icon-btn {
  width: 3.35rem;
  height: 3.35rem;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid var(--btn-hand-border);
  background: var(--bg-muted-strong);
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.22s ease;
  -webkit-tap-highlight-color: transparent;
}

.hand-icon-btn__ico {
  font-size: 1.45rem;
  line-height: 1;
  filter: grayscale(0.35);
  opacity: 0.65;
  transition:
    filter 0.2s ease,
    opacity 0.2s ease,
    transform 0.2s ease;
}

.hand-icon-btn:hover {
  transform: scale(1.05);
  border-color: rgba(251, 191, 36, 0.45);
}

.hand-icon-btn:focus-visible {
  outline: 2px solid var(--border-strong);
  outline-offset: 3px;
}

.hand-icon-btn--up {
  border-color: var(--btn-hand-up-border);
  background: var(--btn-hand-up-bg);
  box-shadow: 0 0 20px rgba(251, 191, 36, 0.35);
}

.hand-icon-btn--up .hand-icon-btn__ico {
  filter: grayscale(0);
  opacity: 1;
  transform: scale(1.08);
}

.hand-icon-btn:active {
  transform: scale(0.96);
}

.player-vote-panel {
  margin: 0 0 1rem;
  padding: 0.85rem 1rem;
  border-radius: 16px;
  border: 1px solid var(--border-cyan-strong);
  background: var(--bg-muted);
  box-shadow: 0 4px 20px var(--shadow-deep);
}

.player-vote-panel__k {
  margin: 0;
  font-size: 0.58rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  color: var(--text-cyan-strong);
  font-family: 'Orbitron', sans-serif;
}

.player-vote-panel__line {
  margin: 0.35rem 0 0;
  font-size: 0.88rem;
  color: var(--text-body);
}

.player-vote-panel__warn {
  margin: 0.45rem 0 0;
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--error-text);
}

.player-vote-panel__done {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.player-vote-panel__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.65rem;
}

.player-vote-btn {
  flex: 1 1 auto;
  min-width: 7rem;
  padding: 0.55rem 0.85rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 800;
  cursor: pointer;
  border: 2px solid transparent;
}

.player-vote-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.player-vote-btn--for {
  border-color: var(--reveal-on-border);
  background: var(--reveal-on-bg);
  color: var(--reveal-on-text);
}

.player-vote-btn--against {
  border-color: var(--reveal-off-border);
  background: var(--reveal-off-bg);
  color: var(--reveal-off-text);
}

.side-tools {
  padding: 1rem;
  border-radius: 16px;
  background: var(--bg-muted);
  border: 1px solid var(--border-subtle);
}

.inline {
  display: flex;
  gap: 0.35rem;
}

.field-label {
  display: block;
  margin-bottom: 0.3rem;
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.field-label.mt {
  margin-top: 0.75rem;
}

.input,
.textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.55rem 0.7rem;
  border-radius: 12px;
  border: 1px solid var(--border-input);
  background: var(--bg-input-soft);
  color: var(--text-body);
  font-size: 0.9rem;
}

.select {
  max-width: 280px;
}

.panel {
  padding: 1.35rem 1.45rem;
  margin-bottom: 1.75rem;
  border-radius: 20px;
  background: var(--bg-card-soft);
  border: 1px solid var(--border-panel);
  box-shadow: var(--panel-desk-shadow);
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.panel-kicker {
  margin: 0 0 1rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-heading);
  font-family: 'Orbitron', sans-serif;
}

.gen-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.btn-neon {
  padding: 0.5rem 0.95rem;
  border-radius: 12px;
  border: 1px solid var(--btn-neon-border);
  background: linear-gradient(180deg, var(--btn-neon-top), var(--btn-neon-bot));
  color: var(--text-title);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 0.04em;
  transition:
    transform 0.12s ease,
    box-shadow 0.15s;
}

.btn-neon:hover {
  transform: scale(1.02);
  box-shadow: 0 0 22px var(--accent-glow-strong);
}

.btn-neon--soft {
  border-color: var(--border-strong);
  background: var(--btn-soft-bg);
}

.btn-neon--wide {
  width: 100%;
  box-sizing: border-box;
}

.trait-block {
  padding: 0.85rem 1rem;
  border-radius: 16px;
  background: var(--bg-muted);
  border: 1px solid var(--trait-border);
  margin-bottom: 0.65rem;
}

.trait-block--identity {
  margin-bottom: 1rem;
}

.trait-block--identity .meta-grid {
  margin-bottom: 0;
}

.trait-block--player {
  border-color: var(--trait-player-border);
}

.trait-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.trait-label {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  cursor: default;
}

.traits-stack--player .trait-label,
.player-traits-cols .trait-label {
  color: var(--editor-trait-label);
}

.trait-actions {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-shrink: 0;
}

.icon-btn {
  width: 2.15rem;
  height: 2.15rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 10px;
  border: 1px solid var(--btn-soft-border);
  background: var(--bg-muted-strong);
  font-size: 0.95rem;
  line-height: 1;
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    transform 0.12s;
}

.icon-btn:hover {
  transform: scale(1.06);
  border-color: var(--border-strong);
}

.icon-btn.active {
  border-color: var(--border-strong);
  box-shadow: 0 0 16px var(--accent-glow-strong);
  background: var(--accent-fill);
}

.icon-btn--reroll {
  border-color: rgba(251, 191, 36, 0.42);
  background: rgba(120, 53, 15, 0.38);
}

.icon-btn--reroll:hover {
  transform: scale(1.08) translateY(-1px);
  border-color: rgba(252, 211, 77, 0.55);
  box-shadow: 0 4px 14px rgba(251, 191, 36, 0.15);
}

.reveal-toggle {
  flex-shrink: 0;
  min-width: 6.75rem;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  font-size: 0.58rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  border: 1px solid var(--reveal-off-border);
  background: var(--reveal-off-bg);
  color: var(--reveal-off-text);
  box-shadow: 0 0 10px var(--reveal-off-glow);
  transition:
    transform 0.14s var(--motion-ease, ease),
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.reveal-toggle--player {
  min-width: 5.75rem;
  font-size: 0.52rem;
}

.reveal-toggle:hover {
  transform: scale(1.04);
}

.reveal-toggle--open {
  border-color: var(--reveal-on-border);
  background: var(--reveal-on-bg);
  color: var(--reveal-on-text);
  box-shadow: 0 0 16px var(--reveal-on-glow);
}

.stat-reveal-enter-active {
  animation: revealStat 0.52s var(--motion-ease, cubic-bezier(0.22, 1, 0.36, 1)) both;
}

.stat-reveal-leave-active {
  animation: hideStat 0.36s var(--motion-ease, cubic-bezier(0.4, 0, 0.2, 1)) both;
}

@keyframes revealStat {
  0% {
    opacity: 0;
    transform: perspective(520px) rotateX(-14deg) translateY(10px) scale(0.92);
    filter: blur(6px);
  }
  50% {
    transform: perspective(520px) rotateX(5deg) scale(1.03);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: perspective(520px) rotateX(0deg) scale(1);
    filter: blur(0);
  }
}

@keyframes hideStat {
  0% {
    opacity: 1;
    transform: perspective(520px) rotateX(0deg) scale(1);
    filter: blur(0);
  }
  100% {
    opacity: 0;
    transform: perspective(520px) rotateX(12deg) translateY(-6px) scale(0.9);
    filter: blur(5px);
  }
}

.identity-reveal-block {
  margin-top: 0.15rem;
}

.traits-stack {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 1rem;
}

.trait-value-input {
  margin-top: 0;
}

.pv-line {
  margin: 0.35rem 0 0;
  color: var(--text-body);
}

.pv-line:first-of-type {
  margin-top: 0.15rem;
}

.pv-hidden {
  margin: 0.35rem 0 0;
  letter-spacing: 0.25em;
  font-size: 1.1rem;
  color: var(--text-muted);
}

.pv-hint {
  margin: 0.5rem 0 0;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.trait-value-preview {
  margin: 0;
  padding: 0.45rem 0 0.15rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text-body);
  line-height: 1.4;
}

.trait-value-preview--off {
  color: var(--text-secondary);
  letter-spacing: 0.2em;
}

.traits-stack--player .trait-block--player {
  margin-bottom: 0.5rem;
}

.side-tools--inline {
  margin-top: 1.2rem;
  margin-bottom: 1.1rem;
  padding: 0.85rem 1rem;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

@media (max-width: 640px) {
  .meta-grid {
    grid-template-columns: 1fr;
  }
}

.traits-grid {
  display: grid;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.player-meta p {
  margin: 0.25rem 0;
  color: #e2e8f0;
}

.meta-locked {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  line-height: 1.45;
  color: rgba(196, 181, 253, 0.65);
}

.ac-pending {
  margin: 0.65rem 0 0;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--active-card-pending);
}

.card-request-host {
  margin-bottom: 1rem;
  padding: 1rem 1.1rem;
  border-radius: 14px;
  border: 1px solid var(--card-request-border);
  background: var(--card-request-bg);
}

.card-request-host__text {
  margin: 0 0 0.75rem;
  font-size: 0.88rem;
  color: var(--card-request-text);
  font-weight: 600;
}

.btn-confirm-card {
  width: 100%;
  padding: 0.85rem 1rem;
  border-radius: 14px;
  border: 1px solid var(--confirm-card-border);
  background: linear-gradient(180deg, var(--confirm-card-bg-top), var(--confirm-card-bg-bot));
  color: #fff;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.btn-confirm-card:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mk {
  display: inline-block;
  min-width: 4.5rem;
  font-size: 0.72rem;
  color: var(--trait-mini-label);
}

.traits-read {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.trait-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0.65rem;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.t-label {
  font-size: 0.75rem;
  color: rgba(196, 181, 253, 0.55);
}

.t-val.hidden {
  font-size: 1rem;
}

.active-card-box {
  padding: 1.15rem 1.2rem;
  border-radius: 16px;
  background: var(--active-card-surface-bg);
  border: 1px solid var(--active-card-surface-border);
  margin-top: 0.35rem;
  margin-bottom: 1.35rem;
}

.active-card-box .input + .textarea {
  margin-top: 0.85rem;
}

.ac-title {
  margin: 0 0 0.65rem;
  font-size: 0.85rem;
  color: var(--active-card-heading);
  font-weight: 800;
}

.ac-meta {
  font-size: 0.75rem;
  color: var(--active-card-meta);
}

.ac-meta code {
  color: var(--active-card-meta);
  font-weight: 600;
}

.ac-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.65rem;
}

.ac-t {
  margin: 0 0 0.55rem;
  font-weight: 700;
  color: var(--active-card-title-text);
}

.ac-d {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--active-card-desc);
}

.ac-used {
  margin: 0.5rem 0 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--active-card-used);
}

.btn-request {
  margin-top: 0.75rem;
  padding: 0.55rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--btn-request-border);
  background: var(--btn-request-bg);
  color: var(--btn-request-text);
  font-weight: 600;
  cursor: pointer;
}

.btn-request:disabled {
  opacity: 0.55;
  cursor: default;
}

.reveal-hint {
  margin: -0.35rem 0 0.75rem;
  font-size: 0.72rem;
  color: rgba(196, 181, 253, 0.5);
  line-height: 1.35;
}

.reveal-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.reveal-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.28);
  color: #e2e8f0;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s,
    transform 0.15s ease;
}

.reveal-chip:not(:disabled):hover {
  transform: scale(1.03);
}

.reveal-chip.on {
  border-color: rgba(168, 85, 247, 0.5);
  background: rgba(88, 28, 135, 0.3);
}

.reveal-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.chip-mark {
  font-size: 0.85rem;
}

.reveal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem;
}

.reveal-tile {
  text-align: left;
  padding: 0.65rem 0.75rem;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.25);
  color: #e2e8f0;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.reveal-tile.on {
  border-color: rgba(167, 139, 250, 0.45);
  background: rgba(88, 28, 135, 0.25);
}

.reveal-tile:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.rt-label {
  display: block;
  font-size: 0.72rem;
  color: rgba(196, 181, 253, 0.55);
  margin-bottom: 0.25rem;
}

.rt-state {
  font-size: 0.82rem;
  font-weight: 700;
}

.global-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 1rem;
}

.gbtn {
  padding: 0.5rem 0.85rem;
  border-radius: 12px;
  border: 1px solid var(--border-input);
  background: var(--bg-muted);
  color: var(--text-body);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.15s,
    transform 0.15s ease;
}

.gbtn:hover {
  border-color: var(--border-strong);
  transform: scale(1.03);
}

.pick-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.65rem;
}

.hint-sc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0 0 0.65rem;
  line-height: 1.4;
}

.scenario-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.btn-primary {
  padding: 0.5rem 0.9rem;
  border-radius: 12px;
  border: 1px solid var(--border-strong);
  background: var(--accent-fill);
  color: var(--text-title);
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.btn-primary:not(:disabled):hover {
  transform: scale(1.03);
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-primary--solid {
  background: var(--btn-primary-solid-bg);
  color: var(--btn-primary-solid-text);
  border-color: var(--btn-primary-solid-border);
}

.btn-primary--solid:not(:disabled):hover {
  background: var(--btn-primary-solid-hover);
  border-color: var(--btn-primary-solid-border);
}

.btn-soft {
  padding: 0.5rem 0.85rem;
  border-radius: 12px;
  border: 1px solid var(--btn-soft-border);
  background: var(--btn-soft-bg);
  color: var(--text-body);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.btn-soft.btn-lift:hover {
  transform: scale(1.03);
}

.btn-amber {
  padding: 0.5rem 0.85rem;
  border-radius: 12px;
  border: 1px solid rgba(251, 191, 36, 0.35);
  background: rgba(120, 53, 15, 0.35);
  color: #fef3c7;
  font-weight: 600;
  cursor: pointer;
}

.error {
  padding: 0.65rem 0.85rem;
  border-radius: 12px;
  background: var(--error-bg);
  border: 1px solid var(--error-border);
  color: var(--error-text);
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

.error--alert {
  position: sticky;
  top: 0;
  z-index: 10001;
  margin-bottom: 0.65rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

.access-denied {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: var(--text-body);
}

.denied-title {
  color: var(--error-text);
}

.denied-text {
  max-width: 26rem;
  margin: 0.5rem 0 1rem;
  line-height: 1.5;
}

.denied-back {
  display: inline-block;
  padding: 0.55rem 1.1rem;
  border-radius: 10px;
  font-weight: 700;
  text-decoration: none;
  color: var(--text-title);
  background: var(--accent-fill);
  border: 1px solid var(--border-strong);
}

.denied-back:hover {
  filter: brightness(1.06);
}

.host-nom-rule-wrap {
  margin: 0.5rem 0 0.85rem;
}

.host-nom-rule {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
}

.host-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 12010;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.55);
}

.host-modal {
  width: 100%;
  max-width: 22rem;
  padding: 1.15rem 1.2rem 1rem;
  border-radius: 14px;
  border: 1px solid var(--border-strong);
  background: var(--bg-panel, #1a1525);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
}

.host-modal--wide {
  max-width: 28rem;
}

.host-modal__title {
  margin: 0 0 0.65rem;
  font-size: 0.88rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--text-heading);
}

.host-modal__p {
  margin: 0 0 0.5rem;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--text-secondary);
}

.host-modal__hint {
  margin: 0 0 0.85rem;
  font-size: 0.68rem;
  color: var(--text-muted);
  line-height: 1.35;
}

.host-modal__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.host-modal__row--stack {
  flex-direction: column;
  margin-top: 0.35rem;
}

.host-modal__row--stack .btn-primary,
.host-modal__row--stack .btn-soft {
  width: 100%;
  justify-content: center;
}

.host-modal__micro {
  margin: 0 0 0.45rem;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.host-modal__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.25rem;
}

.host-tie-dur-chip {
  min-width: 3.1rem;
  padding: 0.38rem 0.55rem;
  border-radius: 9px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-muted);
  color: var(--text-body);
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  transition: filter 0.12s ease, border-color 0.12s ease;
}

.host-tie-dur-chip:hover {
  border-color: var(--border-cyan-strong, rgba(94, 231, 223, 0.55));
  filter: brightness(1.06);
}

.host-modal__ok {
  margin-top: 0.85rem;
  width: 100%;
}

.host-ballot-summary-list {
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
  max-height: 40vh;
  overflow-y: auto;
}

.host-ballot-summary-li {
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.75rem;
}

.host-ballot-summary-meta {
  color: var(--text-body);
}
</style>

<style>
.toast {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  padding: 0.55rem 1.2rem;
  border-radius: 12px;
  background: var(--bg-toast);
  border: 1px solid var(--reveal-on-border);
  color: var(--reveal-on-text);
  font-size: 0.88rem;
  font-weight: 600;
  pointer-events: none;
}
</style>
