<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"

interface PlayerImage {
    src: string
    alt: string
}

const PLAYER_IMAGES: readonly PlayerImage[] = [
    { src: "/hero/luka2.png", alt: "卢卡东契奇" },
    { src: "/hero/kobe-shot.png", alt: "科比布莱恩特" },
    { src: "/hero/jordan-shot-2.png", alt: "迈克尔乔丹" },
    { src: "/hero/durant-shot.png", alt: "凯文杜兰特" },
]

const CAROUSEL_INTERVAL_MS = 4500

const props = withDefaults(
    defineProps<{
        reduceMotion?: boolean
    }>(),
    {
        reduceMotion: false,
    },
)

const currentIndex = ref(0)
let carouselTimer: ReturnType<typeof setInterval> | null = null

const effectiveImages = computed(() => PLAYER_IMAGES)

const startCarousel = () => {
    stopCarousel()
    if (props.reduceMotion || effectiveImages.value.length <= 1) return
    carouselTimer = setInterval(advanceCarousel, CAROUSEL_INTERVAL_MS)
}

const stopCarousel = () => {
    if (carouselTimer !== null) {
        clearInterval(carouselTimer)
        carouselTimer = null
    }
}

const advanceCarousel = () => {
    if (props.reduceMotion) return
    const images = effectiveImages.value
    if (images.length <= 1) return
    currentIndex.value = (currentIndex.value + 1) % images.length
}

onMounted(() => {
    if (!props.reduceMotion) {
        startCarousel()
    }
})

onBeforeUnmount(() => {
    stopCarousel()
})
</script>

<template>
    <div class="carousel">
        <div
            v-for="(player, index) in effectiveImages"
            :key="player.src"
            class="carousel__slide"
            :class="{
                'carousel__slide--active': index === currentIndex,
                'carousel__slide--prev': (index + 1) % effectiveImages.length === currentIndex,
            }"
        >
            <img
                :src="player.src"
                :alt="player.alt"
                class="carousel__image"
                :loading="index === 0 ? 'eager' : 'lazy'"
                decoding="async"
            />
        </div>
    </div>
</template>

<style scoped>
.carousel {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: visible;
}

.carousel__slide {
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 0ms;
    will-change: opacity;
}

.carousel__slide--active {
    opacity: 1;
    transition: opacity 800ms ease-in-out;
}

.carousel__slide--prev {
    opacity: 0;
    transition: opacity 800ms ease-in-out;
}

.carousel__image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center bottom;
    display: block;
}

@media (prefers-reduced-motion: reduce) {
    .carousel__slide,
    .carousel__slide--active,
    .carousel__slide--prev {
        transition: opacity 0.01ms !important;
    }
}
</style>
