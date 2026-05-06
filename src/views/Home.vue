<script setup lang="ts">
import { ref } from "vue"
import { useRouter } from "vue-router"
import { ArrowRight, Target, Activity, FileBarChart, ShieldCheck } from "lucide-vue-next"
import { navigateWithFogTransition } from "@/composables/useFogRouteTransition"
import { useResolvedThemeState } from "@/composables/useResolvedThemeState"
import HomePlayerCarousel from "@/components/home/HomePlayerCarousel.vue"

const router = useRouter()
const isLoading = ref(false)
const { isLightTheme } = useResolvedThemeState()

const featureCards = [
    {
        icon: Target,
        title: "精准识别",
        desc: "AI 姿态识别，捕捉关键动作节点",
    },
    {
        icon: Activity,
        title: "节奏分析",
        desc: "分析出手节奏与发力顺序",
    },
    {
        icon: FileBarChart,
        title: "可视化报告",
        desc: "直观图表与对比，定位提升空间",
    },
]

const handleStart = async () => {
    if (isLoading.value) return
    isLoading.value = true
    try {
        await navigateWithFogTransition(router, "/upload")
    } finally {
        isLoading.value = false
    }
}
</script>

<template>
    <div class="home-page" :class="{ 'home-page--dark': !isLightTheme }">
        <div class="home-page__inner">
            <div class="home-page__hero">
                <div class="home-page__hero-content">
                    <span class="home-page__hero-eyebrow">BASKETBALL SHOT ANALYZER</span>
                    <h1 class="home-page__hero-title">
                        看见你的<br />
                        <span class="home-page__hero-title-accent">出手节奏</span>
                    </h1>
                    <p class="home-page__hero-subtitle">
                        基于姿态识别与关键帧分析，帮助你更清晰地理解投篮动作，<br />
                        出手节奏与发力结构，持续提升投篮表现。
                    </p>
                    <button class="home-page__hero-cta" :disabled="isLoading" @click="handleStart">
                        开始分析
                        <ArrowRight class="home-page__hero-cta-icon" />
                    </button>
                </div>

                <div class="home-page__hero-visual">
                    <div class="home-page__hero-decor"></div>
                    <HomePlayerCarousel />
                </div>
            </div>

            <div class="home-page__features">
                <div v-for="card in featureCards" :key="card.title" class="home-page__feature-card">
                    <div class="home-page__feature-left">
                        <div class="home-page__feature-icon">
                            <component :is="card.icon" />
                        </div>
                        <div class="home-page__feature-text">
                            <h3>{{ card.title }}</h3>
                            <p>{{ card.desc }}</p>
                        </div>
                    </div>
                    <ArrowRight class="home-page__feature-arrow" />
                </div>
            </div>

            <div class="home-page__privacy">
                <div class="home-page__privacy-icon">
                    <ShieldCheck />
                </div>
                <div class="home-page__privacy-text">
                    <h3>隐私与安全保障</h3>
                    <p>我们仅在本地处理你上传的视频，确保你的数据安全与隐私不被泄露。</p>
                </div>
                <div class="home-page__privacy-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <rect
                            x="3"
                            y="11"
                            width="18"
                            height="11"
                            rx="2"
                            stroke="currentColor"
                            stroke-width="2"
                        />
                        <path
                            d="M7 11V7a5 5 0 0110 0v4"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                        />
                    </svg>
                    <span>本地处理</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.home-page {
    height: 100%;
    background: var(--hero-bg-light);
    transition: background var(--theme-transition);
}

.home-page--dark {
    background: var(--hero-bg-dark);
}

.home-page__inner {
    max-width: 1120px;
    margin: 0 auto;
    padding: 20px 36px 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-height: 100%;
}

.home-page__hero {
    display: grid;
    grid-template-columns: 1fr 1.1fr;
    gap: 20px;
    align-items: center;
    flex: 1;
    min-height: 0;
}

.home-page__hero-visual {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    height: 100%;
    max-height: 440px;
    align-self: center;
}

.home-page__hero-content {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 420px;
}

.home-page__hero-eyebrow {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-color);
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
}

.home-page__hero-title {
    font-size: clamp(36px, 4vw, 48px);
    font-weight: 750;
    line-height: 1.18;
    color: var(--text-primary);
    letter-spacing: -0.025em;
}

