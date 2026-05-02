<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-vue-next'

export interface ToastMessage {
  id: number
  type: 'success' | 'error' | 'info'
  title: string
  description?: string
}

defineProps<{
  messages: ToastMessage[]
}>()

const emit = defineEmits<{
  remove: [id: number]
}>()

const iconByType = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const

const barClassByType = {
  success: 'toast-variant-success',
  error: 'toast-variant-error',
  info: 'toast-variant-info',
} as const
</script>

<template>
  <div class="toast-region" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="toast-bar"
        :class="barClassByType[msg.type]"
      >
        <div class="toast-bar__icon">
          <component :is="iconByType[msg.type]" class="h-4 w-4" />
        </div>
        <div class="toast-bar__copy">
          <p class="toast-bar__title">{{ msg.title }}</p>
          <p v-if="msg.description" class="toast-bar__desc">{{ msg.description }}</p>
        </div>
        <button
          class="toast-bar__dismiss"
          type="button"
          aria-label="关闭通知"
          @click="emit('remove', msg.id)"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-region {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 200;
  display: grid;
  gap: 10px;
  max-width: 420px;
  pointer-events: none;
}

.toast-bar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: start;
  gap: 12px;
  padding: 14px 18px;
  border-radius: 18px;
  border: 1px solid var(--surface-border);
  background: var(--card-bg);
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(20px);
  pointer-events: auto;
}

.toast-variant-success {
  border-color: color-mix(in srgb, var(--accent-color) 34%, var(--surface-border));
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 10%, var(--card-bg)), var(--card-bg));
}

.toast-variant-error {
  border-color: color-mix(in srgb, var(--color-danger) 30%, var(--surface-border));
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-danger) 10%, var(--card-bg)), var(--card-bg));
}

.toast-variant-info {
  border-color: color-mix(in srgb, var(--primary-color) 22%, var(--surface-border));
  background: linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 8%, var(--card-bg)), var(--card-bg));
}

.toast-bar__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 10px;
  background: var(--glass-xs);
  flex-shrink: 0;
}

.toast-variant-success .toast-bar__icon {
  color: var(--accent-color);
}

.toast-variant-error .toast-bar__icon {
  color: var(--color-danger);
}

.toast-variant-info .toast-bar__icon {
  color: var(--primary-color);
}

.toast-bar__copy {
  display: grid;
  gap: 4px;
  padding-top: 3px;
}

.toast-bar__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
}

.toast-bar__desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.toast-bar__dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.toast-bar__dismiss:hover {
  background: var(--glass-xs);
  color: var(--text-primary);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translate3d(24px, 10px, 0) scale(0.96);
}

.toast-leave-to {
  opacity: 0;
  transform: translate3d(16px, -6px, 0) scale(0.94);
}
</style>
