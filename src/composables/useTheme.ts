import { ref, watch, onMounted } from 'vue'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme-preference'

const theme = ref<Theme>('system')

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

function applyTheme(newTheme: Theme) {
  const root = document.documentElement

  if (newTheme === 'system') {
    const systemTheme = getSystemTheme()
    root.classList.toggle('dark', systemTheme === 'dark')
    root.removeAttribute('data-theme')
  } else {
    root.classList.toggle('dark', newTheme === 'dark')
    root.setAttribute('data-theme', newTheme)
  }
}

function setTheme(newTheme: Theme) {
  theme.value = newTheme
  applyTheme(newTheme)

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, newTheme)
  }
}

function initTheme() {
  if (typeof window === 'undefined') return

  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored && ['light', 'dark', 'system'].includes(stored)) {
    theme.value = stored
  }

  applyTheme(theme.value)

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    if (theme.value === 'system') {
      applyTheme('system')
    }
  })
}

function cycleTheme() {
  const themes: Theme[] = ['light', 'dark', 'system']
  const currentIndex = themes.indexOf(theme.value)
  const nextIndex = (currentIndex + 1) % themes.length
  setTheme(themes[nextIndex])
}

export function useTheme() {
  onMounted(() => {
    initTheme()
  })

  watch(theme, (newTheme) => {
    applyTheme(newTheme)
  })

  return {
    theme,
    setTheme,
    cycleTheme,
    initTheme
  }
}
