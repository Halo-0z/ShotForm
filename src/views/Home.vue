<script setup lang="ts">
import { Button } from "@/components/ui/button"
import BasketballGlyph from "@/components/basketball/BasketballGlyph.vue"
import { ref } from "vue"
import { useRouter } from "vue-router"
import { ArrowRight, ShieldCheck, Pause, Play } from "lucide-vue-next"
import {
    navigateWithFogTransition,
    useFogRouteTransition,
} from "@/composables/useFogRouteTransition"
import HomePlayerCarousel from "@/components/home/HomePlayerCarousel.vue"
const router = useRouter()
const isLoading = ref(false)
const coverPaused = ref(false)
const { prefersReducedMotion } = useFogRouteTransition()
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
    <main class="home-page">
        <div class="home-cover">
            <div class="home-copy ui-enter">
                <p class="home-kicker"><span class="home-status-dot" />SHOTFORM / 训练主场</p>
                <h1>看见你的<br /><span>出手节奏</span></h1>
                <p class="home-intro">
                    从一次投篮开始。回看关键帧，观察关节角度，留下下一次训练的方向。
                </p>
                <Button
                    class="home-start"
                    :disabled="isLoading"
                    :aria-busy="isLoading"
                    aria-label="开始投篮分析"
                    @click="handleStart"
                >
                    <BasketballGlyph name="ball" />{{ isLoading ? "正在进入…" : "开始分析"
                    }}<ArrowRight class="home-start-arrow" aria-hidden="true" />
                </Button>
                <p class="home-formats">图片或短视频 · 支持逐帧回看与训练记录</p>
            </div>
            <div class="home-art">
                <HomePlayerCarousel
                    aria-hidden="true"
                    :reduce-motion="prefersReducedMotion || coverPaused"
                />
                <button
                    v-if="!prefersReducedMotion"
                    class="home-art-control"
                    :aria-label="coverPaused ? '播放封面轮播' : '暂停封面轮播'"
                    @click="coverPaused = !coverPaused"
                >
                    <Play v-if="coverPaused" /><Pause v-else />{{
                        coverPaused ? "继续轮播" : "定格画面"
                    }}
                </button>
            </div>
        </div>
        <nav class="home-quicklinks" aria-label="训练快捷入口">
            <RouterLink to="/analysis"
                ><BasketballGlyph name="replay" /><span
                    >动作回放<small>逐帧观察出手细节</small></span
                ><ArrowRight aria-hidden="true"
            /></RouterLink>
            <RouterLink to="/history"
                ><BasketballGlyph name="history" /><span>训练档案<small>回看每一次训练</small></span
                ><ArrowRight aria-hidden="true"
            /></RouterLink>
            <RouterLink to="/compare"
                ><BasketballGlyph name="compare" /><span
                    >动作对比<small>寻找下一步改进方向</small></span
                ><ArrowRight aria-hidden="true"
            /></RouterLink>
        </nav>
        <footer class="home-privacy">
            <ShieldCheck aria-hidden="true" />
            <p>基础分析在本机完成。选择生成 AI 报告时，图像和分析数据会发送至腾讯混元云服务。</p>
        </footer>
    </main>
</template>

<style scoped>
.home-page {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    padding: 36px clamp(24px, 5vw, 80px) 24px;
    background: var(--bg-solid);
    overflow: hidden;
}
.home-cover {
    position: relative;
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 32px;
    min-height: 580px;
}
.home-copy {
    position: relative;
    z-index: 1;
    padding: 32px 0;
}
.home-kicker {
    font-size: 14px;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
    margin-bottom: 30px;
}
h1 {
    font-size: clamp(44px, 5vw, 74px);
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.04em;
    color: var(--text-primary);
}
h1 span {
    color: var(--evidence-text);
}
.home-intro {
    max-width: 29em;
    font-size: 17px;
    line-height: 1.9;
    color: var(--text-secondary);
    margin: 28px 0;
}
.home-start {
    display: inline-flex;
    align-items: center;
    gap: 32px;
    padding: 15px 24px;
    color: var(--action-text);
    background: var(--primary-color);
    border: 0;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
    transition:
        background 140ms,
        transform 140ms;
}
.home-start svg {
    width: 20px;
    transition: transform 160ms;
}
.home-start:hover:not(:disabled) {
    background: var(--primary-hover);
}
.home-start:hover:not(:disabled) svg {
    transform: translateX(4px);
}
.home-start:active:not(:disabled) {
    transform: translateY(1px);
}
.home-start:disabled {
    opacity: 0.6;
}
.home-formats {
    margin-top: 18px;
    color: var(--text-muted);
    font-size: 13px;
}
.home-art {
    height: min(72vh, 730px);
    min-height: 450px;
    align-self: end;
    position: relative;
}
.home-art::before {
    content: "";
    position: absolute;
    inset: 8% 0 0;
    background: radial-gradient(
        ellipse at center,
        color-mix(in srgb, var(--evidence-text) 12%, transparent),
        transparent 66%
    );
}
.home-privacy {
    display: flex;
    align-items: start;
    gap: 10px;
    border-top: 1px solid var(--surface-border);
    padding-top: 20px;
    color: var(--text-muted);
    font-size: 13px;
    position: relative;
}
.home-privacy svg {
    width: 17px;
    height: 20px;
    flex-shrink: 0;
}
@media (max-width: 900px) {
    .home-page {
        padding: 24px;
    }
    .home-cover {
        gap: 16px;
        min-height: 480px;
        grid-template-columns: 1.1fr 1fr;
    }
    .home-art {
        min-height: 360px;
        height: 55vh;
    }
    .home-intro {
        font-size: 15px;
    }
    .home-kicker {
        margin-bottom: 24px;
    }
}
@media (max-width: 600px) {
    .home-cover {
        grid-template-columns: 1fr;
    }
    .home-copy {
        padding-bottom: 0;
    }
    .home-art {
        height: 320px;
        min-height: 0;
    }
    .home-page {
        padding: 20px;
    }
    h1 {
        font-size: 46px;
    }
}
.home-art-control {
    position: absolute;
    bottom: 12px;
    right: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-secondary);
    background: var(--bg-solid);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
}
.home-art-control svg {
    width: 14px;
    height: 14px;
}
</style>
