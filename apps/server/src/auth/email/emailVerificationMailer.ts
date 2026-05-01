import nodemailer from 'nodemailer'

type SendAuthEmailInput = {
  to: string
  displayName: string
  actionUrl: string
  expiresInMinutes: number
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

async function sendAuthEmail(input: SendAuthEmailInput & { subject: string; textAction: string; htmlAction: string }): Promise<void> {
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

  const text = [
    `Hi ${input.displayName},`,
    '',
    input.textAction,
    input.actionUrl,
    '',
    `This link expires in ${input.expiresInMinutes} minutes.`,
    'If you did not request this email, you can ignore it.',
  ].join('\n')

  const html = `
    <p>Hi ${escapeHtml(input.displayName)},</p>
    <p>${escapeHtml(input.textAction)}</p>
    <p><a href="${escapeHtml(input.actionUrl)}">${escapeHtml(input.htmlAction)}</a></p>
    <p>This link expires in ${input.expiresInMinutes} minutes.</p>
    <p>If you did not request this email, you can ignore it.</p>
  `

  await transporter.sendMail({
    from: emailFrom(),
    to: input.to,
    subject: input.subject,
    text,
    html,
  })
}

export async function sendVerificationEmail(input: Omit<SendAuthEmailInput, 'actionUrl'> & { verificationUrl: string }): Promise<void> {
  await sendAuthEmail({
    to: input.to,
    displayName: input.displayName,
    actionUrl: input.verificationUrl,
    expiresInMinutes: input.expiresInMinutes,
    subject: 'Verify your StreamAssist email',
    textAction: 'Please verify your StreamAssist email address by opening this link:',
    htmlAction: 'Verify your email',
  })
}

export async function sendPasswordResetEmail(input: Omit<SendAuthEmailInput, 'actionUrl'> & { resetUrl: string }): Promise<void> {
  await sendAuthEmail({
    to: input.to,
    displayName: input.displayName,
    actionUrl: input.resetUrl,
    expiresInMinutes: input.expiresInMinutes,
    subject: 'Reset your StreamAssist password',
    textAction: 'Reset your StreamAssist password by opening this link:',
    htmlAction: 'Reset your password',
  })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
