<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuth } from '@/composables/useAuth'
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath'
import { replaceAuthQuery } from '@/utils/authRouteQuery'

const props = defineProps<{
  redirectPath: string
}>()

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { loginOrRegisterWithEmail, refresh } = useAuth()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const feedback = ref<'err_val' | 'err_pw' | 'err_srv' | null>(null)

async function onSubmit(e: Event): Promise<void> {
  e.preventDefault()
  feedback.value = null
  if (password.value.length < 6) {
    feedback.value = 'err_val'
    return
  }
  submitting.value = true
  try {
    const r = await loginOrRegisterWithEmail(email.value, password.value)
    if (r.ok) {
      await refresh({ force: true })
      const target = safeOAuthRedirectPath(props.redirectPath)
      await router.replace(target)
      return
    }
    if (r.error === 'wrong_password') {
      feedback.value = 'err_pw'
      return
    }
    if (r.error === 'validation') {
      feedback.value = 'err_val'
      return
    }
    feedback.value = 'err_srv'
  } finally {
    submitting.value = false
  }
}

function goForgot(): void {
  router.replace({ path: '/auth', query: replaceAuthQuery(route, 'forgot') })
}
</script>

<template>
  <form class="auth-page-stack" @submit="onSubmit">
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
      />
    </label>
    <div class="auth-page-field-group">
      <div class="auth-page-label">
        <label class="auth-page-label-text" for="auth-login-password">{{ t('app.authPasswordLabel') }}</label>
        <div class="auth-page-password-control">
          <input
            id="auth-login-password"
            v-model="password"
            class="auth-page-input auth-page-input--with-action"
            :type="showPassword ? 'text' : 'password'"
            name="password"
            minlength="6"
            autocomplete="current-password"
            :placeholder="t('app.authPasswordPlaceholder')"
            :disabled="submitting"
          />
          <button
            type="button"
            class="auth-page-password-toggle"
            :aria-label="showPassword ? t('app.authPasswordHide') : t('app.authPasswordShow')"
            :title="showPassword ? t('app.authPasswordHide') : t('app.authPasswordShow')"
            :aria-pressed="showPassword"
            :disabled="submitting"
            @click="showPassword = !showPassword"
          >
            <svg
              v-if="showPassword"
              class="auth-page-password-toggle__icon"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.7"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M3 3l18 18" />
              <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
              <path d="M9.88 4.24A9.83 9.83 0 0 1 12 4c5 0 8.5 4.5 9.5 8a11.86 11.86 0 0 1-2.2 3.7" />
              <path d="M6.6 6.6A11.86 11.86 0 0 0 2.5 12c1 3.5 4.5 8 9.5 8a9.83 9.83 0 0 0 4.3-.99" />
            </svg>
            <svg
              v-else
              class="auth-page-password-toggle__icon"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.7"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M2.5 12c1-3.5 4.5-8 9.5-8s8.5 4.5 9.5 8c-1 3.5-4.5 8-9.5 8s-8.5-4.5-9.5-8Z" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
          </button>
        </div>
      </div>
      <div class="auth-page-forgot-row">
        <button type="button" class="auth-page-link" @click="goForgot">
          {{ t('app.authForgotPasswordLink') }}
        </button>
      </div>
    </div>
    <AppButton variant="ghost" type="submit" class="auth-page-submit" :disabled="submitting">
      {{ submitting ? '…' : t('app.authLoginSubmit') }}
    </AppButton>

    <p v-if="feedback === 'err_val'" class="auth-page-feedback auth-page-feedback--err" role="alert">
      {{ t('app.authEmailErrorValidation') }}
    </p>
    <p v-else-if="feedback === 'err_pw'" class="auth-page-feedback auth-page-feedback--err" role="alert">
      {{ t('app.authEmailWrongPassword') }}
    </p>
    <p v-else-if="feedback === 'err_srv'" class="auth-page-feedback auth-page-feedback--err" role="alert">
      {{ t('app.authEmailServerError') }}
    </p>
  </form>
</template>
