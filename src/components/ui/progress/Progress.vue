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
  default: 'bg-[var(--primary-color)]',
}
</script>

<template>
  <ProgressRoot v-bind="delegatedProps" :class="cn(
    'relative h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text-muted)_16%,var(--bg-solid))] border border-[color-mix(in_srgb,var(--border-color)_72%,transparent)] shadow-[inset_0_1px_2px_rgba(20,25,34,0.12)]',
    props.class,
  )
    ">
    <ProgressIndicator
      :class="cn('h-full w-full flex-1 rounded-full transition-transform duration-300 ease-out', qualityClasses[props.quality])"
      :style="`transform: translateX(-${100 - (props.modelValue ?? 0)}%);`" />
  </ProgressRoot>
</template>