.home-page__hero-title-accent {
    color: var(--accent-color);
}

.home-page__hero-subtitle {
    font-size: 14.5px;
    line-height: 1.7;
    color: var(--text-secondary);
}

.home-page__hero-cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 26px;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--accent-color), var(--accent-hover));
    color: var(--text-inverse);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 180ms ease;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--accent-color) 25%, transparent);
    width: fit-content;
    margin-top: 2px;
}

.home-page__hero-cta:hover:not(:disabled) {
    box-shadow: 0 6px 18px color-mix(in srgb, var(--accent-color) 30%, transparent);
    transform: translateY(-1px);
}

.home-page__hero-cta:active:not(:disabled) {
    transform: translateY(0);
}

.home-page__hero-cta:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.home-page__hero-cta-icon {
    width: 16px;
    height: 16px;
}

.home-page__hero-decor {
    position: absolute;
    right: 10%;
    top: 50%;
    transform: translateY(-50%);
    width: 260px;
    height: 260px;
    border-radius: 50%;
    border: 1.5px dashed color-mix(in srgb, var(--accent-color) 16%, transparent);
    pointer-events: none;
    z-index: 0;
}

.home-page__hero-visual > :not(.home-page__hero-decor) {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
}

.home-page__features {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
}

.home-page__feature-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22px 20px;
    border-radius: 14px;
    background: var(--card-bg-light);
    border: 1px solid var(--card-border-light);
    transition: all 180ms ease;
    cursor: pointer;
    min-height: 80px;
}

.home-page--dark .home-page__feature-card {
    background: var(--card-bg-dark);
    border-color: var(--card-border-dark);
}

.home-page__feature-card:hover {
    border-color: color-mix(in srgb, var(--accent-color) 20%, var(--card-border-light));
    box-shadow: 0 4px 14px color-mix(in srgb, var(--accent-color) 8%, transparent);
    transform: translateY(-1px);
}

.home-page--dark .home-page__feature-card:hover {
    border-color: color-mix(in srgb, var(--accent-color) 20%, var(--card-border-dark));
}

.home-page__feature-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.home-page__feature-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-color);
    flex-shrink: 0;
}

.home-page__feature-icon svg {
    width: 20px;
    height: 20px;
}

.home-page__feature-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.home-page__feature-text h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
}

.home-page__feature-text p {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
}

.home-page__feature-arrow {
    width: 16px;
    height: 16px;
    color: var(--text-muted);
    flex-shrink: 0;
    transition: all 180ms ease;
}

.home-page__feature-card:hover .home-page__feature-arrow {
    color: var(--accent-color);
    transform: translateX(2px);
}

.home-page__privacy {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--accent-color) 4%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-color) 10%, var(--surface-border));
}

.home-page__privacy-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent-color) 12%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-color);
    flex-shrink: 0;
}

.home-page__privacy-icon svg {
    width: 18px;
    height: 18px;
}

.home-page__privacy-text {
    flex: 1;
    min-width: 0;
}

.home-page__privacy-text h3 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1px;
}

.home-page__privacy-text p {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
}

.home-page__privacy-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border-radius: 999px;
    background: color-mix(in srgb, #22c55e 10%, transparent);
    color: #16a34a;
    font-size: 11.5px;
    font-weight: 500;
    flex-shrink: 0;
}

.home-page--dark .home-page__privacy-badge {
    background: color-mix(in srgb, #22c55e 15%, transparent);
    color: #4ade80;
}

@media (max-width: 900px) {
    .home-page__inner {
        padding: 18px 16px;
        gap: 18px;
    }

    .home-page__hero {
        grid-template-columns: 1fr;
        gap: 16px;
        min-height: 0;
    }

    .home-page__hero-visual {
        order: -1;
        height: 200px;
    }

    .home-page__hero-decor {
        display: none;
    }

    .home-page__hero-content {
        max-width: 100%;
    }

    .home-page__features {
        grid-template-columns: 1fr;
    }

    .home-page__privacy {
        flex-direction: column;
        text-align: center;
        gap: 8px;
    }

    .home-page__privacy-text {
        text-align: center;
    }
}
</style>
