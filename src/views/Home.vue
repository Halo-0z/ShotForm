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
    <div class="home-page" :class="{ 'home-page--dark': !isLightTheme }" role="main">
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
                    <button
                        class="home-page__hero-cta"
                        :disabled="isLoading"
                        :aria-busy="isLoading"
                        aria-label="开始投篮分析"
                        @click="handleStart"
                    >
                        开始分析
                        <ArrowRight class="home-page__hero-cta-icon" aria-hidden="true" />
                    </button>
                </div>

                <div class="home-page__hero-visual" aria-hidden="true">
                    <div class="home-page__hero-decor"></div>
                    <HomePlayerCarousel />
                </div>
            </div>

            <section class="home-page__features" aria-label="核心功能">
                <article
                    v-for="card in featureCards"
                    :key="card.title"
                    class="home-page__feature-card"
                >
                    <div class="home-page__feature-left">
                        <div class="home-page__feature-icon" aria-hidden="true">
                            <component :is="card.icon" />
                        </div>
                        <div class="home-page__feature-text">
                            <h3>{{ card.title }}</h3>
                            <p>{{ card.desc }}</p>
                        </div>
                    </div>
                </article>
            </section>

            <aside class="home-page__privacy" aria-label="隐私保障">
                <div class="home-page__privacy-icon" aria-hidden="true">
                    <ShieldCheck />
                </div>
                <div class="home-page__privacy-text">
                    <h3>隐私与安全保障</h3>
                    <p>我们仅在本地处理你上传的视频，确保你的数据安全与隐私不被泄露。</p>
                </div>
                <div class="home-page__privacy-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
            </aside>
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
    padding: 13px 28px;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--accent-color), var(--accent-hover));
    color: var(--text-inverse);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    position: relative;
    overflow: hidden;
    transition:
        transform 200ms ease,
        box-shadow 200ms ease;
    width: fit-content;
    margin-top: 4px;
}

.home-page__hero-cta::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), transparent);
    opacity: 0;
    transition: opacity 250ms ease;
}

.home-page__hero-cta:hover:not(:disabled) {
    box-shadow:
        0 8px 24px color-mix(in srgb, var(--accent-color) 32%, transparent),
        0 2px 8px color-mix(in srgb, var(--accent-color) 20%, transparent);
    transform: translateY(-2px);
}

.home-page__hero-cta:hover:not(:disabled)::before {
    opacity: 1;
}

.home-page__hero-cta:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--accent-color) 25%, transparent);
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
    padding: 26px 24px;
    border-radius: 16px;
    background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.98) 0%,
        rgba(250, 247, 242, 0.96) 100%
    );
    border: 1.5px solid rgba(201, 130, 61, 0.12);
    box-shadow:
        0 2px 8px rgba(28, 33, 40, 0.04),
        0 1px 3px rgba(28, 33, 40, 0.03),
        inset 0 1px 0 rgba(255, 255, 255, 0.85);
    transition:
        background 220ms ease,
        border-color 220ms ease,
        box-shadow 220ms ease,
        transform 200ms ease;
    min-height: 92px;
    position: relative;
    overflow: hidden;
}

.home-page__feature-card::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(ellipse at 30% 20%, rgba(201, 130, 61, 0.06) 0%, transparent 60%);
    opacity: 0;
    transition: opacity 280ms ease;
    pointer-events: none;
}

.home-page--dark .home-page__feature-card {
    background: linear-gradient(135deg, rgba(34, 41, 51, 0.65) 0%, rgba(26, 32, 41, 0.6) 100%);
    border-color: rgba(214, 154, 89, 0.15);
    box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.25),
        0 1px 3px rgba(0, 0, 0, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.home-page--dark .home-page__feature-card::before {
    background: radial-gradient(ellipse at 70% 80%, rgba(214, 154, 89, 0.08) 0%, transparent 55%);
}

.home-page__feature-card:hover {
    background: linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(252, 249, 244, 0.98) 100%);
    border-color: rgba(201, 130, 61, 0.22);
    box-shadow:
        0 6px 20px rgba(201, 130, 61, 0.08),
        0 3px 10px rgba(28, 33, 40, 0.05),
        inset 0 1px 0 rgba(255, 255, 255, 0.95);
    transform: translateY(-2px);
}

.home-page__feature-card:hover::before {
    opacity: 1;
}

