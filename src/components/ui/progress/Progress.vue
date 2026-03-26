<script setup lang="ts">
import type { ProgressRootProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import {
  ProgressIndicator,
  ProgressRoot,
} from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(
  defineProps<ProgressRootProps & {
    class?: HTMLAttributes["class"]
    quality?: 'excellent' | 'good' | 'average' | 'poor' | 'default'
  }>(),
  {
    modelValue: 0,
    quality: 'default',
  },
)

const delegatedProps = reactiveOmit(props, "class", "quality")

const qualityClasses = {
  excellent: 'bg-[var(--quality-excellent)]',
  good: 'bg-[var(--quality-good)]',
  average: 'bg-[var(--quality-average)]',
  poor: 'bg-[var(--quality-poor)]',
  default: 'bg-gradient-to-r from-[var(--primary-color)] to-[var(--accent-color)]',
}
</script>

<template>
  <ProgressRoot v-bind="delegatedProps" :class="cn(
    'relative h-2 w-full overflow-hidden rounded-full bg-[var(--glass-xs)] border border-[var(--surface-border)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.08)]',
    props.class,
  )
    ">
    <ProgressIndicator
      :class="cn('h-full w-full flex-1 transition-all duration-300 rounded-full', qualityClasses[props.quality])"
      :style="`transform: translateX(-${100 - (props.modelValue ?? 0)}%);`" />
  </ProgressRoot>
</template>
