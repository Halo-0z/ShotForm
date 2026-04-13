import { computed, onMounted, onUnmounted, ref } from 'vue'

export function useResolvedThemeState() {
  const isDarkTheme = ref(false)
  let observer: MutationObserver | null = null

  const syncTheme = () => {
    if (typeof document === 'undefined') {
      isDarkTheme.value = false
      return
    }

    isDarkTheme.value = document.documentElement.classList.contains('dark')
  }

  onMounted(() => {
    syncTheme()

    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      return
    }

    observer = new MutationObserver(() => {
      syncTheme()
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    })
  })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
  })

  return {
    isDarkTheme,
    isLightTheme: computed(() => !isDarkTheme.value),
    syncTheme
  }
}