.home-page--dark .home-page__feature-card:hover {
    background: linear-gradient(135deg, rgba(38, 46, 58, 0.72) 0%, rgba(30, 38, 49, 0.68) 100%);
    border-color: rgba(214, 154, 89, 0.28);
    box-shadow:
        0 8px 28px rgba(0, 0, 0, 0.35),
        0 4px 14px rgba(214, 154, 89, 0.06),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.home-page__feature-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.home-page__feature-icon {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    background: linear-gradient(
        145deg,
        rgba(201, 130, 61, 0.14) 0%,
        rgba(201, 130, 61, 0.07) 50%,
        rgba(201, 130, 61, 0.04) 100%
    );
    display: flex;
    align-items: center;
    justify-content: center;
    color: #a86d30;
    flex-shrink: 0;
    transition:
        transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1),
        background 220ms ease,
        box-shadow 200ms ease;
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.45),
        0 2px 6px rgba(168, 109, 48, 0.08);
    position: relative;
}

.home-page__feature-icon::after {
    content: "";
    position: absolute;
    inset: 2px;
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, transparent 45%);
    pointer-events: none;
}

.home-page__feature-icon svg {
    width: 22px;
    height: 22px;
    filter: drop-shadow(0 1px 1px rgba(168, 109, 48, 0.15));
    position: relative;
    z-index: 1;
}

.home-page__feature-card:hover .home-page__feature-icon {
    transform: scale(1.08) rotate(-2deg);
    background: linear-gradient(
        145deg,
        rgba(201, 130, 61, 0.18) 0%,
        rgba(201, 130, 61, 0.1) 50%,
        rgba(201, 130, 61, 0.06) 100%
    );
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.55),
        0 4px 12px rgba(201, 130, 61, 0.15);
}

.home-page__feature-card:focus-within {
    outline: none;
}

.home-page__feature-card:focus-visible {
    outline: 2.5px solid #c9823d;
    outline-offset: 3px;
    box-shadow:
        0 0 0 6px rgba(201, 130, 61, 0.12),
        0 8px 24px rgba(28, 33, 40, 0.06);
}

.home-page__feature-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.home-page__feature-text h3 {
    font-size: 15px;
    font-weight: 680;
    color: #1a1f26;
    letter-spacing: -0.015em;
    line-height: 1.35;
}

.home-page__feature-text p {
    font-size: 12.5px;
    font-weight: 450;
    color: #5a6474;
    line-height: 1.65;
}

.home-page__privacy {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 20px 26px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--accent-color) 4%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-color) 10%, var(--surface-border));
}

.home-page__privacy-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent-color) 12%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-color);
    flex-shrink: 0;
}

.home-page__privacy-icon svg {
    width: 20px;
    height: 20px;
}

.home-page__privacy-text {
    flex: 1;
    min-width: 0;
}

.home-page__privacy-text h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 2px;
}

.home-page__privacy-text p {
    font-size: 12.5px;
    color: var(--text-muted);
    line-height: 1.6;
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
        gap: 20px;
    }

    .home-page__hero {
        grid-template-columns: 1fr;
        gap: 20px;
        min-height: 0;
    }

    .home-page__hero-visual {
        order: -1;
        height: clamp(200px, 45vw, 280px);
    }

    .home-page__hero-decor {
        display: none;
    }

    .home-page__hero-content {
        max-width: 100%;
    }

    .home-page__hero-title {
        font-size: clamp(32px, 8vw, 42px);
    }

    .home-page__features {
        grid-template-columns: 1fr;
        gap: 12px;
    }

    .home-page__feature-card {
        padding: 22px 20px;
        min-height: 84px;
    }

    .home-page__feature-icon {
        width: 42px;
        height: 42px;
    }

    .home-page__feature-text h3 {
        font-size: 14.5px;
    }

    .home-page__feature-text p {
        font-size: 12px;
    }

    .home-page__privacy {
        flex-direction: column;
        text-align: center;
        gap: 14px;
        padding: 24px 20px;
    }

    .home-page__privacy-text {
        text-align: center;
    }
}

@media (prefers-reduced-motion: reduce) {
    .home-page__feature-card,
    .home-page__feature-icon,
    .home-page__feature-card::before {
        transition: none;
    }

    .home-page__feature-card:hover {
        transform: none;
    }

    .home-page__feature-card:hover .home-page__feature-icon {
        transform: none;
    }
}
</style>
