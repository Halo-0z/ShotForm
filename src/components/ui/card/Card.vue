<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div :class="cn(
    'rounded-xl border bg-card/65 backdrop-blur-xl text-card-foreground shadow-glass-sm transition-all duration-200 hover:shadow-glass-md',
    props.class,
  )
    ">
    <slot />
  </div>
</template>
