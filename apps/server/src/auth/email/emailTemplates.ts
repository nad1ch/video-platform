export type EmailLocale = 'en' | 'uk'

type EmailLocaleInput =
  | string
  | null
  | undefined
  | {
      locale?: unknown
      acceptLanguage?: unknown
    }

type VerifyEmailTemplateInput = {
  locale?: EmailLocale
  name: string
  verificationUrl: string
  expiresInMinutes: number
}

type PasswordResetEmailTemplateInput = {
  locale?: EmailLocale
  name: string
  resetUrl: string
  expiresInMinutes: number
}

type RenderedAuthEmail = {
  subject: string
  text: string
  html: string
}

const VERIFY_EMAIL_COPY: Record<
  EmailLocale,
  {
    subject: string
    title: string
    body: (name: string) => string
    button: string
    expiry: (minutes: number) => string
    footer: string
    fallbackIntro: string
  }
> = {
  en: {
    subject: 'Verify your StreamAssist email',
    title: 'Verify your email',
    body: (name) =>
      `Hi ${name}, confirm your email address to secure your StreamAssist account and continue using the platform.`,
    button: 'Verify email',
    expiry: (minutes) => `This link expires in ${minutes} minutes.`,
    footer: "If you didn\u2019t request this email, you can safely ignore it.",
    fallbackIntro: 'If the button does not work, copy and paste this link into your browser:',
  },
  uk: {
    subject: 'Підтвердіть email для StreamAssist',
    title: 'Підтвердіть email',
    body: (name) =>
      `Привіт, ${name}! Підтвердіть свою email-адресу, щоб захистити акаунт StreamAssist і продовжити користування платформою.`,
    button: 'Підтвердити email',
    expiry: () => 'Посилання діє 30 хвилин.',
    footer: 'Якщо ви не створювали акаунт StreamAssist, просто проігноруйте цей лист.',
    fallbackIntro: 'Якщо кнопка не працює, скопіюйте це посилання в браузер:',
  },
}

const PASSWORD_RESET_EMAIL_COPY: Record<
  EmailLocale,
  {
    subject: string
    title: string
    body: (name: string) => string
    button: string
    expiry: (minutes: number) => string
    footer: string
    fallbackIntro: string
  }
> = {
  en: {
    subject: 'Reset your StreamAssist password',
    title: 'Reset your password',
    body: (name) =>
      `Hi ${name}, we received a request to reset your StreamAssist password. Use the button below to create a new password.`,
    button: 'Reset password',
    expiry: (minutes) => `This link expires in ${minutes} minutes.`,
    footer: 'If you did not request this, you can safely ignore this email.',
    fallbackIntro: 'If the button does not work, copy and paste this link into your browser:',
  },
  uk: {
    subject: 'Скиньте пароль StreamAssist',
    title: 'Скиньте пароль',
    body: (name) =>
      `Привіт, ${name}! Ми отримали запит на скидання пароля StreamAssist. Натисніть кнопку нижче, щоб створити новий пароль.`,
    button: 'Скинути пароль',
    expiry: () => 'Посилання діє 30 хвилин.',
    footer: 'Якщо ви не надсилали цей запит, просто проігноруйте цей лист.',
    fallbackIntro: 'Якщо кнопка не працює, скопіюйте це посилання в браузер:',
  },
}

export function resolveEmailLocale(input?: EmailLocaleInput): EmailLocale {
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    const hasLocale = typeof input.locale === 'string' && input.locale.trim().length > 0
    if (hasLocale) {
      return pickLocale(input.locale) ?? 'en'
    }
    return pickLocale(input.acceptLanguage) ?? 'en'
  }
  return pickLocale(input) ?? 'en'
}

export function renderVerifyEmailTemplate(input: VerifyEmailTemplateInput): RenderedAuthEmail {
  const locale = input.locale ?? 'en'
  const copy = VERIFY_EMAIL_COPY[locale]
  const safeName = input.name.trim() || 'StreamAssist user'
  const body = copy.body(safeName)
  const expiry = copy.expiry(input.expiresInMinutes)
  const text = [
    copy.title,
    '',
    body,
    '',
    `${copy.button}: ${input.verificationUrl}`,
    '',
    expiry,
    copy.footer,
  ].join('\n')

  return {
    subject: copy.subject,
    text,
    html: renderAuthEmailLayout({
      title: copy.title,
      body,
      buttonLabel: copy.button,
      actionUrl: input.verificationUrl,
      fallbackIntro: copy.fallbackIntro,
      expiry,
      footer: copy.footer,
      locale,
    }),
  }
}

