/** Parse stored theme key from localStorage (or null when missing). */
export function eatFirstThemeFromStorageValue(s) {
  if (s === 'light' || s === 'dark') return s
  return 'dark'
}
