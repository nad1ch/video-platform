<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuth } from '@/composables/useAuth'
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath'

const props = defineProps<{
  redirectPath: string
}>()

const { t } = useI18n()
const router = useRouter()
const { registerWithEmail, refresh } = useAuth()

const email = ref('')
const password = ref('')
const submitting = ref(false)
const feedback = ref<'err_val' | 'email_taken' | 'err_srv' | null>(null)

async function onSubmit(e: Event): Promise<void> {
  e.preventDefault()
  feedback.value = null
  if (password.value.length < 6) {
    feedback.value = 'err_val'
    return
  }
  submitting.value = true
  try {
    const r = await registerWithEmail(email.value, password.value)
    if (r.ok) {
      await refresh({ force: true })
      const target = safeOAuthRedirectPath(props.redirectPath)
      await router.replace(target)
      return
    }
    if (r.error === 'email_taken') {
      feedback.value = 'email_taken'
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
    <label class="auth-page-label">
      <span class="auth-page-label-text">{{ t('app.authPasswordLabel') }}</span>
      <input
        v-model="password"
        class="auth-page-input"
        type="password"
        name="password"
        minlength="6"
        autocomplete="new-password"
        :placeholder="t('app.authPasswordPlaceholder')"
        :disabled="submitting"
      />
    </label>
    <AppButton variant="ghost" type="submit" class="auth-page-submit" :disabled="submitting">
      {{ submitting ? '…' : t('app.authSignupSubmit') }}
    </AppButton>

    <p v-if="feedback === 'err_val'" class="auth-page-feedback auth-page-feedback--err" role="alert">
      {{ t('app.authEmailErrorValidation') }}
    </p>
    <p v-else-if="feedback === 'email_taken'" class="auth-page-feedback auth-page-feedback--err" role="alert">
      {{ t('app.authSignupEmailTaken') }}
    </p>
    <p v-else-if="feedback === 'err_srv'" class="auth-page-feedback auth-page-feedback--err" role="alert">
      {{ t('app.authEmailServerError') }}
    </p>
  </form>
</template>
