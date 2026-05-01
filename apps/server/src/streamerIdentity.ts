export function normalizeTwitchLogin(raw: string): string | null {
  const login = raw.trim().replace(/^#/, '').toLowerCase()
  if (login.length < 2 || login.length > 25) {
    return null
  }
  if (!/^[a-z0-9_]+$/.test(login)) {
    return null
  }
  return login
}
