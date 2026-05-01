<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const auth = useAuth()
const { locale } = useI18n()
const sending = ref(false)
const sent = ref(false)
const error = ref('')

const email = computed(() => auth.user.value?.email ?? '')
const hasEmail = computed(() => email.value.length > 0)
const verificationFailed = computed(() => firstQueryValue(route.query.emailVerification) === 'failed')
const verificationSucceeded = computed(() => firstQueryValue(route.query.emailVerified) === '1')

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : ''
  }
  return typeof value === 'string' ? value : ''
}

async function sendEmailVerification(): Promise<void> {
  sending.value = true
  sent.value = false
  error.value = ''
  try {
    const result = await auth.sendEmailVerification(locale.value)
    if (result.ok) {
      sent.value = true
      return
    }
    error.value =
      result.error === 'email_unavailable' && !hasEmail.value
        ? 'This account does not have an email address to verify.'
        : 'Could not send verification email right now.'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section class="verify-email-page">
    <div class="verify-email-card">
      <p v-if="verificationSucceeded" class="verify-email-card__status verify-email-card__status--success">
        Your email has been verified.
      </p>
      <p v-else-if="verificationFailed" class="verify-email-card__status verify-email-card__status--error">
        The verification link is invalid or expired. You can send a new email below.
      </p>

      <h1>Verify your email</h1>
      <p v-if="hasEmail" class="verify-email-card__lead">
        Check {{ email }} to finish securing your StreamAssist account.
      </p>
      <p v-else class="verify-email-card__lead">
        This account does not have an email address to verify.
      </p>

      <AppButton
        v-if="hasEmail"
        class="verify-email-card__button"
        variant="primary"
        type="button"
        :disabled="sending"
        @click="sendEmailVerification"
      >
        {{ sending ? 'Sending...' : 'Send verification email' }}
      </AppButton>

      <p v-if="sent" class="verify-email-card__status verify-email-card__status--success" role="status">
        Verification email sent. Check your inbox.
      </p>
      <p v-if="error" class="verify-email-card__status verify-email-card__status--error" role="alert">
        {{ error }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.verify-email-page {
  box-sizing: border-box;
  display: grid;
  place-items: center;
  min-height: 100%;
  padding: 2rem 1rem;
}

.verify-email-card {
  box-sizing: border-box;
  width: min(520px, 100%);
  padding: 1.4rem;
  border: 1px solid var(--border-subtle, #334155);
  border-radius: 18px;
  background: var(--bg-card-soft, rgb(15 23 42 / 0.86));
  color: var(--text-primary, #f8fafc);
  text-align: center;
}

.verify-email-card h1 {
  margin: 0;
  font-size: clamp(1.6rem, 5vw, 2.2rem);
}

.verify-email-card__lead {
  margin: 0.75rem 0 1.2rem;
  color: var(--text-secondary, #cbd5e1);
  line-height: 1.5;
}

.verify-email-card__button {
  margin-inline: auto;
}

.verify-email-card__status {
  margin: 0 0 0.8rem;
  line-height: 1.4;
}

.verify-email-card__button + .verify-email-card__status,
.verify-email-card__status:last-child {
  margin: 0.9rem 0 0;
}

.verify-email-card__status--success {
  color: #bbf7d0;
}

.verify-email-card__status--error {
  color: #fecaca;
}
</style>