export function renderPasswordResetEmailTemplate(input: PasswordResetEmailTemplateInput): RenderedAuthEmail {
  const locale = input.locale ?? 'en'
  const copy = PASSWORD_RESET_EMAIL_COPY[locale]
  const safeName = input.name.trim() || 'StreamAssist user'
  const body = copy.body(safeName)
  const expiry = copy.expiry(input.expiresInMinutes)
  const text = [
    copy.title,
    '',
    body,
    '',
    `${copy.button}: ${input.resetUrl}`,
    '',
    expiry,
    copy.footer,
  ].join('\n')

  return {
    subject: copy.subject,
    text,
    html: renderAuthEmailLayout({
      title: copy.title,
      body,
      buttonLabel: copy.button,
      actionUrl: input.resetUrl,
      fallbackIntro: copy.fallbackIntro,
      expiry,
      footer: copy.footer,
      locale,
    }),
  }
}

function pickLocale(raw: unknown): EmailLocale | null {
  if (typeof raw !== 'string') {
    return null
  }
  for (const part of raw.split(',')) {
    const normalized = part.split(';')[0]?.trim().toLowerCase().replace('_', '-') ?? ''
    const primary = normalized.split('-')[0]
    if (primary === 'uk') {
      return 'uk'
    }
    if (primary === 'en') {
      return 'en'
    }
  }
  return null
}

function renderAuthEmailLayout(input: {
  locale: EmailLocale
  title: string
  body: string
  buttonLabel: string
  actionUrl: string
  fallbackIntro: string
  expiry: string
  footer: string
}): string {
  const title = escapeHtml(input.title)
  const body = escapeHtml(input.body)
  const buttonLabel = escapeHtml(input.buttonLabel)
  const actionUrl = escapeHtml(input.actionUrl)
  const fallbackIntro = escapeHtml(input.fallbackIntro)
  const expiry = escapeHtml(input.expiry)
  const footer = escapeHtml(input.footer)

  return `<!doctype html>
<html lang="${input.locale}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>${title}</title>
  </head>
  <body style="margin:0; padding:0; background:#140b25; color:#f7f2ff; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#140b25; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:32px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:560px; border-collapse:separate; border-spacing:0;">
            <tr>
              <td style="padding:1px; border-radius:28px; background:linear-gradient(135deg, rgba(255,255,255,0.32), rgba(162,91,255,0.5), rgba(255,218,68,0.32)); box-shadow:0 22px 60px rgba(111,54,255,0.28);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-radius:27px; overflow:hidden; background:#211033;">
                  <tr>
                    <td style="padding:28px 24px 10px; text-align:center; background:radial-gradient(circle at top left, rgba(147,80,255,0.32), transparent 42%), radial-gradient(circle at top right, rgba(255,218,68,0.15), transparent 34%), #211033;">
                      <div style="display:inline-block; padding:8px 14px; border:1px solid rgba(255,255,255,0.18); border-radius:999px; background:rgba(255,255,255,0.08); color:#ffffff; font-size:13px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase;">
                        StreamAssist
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 28px 8px; text-align:center; background:#211033;">
                      <h1 style="margin:0; color:#ffffff; font-size:30px; line-height:1.16; font-weight:800;">${title}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 28px 0; text-align:center; background:#211033;">
                      <p style="margin:0; color:#d8cff0; font-size:16px; line-height:1.58;">${body}</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:26px 28px 18px; background:#211033;">
                      <a href="${actionUrl}" style="display:inline-block; min-width:180px; padding:14px 22px; border-radius:999px; background:#ffd84a; color:#25133c; font-size:16px; line-height:1.2; font-weight:800; text-decoration:none; box-shadow:0 12px 28px rgba(255,216,74,0.24);">${buttonLabel}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 28px 22px; text-align:center; background:#211033;">
                      <p style="margin:0; color:#b8abd5; font-size:13px; line-height:1.55;">${expiry}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 22px; background:#180c28; border-top:1px solid rgba(255,255,255,0.1);">
                      <p style="margin:0 0 8px; color:#b8abd5; font-size:12px; line-height:1.5;">${fallbackIntro}</p>
                      <p style="margin:0; color:#eee7ff; font-size:12px; line-height:1.5; word-break:break-all;"><a href="${actionUrl}" style="color:#ffd84a; text-decoration:underline;">${actionUrl}</a></p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 18px 0; text-align:center;">
                <p style="margin:0; color:#9d8fbd; font-size:12px; line-height:1.5;">${footer}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
