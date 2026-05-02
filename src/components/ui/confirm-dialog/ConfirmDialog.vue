<script setup lang="ts">
import { AlertTriangle, Ban, Info } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface ConfirmDialogOptions {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  loading?: boolean
}

defineProps<ConfirmDialogOptions>()

const emit = defineEmits<{
  confirm: []
  cancel: []
  'update:open': [value: boolean]
}>()

const iconByVariant = {
  danger: Ban,
  warning: AlertTriangle,
  info: Info,
} as const

const iconClassByVariant = {
  danger: 'confirm-icon--danger',
  warning: 'confirm-icon--warning',
  info: 'confirm-icon--info',
} as const

const buttonVariantByVariant = {
  danger: 'destructive' as const,
  warning: 'default' as const,
  info: 'default' as const,
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="confirm-dialog max-w-[420px] gap-6 border-[var(--surface-border)] p-6 shadow-2xl backdrop-blur-xl sm:rounded-2xl">
      <div class="confirm-dialog__head">
        <div
          class="confirm-dialog__icon"
          :class="iconClassByVariant[variant ?? 'info']"
        >
          <component :is="iconByVariant[variant ?? 'info']" class="h-5 w-5" />
        </div>
        <DialogHeader class="gap-2">
          <DialogTitle>{{ title }}</DialogTitle>
          <DialogDescription v-if="description">
            {{ description }}
          </DialogDescription>
        </DialogHeader>
      </div>

      <DialogFooter class="confirm-dialog__actions">
        <Button
          variant="outline"
          :disabled="loading"
          @click="emit('cancel')"
        >
          {{ cancelLabel || '取消' }}
        </Button>
        <Button
          :variant="buttonVariantByVariant[variant ?? 'info']"
          :loading="loading"
          @click="emit('confirm')"
        >
          {{ confirmLabel || '确认' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.confirm-dialog__head {
  display: grid;
  gap: 16px;
  justify-items: start;
}

.confirm-dialog__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
}

.confirm-icon--danger {
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
  color: var(--color-danger);
}

.confirm-icon--warning {
  background: color-mix(in srgb, var(--color-warning, #d28b18) 14%, transparent);
  color: var(--color-warning, #d28b18);
}

.confirm-icon--info {
  background: color-mix(in srgb, var(--primary-color) 14%, transparent);
  color: var(--primary-color);
}

.confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
