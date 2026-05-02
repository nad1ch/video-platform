import { sendEmailIfConfigured } from '../../email/transport'
import { renderPasswordResetEmailTemplate, renderVerifyEmailTemplate, type EmailLocale } from './emailTemplates'

/**
 * Auth email senders. SMTP plumbing lives in `apps/server/src/email/transport.ts`
 * (shared with billing). This file now only owns the auth-specific templates
 * and the auth fail-closed policy: missing SMTP in production is a hard error
 * (so OAuth/email registration cannot succeed without a verifiable address).
 *
 * Public API (`sendVerificationEmail`, `sendPasswordResetEmail`) is unchanged.
 */

const DEV_LOG_TAG = '[auth][email]'

export async function sendVerificationEmail(input: {
  to: string
  displayName: string
  verificationUrl: string
  expiresInMinutes: number
  locale?: EmailLocale
}): Promise<void> {
  const template = renderVerifyEmailTemplate({
    locale: input.locale,
    name: input.displayName,
    verificationUrl: input.verificationUrl,
    expiresInMinutes: input.expiresInMinutes,
  })
  await sendEmailIfConfigured(
    {
      to: input.to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    },
    { throwInProduction: true, devLogTag: DEV_LOG_TAG },
  )
}

export async function sendPasswordResetEmail(input: {
  to: string
  displayName: string
  resetUrl: string
  expiresInMinutes: number
  locale?: EmailLocale
}): Promise<void> {
  const template = renderPasswordResetEmailTemplate({
    locale: input.locale,
    name: input.displayName,
    resetUrl: input.resetUrl,
    expiresInMinutes: input.expiresInMinutes,
  })
  await sendEmailIfConfigured(
    {
      to: input.to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    },
    { throwInProduction: true, devLogTag: DEV_LOG_TAG },
  )
}
