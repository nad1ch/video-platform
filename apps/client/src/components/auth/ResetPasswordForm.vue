<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuth } from '@/composables/useAuth'
import { replaceAuthQuery } from '@/utils/authRouteQuery'

const route = useRoute()
const router = useRouter()
const { confirmPasswordReset } = useAuth()

const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const feedback = ref<'validation' | 'mismatch' | 'invalid_or_expired' | 'server' | null>(null)
const token = computed(() => {
  const raw = route.query.token
  return typeof raw === 'string' ? raw : ''
})

async function onSubmit(e: Event): Promise<void> {
  e.preventDefault()
  feedback.value = null
  if (password.value.length < 6 || token.value.length === 0) {
    feedback.value = 'validation'
    return
  }
  if (password.value !== confirmPassword.value) {
    feedback.value = 'mismatch'
    return
  }
  submitting.value = true
  try {
    const result = await confirmPasswordReset(token.value, password.value)
    if (result.ok) {
      await router.replace({ path: '/auth', query: replaceAuthQuery(route, 'reset-success') })
      return
    }
    feedback.value = result.error
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="auth-page-stack" @submit="onSubmit">
    <label class="auth-page-label">
      <span class="auth-page-label-text">New password</span>
      <input
        v-model="password"
        class="auth-page-input"
        type="password"
        name="new-password"
        minlength="6"
        autocomplete="new-password"
        :disabled="submitting"
        required
      />
    </label>
    <label class="auth-page-label">
      <span class="auth-page-label-text">Confirm password</span>
      <input
        v-model="confirmPassword"
        class="auth-page-input"
        type="password"
        name="confirm-password"
        minlength="6"
        autocomplete="new-password"
        :disabled="submitting"
        required
      />
    </label>
    <AppButton variant="ghost" type="submit" class="auth-page-submit" :disabled="submitting">
      {{ submitting ? '...' : 'Reset password' }}
    </AppButton>
    <p v-if="feedback === 'validation'" class="auth-page-feedback auth-page-feedback--err" role="alert">
      Check the reset link and use a password of at least 6 characters.
    </p>
    <p v-else-if="feedback === 'mismatch'" class="auth-page-feedback auth-page-feedback--err" role="alert">
      Passwords do not match.
    </p>
    <p v-else-if="feedback === 'invalid_or_expired'" class="auth-page-feedback auth-page-feedback--err" role="alert">
      This reset link is invalid or expired.
    </p>
    <p v-else-if="feedback === 'server'" class="auth-page-feedback auth-page-feedback--err" role="alert">
      Could not reset password right now. Try again later.
    </p>
  </form>
</template>
