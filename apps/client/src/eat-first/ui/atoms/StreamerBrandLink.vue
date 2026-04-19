<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createLogger } from '@/utils/logger'
import {
  BRAND_LOGO_DARK_SVG,
  BRAND_LOGO_LIGHT_SVG,
  STREAMER_NICK,
  STREAMER_TWITCH_URL,
} from '../../constants/brand.js'
import { useTheme } from '../../state/useTheme.js'

const brandLinkLog = createLogger('streamer-brand-link')

const props = defineProps({
  ariaLabel: { type: String, required: true },
  logoSize: { type: Number, default: 32 },
  /** When false, only the channel mark is shown (link still goes to Twitch). */
  showNick: { type: Boolean, default: false },
})

const logoBoxStyle = () => ({
  width: `${props.logoSize}px`,
  height: `${props.logoSize}px`,
  maxWidth: `${props.logoSize}px`,
  maxHeight: `${props.logoSize}px`,
})

const { theme } = useTheme()

const primaryLogo = computed(() => (theme.value === 'dark' ? BRAND_LOGO_LIGHT_SVG : BRAND_LOGO_DARK_SVG))
const fallbackLogo = computed(() => (theme.value === 'dark' ? BRAND_LOGO_DARK_SVG : BRAND_LOGO_LIGHT_SVG))

const imgSrc = ref(primaryLogo.value)

watch(primaryLogo, (next) => {
  imgSrc.value = next
})

function onLogoError(ev: Event) {
  const el = ev.target
  const src = el instanceof HTMLImageElement ? el.currentSrc || el.src : ''
  brandLinkLog.warn('logo image failed to load:', src || '(unknown src)')
  if (imgSrc.value === primaryLogo.value) {
    imgSrc.value = fallbackLogo.value
    return
  }
  imgSrc.value = ''
}

function initialNick() {
  const s = String(STREAMER_NICK ?? 'N').trim()
  return (s[0] ?? 'N').toUpperCase()
}
</script>

<template>
  <a
    class="app-shell-mini-brand"
    :class="{ 'app-shell-mini-brand--icon-only': !props.showNick }"
    :href="STREAMER_TWITCH_URL"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="ariaLabel"
  >
    <span v-if="imgSrc" class="app-shell-mini-brand__picture">
      <img
        class="app-shell-mini-brand__logo"
        :src="imgSrc"
        :width="props.logoSize"
        :height="props.logoSize"
        :style="logoBoxStyle()"
        alt=""
        decoding="async"
        fetchpriority="low"
        @error="onLogoError"
      />
    </span>
    <span
      v-else
      class="app-shell-mini-brand__fallback"
      :style="logoBoxStyle()"
      aria-hidden="true"
    >{{ initialNick() }}</span>
    <span v-if="props.showNick" class="app-shell-mini-brand__nick">{{ STREAMER_NICK }}</span>
  </a>
</template>

<style scoped>
.app-shell-mini-brand__picture {
  display: inline-flex;
  flex-shrink: 0;
  line-height: 0;
}

.app-shell-mini-brand--icon-only {
  gap: 0;
}

.app-shell-mini-brand--icon-only .app-shell-mini-brand__logo {
  border-radius: 0;
}

.app-shell-mini-brand--icon-only .app-shell-mini-brand__fallback {
  border-radius: 10px;
}

.app-shell-mini-brand__fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle, var(--sa-color-border));
  background: transparent;
  font-family: var(--font-display, var(--sa-font-display));
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-heading, var(--sa-color-text-main));
  flex-shrink: 0;
}
</style>
