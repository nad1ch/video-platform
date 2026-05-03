
export function eatFirstThemeFromStorageValue(s) {
  if (s === 'light' || s === 'dark') return s
  return 'dark'
}
