<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import { replaceAuthQuery } from '@/utils/authRouteQuery'

/** UI-only branch: no password-reset API yet (same as previous modal flow). */

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const email = ref('')

function onSubmit(e: Event): void {
  e.preventDefault()
  void router.replace({ path: '/auth', query: replaceAuthQuery(route, 'forgot-success') })
}

function backToLogin(): void {
  void router.replace({ path: '/auth', query: replaceAuthQuery(route, 'login') })
}
</script>

<template>
  <form class="auth-page-stack" @submit="onSubmit">
    <p class="auth-page-lead">{{ t('app.authForgotLead') }}</p>
    <label class="auth-page-label">
      <span class="auth-page-label-text">{{ t('app.authEmailLabel') }}</span>
      <input
        v-model="email"
        class="auth-page-input"
        type="email"
        name="email"
        autocomplete="email"
        :placeholder="t('app.authEmailPlaceholder')"
        required
      />
    </label>
    <AppButton variant="ghost" type="submit" class="auth-page-submit">
      {{ t('app.authForgotSubmit') }}
    </AppButton>
    <button type="button" class="auth-page-link auth-page-link--block" @click="backToLogin">
      {{ t('app.authBackToSignIn') }}
    </button>
  </form>
</template>
