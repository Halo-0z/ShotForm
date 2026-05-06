<script setup lang="ts">
import { computed } from "vue"
import { useFogRouteTransition } from "@/composables/useFogRouteTransition"

const { phase, isActive, prefersReducedMotion } = useFogRouteTransition()

const phaseClass = computed(() => `phase-${phase.value}`)
</script>

<template>
    <div
        class="fog-route-transition"
        :class="[phaseClass, { active: isActive, 'reduced-motion': prefersReducedMotion }]"
        aria-hidden="true"
    >
        <div class="fog-route-transition__veil" />
        <div class="fog-route-transition__mist fog-route-transition__mist--left" />
        <div class="fog-route-transition__mist fog-route-transition__mist--right" />
    </div>
</template>

<style scoped>
.fog-route-transition {
    position: absolute;
    inset: 0;
    z-index: 80;
    pointer-events: none;
    opacity: 0;
    transition: opacity 180ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: opacity, transform;
    contain: layout paint style;
    transform: translate3d(0, 0, 0);
}

.fog-route-transition.active {
    opacity: 1;
}

.fog-route-transition.reduced-motion {
    transition-duration: 120ms;
}

.fog-route-transition__veil,
.fog-route-transition__mist {
    position: absolute;
    inset: 0;
    will-change: opacity, transform;
}

.fog-route-transition__veil {
    background:
        radial-gradient(circle at center, rgba(66, 86, 164, 0.18), transparent 38%),
        radial-gradient(circle at 50% 38%, rgba(206, 219, 255, 0.08), transparent 20%),
        linear-gradient(180deg, rgba(7, 10, 18, 0.14), rgba(7, 10, 18, 0.7));
    opacity: 0.76;
    transform: translate3d(0, 0, 0) scale(1.015);
    transition:
        opacity 180ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.fog-route-transition__mist {
    opacity: 0.56;
    transition:
        opacity 220ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.fog-route-transition__mist--left {
    background:
        radial-gradient(circle at 20% 78%, rgba(201, 217, 255, 0.22), transparent 20%),
        radial-gradient(circle at 28% 68%, rgba(122, 142, 244, 0.14), transparent 24%);
    transform: translate3d(-12%, 18%, 0) scale(1.04);
}

.fog-route-transition__mist--right {
    background:
        radial-gradient(circle at 84% 20%, rgba(118, 138, 247, 0.2), transparent 22%),
        radial-gradient(circle at 76% 30%, rgba(226, 188, 120, 0.12), transparent 18%);
    transform: translate3d(12%, -12%, 0) scale(1.03);
}

.fog-route-transition.phase-defocus .fog-route-transition__veil {
    opacity: 0.74;
    transform: translate3d(0, 0, 0) scale(1.01);
}

.fog-route-transition.phase-defocus .fog-route-transition__mist--left {
    opacity: 0.48;
    transform: translate3d(-8%, 13%, 0) scale(1.02);
}

.fog-route-transition.phase-defocus .fog-route-transition__mist--right {
    opacity: 0.42;
    transform: translate3d(8%, -8%, 0) scale(1.01);
}

.fog-route-transition.phase-veil .fog-route-transition__veil {
    opacity: 0.94;
    transform: translate3d(0, 0, 0) scale(1.03);
}

.fog-route-transition.phase-veil .fog-route-transition__mist--left {
    opacity: 0.78;
    transform: translate3d(-2%, 8%, 0) scale(1);
}

.fog-route-transition.phase-veil .fog-route-transition__mist--right {
    opacity: 0.66;
    transform: translate3d(4%, -5%, 0) scale(1);
}

.fog-route-transition.phase-reveal .fog-route-transition__veil {
    opacity: 0.5;
    transform: translate3d(0, -1%, 0) scale(1.01);
}

.fog-route-transition.phase-reveal .fog-route-transition__mist--left {
    opacity: 0.28;
    transform: translate3d(6%, -3%, 0) scale(0.99);
}

.fog-route-transition.phase-reveal .fog-route-transition__mist--right {
    opacity: 0.2;
    transform: translate3d(-4%, 4%, 0) scale(0.99);
}
</style>
