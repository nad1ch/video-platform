import nodemailer from 'nodemailer'
import { renderPasswordResetEmailTemplate, renderVerifyEmailTemplate, type EmailLocale } from './emailTemplates'

type SendAuthEmailInput = {
  to: string
  subject: string
  text: string
  html: string
}

function env(name: string): string {
  const value = process.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

function smtpConfigured(): boolean {
  return env('SMTP_HOST').length > 0 && env('SMTP_PORT').length > 0
}

function smtpSecure(): boolean {
  const raw = env('SMTP_SECURE').toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function emailFrom(): string {
  const from = env('EMAIL_FROM')
  if (from.length > 0) {
    return from
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('EMAIL_FROM must be set in production.')
  }
  return 'StreamAssist <no-reply@localhost>'
}

async function sendAuthEmail(input: SendAuthEmailInput): Promise<void> {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP_HOST and SMTP_PORT must be set in production to send auth email.')
    }
    console.info('[auth][email] SMTP not configured; auth email was not sent.')
    return
  }

  const user = env('SMTP_USER')
  const pass = env('SMTP_PASS')
  const transporter = nodemailer.createTransport({
    host: env('SMTP_HOST'),
    port: Number(env('SMTP_PORT')),
    secure: smtpSecure(),
    ...(user.length > 0 || pass.length > 0 ? { auth: { user, pass } } : {}),
  })

  await transporter.sendMail({
    from: emailFrom(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
}

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
  await sendAuthEmail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  })
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
  await sendAuthEmail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  })
}
