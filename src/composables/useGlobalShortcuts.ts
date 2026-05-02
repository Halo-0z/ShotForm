import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { navigateWithFogTransition } from '@/composables/useFogRouteTransition'

interface ShortcutBinding {
  key: string
  ctrl?: boolean
  description: string
  action: () => void
}

export function useGlobalShortcuts() {
  const router = useRouter()

  const bindings: ShortcutBinding[] = [
    {
      key: 'u',
      ctrl: true,
      description: '跳转上传页',
      action: () => {
        if (router.currentRoute.value.path !== '/upload') {
          void navigateWithFogTransition(router, '/upload')
        }
      },
    },
    {
      key: 'h',
      ctrl: true,
      description: '打开历史记录',
      action: () => {
        if (router.currentRoute.value.path !== '/history') {
          void navigateWithFogTransition(router, '/history')
        }
      },
    },
    {
      key: 'a',
      ctrl: true,
      description: '跳转分析页',
      action: () => {
        if (router.currentRoute.value.path !== '/analysis') {
          router.push('/analysis')
        }
      },
    },
    {
      key: 'c',
      ctrl: true,
      description: '打开球星对比',
      action: () => {
        if (router.currentRoute.value.path !== '/compare') {
          router.push('/compare')
        }
      },
    },
    {
      key: 't',
      ctrl: true,
      description: '管理模板',
      action: () => {
        if (router.currentRoute.value.path !== '/templates') {
          router.push('/templates')
        }
      },
    },
  ]

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    for (const binding of bindings) {
      const ctrlMatch = binding.ctrl ? (event.ctrlKey || event.metaKey) : true
      if (event.key.toLowerCase() === binding.key && ctrlMatch) {
        event.preventDefault()
        binding.action()
        return
      }
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })
}
