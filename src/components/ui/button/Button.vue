<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { ButtonVariants } from "."
import { computed } from "vue"
import { Loader2 } from "lucide-vue-next"
import { Primitive } from "reka-ui"
import { cn } from "@/lib/utils"
import { buttonVariants } from "."
import CourtButtonSkin from "@/components/basketball/CourtButtonSkin.vue"

interface Props extends PrimitiveProps {
    variant?: ButtonVariants["variant"]
    size?: ButtonVariants["size"]
    class?: HTMLAttributes["class"]
    loading?: boolean
    disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    as: "button",
    loading: false,
    disabled: false,
})

const isDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
    <Primitive
        :as="as"
        :as-child="asChild"
        :disabled="isDisabled || undefined"
        :data-variant="variant || 'default'"
        :data-size="size || 'default'"
        :aria-busy="loading || undefined"
        :class="cn(buttonVariants({ variant, size }), props.class)"
    >
        <slot v-if="asChild" />
        <template v-else>
            <CourtButtonSkin />
            <span class="court-button-content">
                <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
                <slot />
            </span>
        </template>
    </Primitive>
</template>
