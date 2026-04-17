import { ref } from 'vue'
import { eatFirstThemeFromStorageValue } from '@/eat-first/state/eatFirstThemePreference.js'

function readStoredTheme() {
  if (typeof localStorage === 'undefined') return 'dark'
  return eatFirstThemeFromStorageValue(localStorage.getItem('eat-first:theme'))
}

const theme = ref(readStoredTheme())

function setTheme(t) {
  const next = t === 'light' ? 'light' : 'dark'
  theme.value = next
  if (typeof document !== 'undefined') {
    document.querySelectorAll('.eat-first-root').forEach((el) => {
      el.setAttribute('data-theme', next)
    })
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('eat-first:theme', next)
  }
}

function toggleTheme() {
  setTheme(theme.value === 'dark' ? 'light' : 'dark')
}

export function useTheme() {
  return { theme, toggleTheme, setTheme }
}
