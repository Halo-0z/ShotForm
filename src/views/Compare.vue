<script setup lang="ts">
import { computed } from "vue"
import { useRouter } from "vue-router"
import BasketballGlyph from "@/components/basketball/BasketballGlyph.vue"
import { ArrowLeft } from "lucide-vue-next"
import ComparisonView from "@/components/ComparisonView/index.vue"
import { Button } from "@/components/ui/button"
import { type ComparisonIdentity } from "@/lib/comparison-service"
import { buildCompareIdentity } from "@/lib/analysis-utils"
import { getComparisonPreviewAnalysis } from "@/lib/comparison-preview"
import { useAnalysisStore } from "@/stores/analysis"

const router = useRouter()
const analysisStore = useAnalysisStore()

const previewAnalysis = computed(() => getComparisonPreviewAnalysis())
const analysis = computed(() => analysisStore.currentAnalysis ?? previewAnalysis.value)

const compareIdentity = computed<ComparisonIdentity | null>(() => {
    if (!analysis.value) {
        return null
    }

    return buildCompareIdentity({
        analysis: analysis.value,
        videoAnalysis: analysisStore.currentVideoAnalysis,
        videoPath:
            analysisStore.currentVideoPath || analysisStore.currentVideoAnalysis?.videoPath || "",
        videoFrameIndex: analysisStore.currentVideoFrameIndex,
        historyId: analysisStore.currentHistoryId,
    })
})

const compareAnalysisProfile = computed(() => {
    return analysisStore.currentVideoAnalysis?.templateProfile ?? null
})

const goBack = () => {
    if (analysisStore.currentAnalysis) {
        router.push("/analysis")
        return
    }
    router.push("/upload")
}

const goToUpload = () => {
    router.push("/upload")
}

const goToTemplates = () => {
    router.push("/templates")
}
</script>

<template>
    <main class="compare-page ui-page ui-enter">
        <header class="ui-page__header">
            <div class="compare-heading">
                <Button
                    variant="ghost"
                    size="icon"
                    :aria-label="analysisStore.currentAnalysis ? '返回分析结果' : '前往上传素材'"
                    @click="goBack"
                    ><ArrowLeft class="h-5 w-5"
                /></Button>
                <div>
                    <h1>球星对比</h1>
                    <p>观察动作差异，结合拍摄条件理解参考结果。</p>
                </div>
            </div>
        </header>
        <ComparisonView
            v-if="analysis"
            :analysis="analysis"
            :analysis-profile="compareAnalysisProfile"
            :identity="compareIdentity"
            surface-id="compare-route"
            :active="true"
        />
        <div v-else class="ui-empty">
            <BasketballGlyph name="compare" />
            <h2>先完成一次投篮分析</h2>
            <p>用当前分析与参考模板比较动作阶段和关节角度。</p>
            <div class="ui-actions">
                <Button @click="goToUpload">上传素材</Button
                ><Button variant="outline" @click="goToTemplates">管理球星模板</Button>
            </div>
        </div>
    </main>
</template>
<style scoped>
.compare-heading {
    display: flex;
    align-items: center;
    gap: 12px;
}
.ui-empty h2 {
    font-size: 24px;
    font-weight: 600;
}
</style>
