<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const error = ref<Error | null>(null)

const handleRefresh = () => {
  window.location.reload()
}

onErrorCaptured((err: Error) => {
  error.value = err
  console.error('[ErrorBoundary]', err)
  return false
})
</script>

<template>
  <template v-if="error">
    <div class="error-boundary">
      <div class="error-boundary__card">
        <div class="error-boundary__icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/>
            <path d="M12 8v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            <circle cx="12" cy="16.5" r="1" fill="currentColor"/>
          </svg>
        </div>
        <div class="error-boundary__copy">
          <h1 class="error-boundary__title">页面发生了未知错误</h1>
          <p class="error-boundary__desc">
            当前页面渲染过程中遇到了问题。刷新通常能解决，如果反复出现请检查最新更新。
          </p>
          <p class="error-boundary__detail">{{ error.message }}</p>
        </div>
        <div class="error-boundary__actions">
          <Button @click="handleRefresh">
            <RefreshCw class="h-4 w-4" />
            刷新页面
          </Button>
        </div>
      </div>
    </div>
  </template>
  <template v-else>
    <slot />
  </template>
</template>

<style scoped>
.error-boundary {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  background:
    radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--color-danger) 8%, transparent), transparent 26%),
    linear-gradient(180deg, var(--bg-solid), var(--background));
}

.error-boundary__card {
  display: grid;
  gap: 20px;
  justify-items: start;
  max-width: 520px;
  padding: 28px 30px;
  border-radius: 24px;
  border: 1px solid var(--surface-border);
  background: var(--card-bg);
  box-shadow: var(--shadow-lg);
}

.error-boundary__icon {
  color: var(--color-danger);
}

.error-boundary__copy {
  display: grid;
  gap: 8px;
}

.error-boundary__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.error-boundary__desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.error-boundary__detail {
  margin: 8px 0 0;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--color-danger) 20%, var(--surface-border));
  background: color-mix(in srgb, var(--color-danger) 8%, var(--card-bg));
  font-family: monospace;
  font-size: 12px;
  color: var(--color-danger);
  word-break: break-all;
}

.error-boundary__actions {
  padding-top: 6px;
}
</style>
