<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuth } from '@/composables/useAuth'
import { replaceAuthQuery } from '@/utils/authRouteQuery'

const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const { sendPasswordReset } = useAuth()

const email = ref('')
const submitting = ref(false)
const feedback = ref<'validation' | 'server' | null>(null)

async function onSubmit(e: Event): Promise<void> {
  e.preventDefault()
  feedback.value = null
  submitting.value = true
  try {
    const result = await sendPasswordReset(email.value, locale.value)
    if (result.ok) {
      void router.replace({ path: '/auth', query: replaceAuthQuery(route, 'forgot-success') })
      return
    }
    feedback.value = result.error
  } finally {
    submitting.value = false
  }
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
        :disabled="submitting"
        required
      />
    </label>
    <AppButton variant="ghost" type="submit" class="auth-page-submit" :disabled="submitting">
      {{ submitting ? '...' : t('app.authForgotSubmit') }}
    </AppButton>
    <p v-if="feedback === 'validation'" class="auth-page-feedback auth-page-feedback--err" role="alert">
      {{ t('app.authEmailErrorValidation') }}
    </p>
    <p v-else-if="feedback === 'server'" class="auth-page-feedback auth-page-feedback--err" role="alert">
      {{ t('app.authEmailServerError') }}
    </p>
    <button type="button" class="auth-page-link auth-page-link--block" @click="backToLogin">
      {{ t('app.authBackToSignIn') }}
    </button>
  </form>
</template>
