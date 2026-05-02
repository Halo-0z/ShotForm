import { ref } from 'vue'
import type { ToastMessage } from '@/components/ui/toast/Toast.vue'

let toastId = 0

const messages = ref<ToastMessage[]>([])

const AUTO_DISMISS_MS = 4200

const removeToast = (id: number) => {
  messages.value = messages.value.filter(m => m.id !== id)
}

const pushToast = (
  type: ToastMessage['type'],
  title: string,
  description?: string,
) => {
  const id = ++toastId
  messages.value = [...messages.value, { id, type, title, description }]

  setTimeout(() => {
    removeToast(id)
  }, AUTO_DISMISS_MS)

  return id
}

export function useToast() {
  const success = (title: string, description?: string) =>
    pushToast('success', title, description)

  const error = (title: string, description?: string) =>
    pushToast('error', title, description)

  const info = (title: string, description?: string) =>
    pushToast('info', title, description)

  const dismiss = (id: number) => removeToast(id)

  return {
    messages,
    success,
    error,
    info,
    dismiss,
  }
}
