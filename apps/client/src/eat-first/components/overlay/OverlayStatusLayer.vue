<script setup>
import { useI18n } from 'vue-i18n'

defineProps({
  showAllVotedBanner: { type: Boolean, default: false },
  handsClusterMode: { type: Boolean, default: false },
  handsClusterExtra: { type: Number, default: 0 },
  isPersonal: { type: Boolean, default: false },
  roundBannerVisible: { type: Boolean, default: false },
  roomRound: { type: Number, default: 1 },
})

const { t } = useI18n()
</script>

<template>
  <p
    v-if="showAllVotedBanner"
    class="overlay-edge-hint overlay-edge-hint--all-voted"
    role="status"
  >
    {{ t('overlayPage.allVoted') }}
  </p>
  <p
    v-if="handsClusterMode && !isPersonal"
    class="overlay-edge-hint overlay-edge-hint--hands"
    aria-hidden="true"
  >
    ✋ +{{ handsClusterExtra }}
  </p>
  <Teleport to="body">
    <div
      v-if="roundBannerVisible"
      class="round-banner"
      role="status"
      aria-live="polite"
    >
      <p class="round-banner__n">{{ t('overlayPage.roundN', { n: roomRound }) }}</p>
      <p class="round-banner__t">{{ t('overlayPage.revealCard') }}</p>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay-edge-hint {
  position: fixed;
  z-index: 50;
  margin: 0;
  pointer-events: none;
  font-family: Orbitron, sans-serif;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.65);
}

.overlay-edge-hint--all-voted {
  top: max(0.4rem, env(safe-area-inset-top, 0px));
  left: max(0.5rem, env(safe-area-inset-left, 0px));
  font-size: clamp(0.52rem, min(1.4vw, 1.5vh), 0.62rem);
  color: rgba(187, 247, 208, 0.92);
  animation:
    allVotedFade 0.25s ease-out,
    allVotedGlow 1.2s ease-in-out;
}

@keyframes allVotedFade {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes allVotedGlow {
  0%,
  100% {
    filter: drop-shadow(0 0 4px rgba(74, 222, 128, 0.35));
  }
  50% {
    filter: drop-shadow(0 0 12px rgba(74, 222, 128, 0.65));
  }
}

.overlay-edge-hint--hands {
  top: max(0.4rem, env(safe-area-inset-top, 0px));
  right: max(0.5rem, env(safe-area-inset-right, 0px));
  font-size: clamp(0.58rem, min(1.55vw, 1.65vh), 0.72rem);
  color: rgba(254, 240, 138, 0.92);
}
</style>

<style>
.round-banner {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  pointer-events: none;
  background: rgba(5, 3, 8, 0.72);
  animation: roundBannerFade 1s ease forwards;
}

.round-banner__n {
  margin: 0;
  font-family: Orbitron, system-ui, sans-serif;
  font-size: clamp(1.25rem, 4vw, 1.85rem);
  font-weight: 900;
  letter-spacing: 0.2em;
  color: #a855f7;
  text-shadow: 0 0 24px rgba(168, 85, 247, 0.45);
}

.round-banner__t {
  margin: 0;
  font-size: clamp(0.72rem, 2vw, 0.95rem);
  font-weight: 700;
  letter-spacing: 0.28em;
  color: rgba(248, 250, 252, 0.88);
}

@keyframes roundBannerFade {
  0% {
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  78% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
