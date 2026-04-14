<script setup lang="ts">
import { ref } from 'vue'
import {
  BRAND_LOGO_COMPACT_PNG,
  BRAND_LOGO_PNG,
  BRAND_LOGO_SVG_FALLBACK,
  BRAND_LOGO_WEBP,
  STREAMER_NICK,
  STREAMER_TWITCH_URL,
} from '../../constants/brand.js'

defineProps({
  ariaLabel: { type: String, required: true },
  logoSize: { type: Number, default: 32 },
})

/**
 * Try WebP (if present) → PNG → SVG → letter fallback. Logs load failures for debugging.
 */
const imgSrc = ref(BRAND_LOGO_PNG)

function onLogoError(ev: Event) {
  const el = ev.target
  const src = el instanceof HTMLImageElement ? el.currentSrc || el.src : ''
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[StreamerBrandLink] logo image failed to load:', src || '(unknown src)')
  }
  if (imgSrc.value === BRAND_LOGO_PNG) {
    imgSrc.value = BRAND_LOGO_COMPACT_PNG
    return
  }
  if (imgSrc.value === BRAND_LOGO_COMPACT_PNG) {
    imgSrc.value = BRAND_LOGO_SVG_FALLBACK
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
    :href="STREAMER_TWITCH_URL"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="ariaLabel"
  >
    <picture v-if="imgSrc" class="app-shell-mini-brand__picture">
      <source v-if="BRAND_LOGO_WEBP" :srcset="BRAND_LOGO_WEBP" type="image/webp" />
      <img
        class="app-shell-mini-brand__logo"
        :src="imgSrc"
        :width="logoSize"
        :height="logoSize"
        alt=""
        decoding="async"
        fetchpriority="low"
        @error="onLogoError"
      />
    </picture>
    <span v-else class="app-shell-mini-brand__fallback" aria-hidden="true">{{ initialNick() }}</span>
    <span class="app-shell-mini-brand__nick">{{ STREAMER_NICK }}</span>
  </a>
</template>

<style scoped>
.app-shell-mini-brand__picture {
  display: inline-flex;
  flex-shrink: 0;
  line-height: 0;
}

.app-shell-mini-brand__fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle, var(--sa-color-border));
  background: var(--logo-pad-bg, color-mix(in srgb, var(--sa-color-primary) 28%, var(--sa-color-bg-deep)));
  font-family: var(--font-display, var(--sa-font-display));
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-heading, var(--sa-color-text-main));
  flex-shrink: 0;
}
</style>
