<template>
    <div class="court-artwork" aria-hidden="true">
        <img src="/art/court-kit-v2.webp" alt="" width="1440" height="1080" decoding="async" />
    </div>
</template>

<style scoped>
.court-artwork {
    position: relative;
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
}
.court-artwork img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 16px 18px rgb(9 16 26 / 16%));
    transition: transform 300ms ease;
}
.court-artwork:hover img {
    transform: translateY(-4px);
}
@media (prefers-reduced-motion: reduce) {
    .court-artwork img {
        transition: none;
        transform: none;
    }
}
</style>
