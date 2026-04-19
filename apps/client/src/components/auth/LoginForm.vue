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
      <label class="auth-page-label">
        <span class="auth-page-label-text">{{ t('app.authPasswordLabel') }}</span>
        <input
          v-model="password"
          class="auth-page-input"
          type="password"
          name="password"
          minlength="6"
          autocomplete="current-password"
          :placeholder="t('app.authPasswordPlaceholder')"
          :disabled="submitting"
        />
      </label>
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
