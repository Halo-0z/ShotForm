<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { useResolvedThemeState } from "@/composables/useResolvedThemeState"
import type { AnalysisHistory } from "@/types"
import { getAngleDisplayName } from "@/types"
import { trainingTrendPoints } from "@/lib/training-comparison.js"

const props = defineProps<{
    records: AnalysisHistory[]
}>()

const chartContainer = ref<HTMLDivElement>()
const { isLightTheme } = useResolvedThemeState()

const angleNames = computed(() => {
    if (!props.records.length) return [] as string[]
    const firstAngles = props.records[0].analysis.angles
    if (!firstAngles?.length) return [] as string[]
    return firstAngles.map((a) => a.name)
})

const selectedAngle = ref<string>("")

const sortedRecords = computed(() =>
    [...props.records].sort(
        (a, b) =>
            (a.trainingDate || "").localeCompare(b.trainingDate || "") || a.createdAt - b.createdAt,
    ),
)

watch(
    () => props.records,
    (records) => {
        if (records.length && !selectedAngle.value) {
            const first = records[0]?.analysis.angles[0]?.name
            if (first) selectedAngle.value = first
        }
    },
    { immediate: true },
)

let chartInstance: any = null
let resizeObserver: ResizeObserver | null = null
let handleWindowResize: (() => void) | null = null

async function importEcharts() {
    const echarts = await import("echarts/core")
    const { LineChart } = await import("echarts/charts")
    const { GridComponent, TooltipComponent } = await import("echarts/components")
    const { CanvasRenderer } = await import("echarts/renderers")
    echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])
    return echarts
}

const buildOption = () => {
    const angleName = selectedAngle.value
    if (!angleName) return {}

    const dataPoints = trainingTrendPoints(sortedRecords.value, angleName)
    const css = getComputedStyle(document.documentElement)
    const color = (token: string) => css.getPropertyValue(token).trim()

    return {
        animation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        textStyle: { color: color("--text-secondary"), fontFamily: "HarmonyOS Sans SC" },
        tooltip: {
            trigger: "axis",
            formatter: (
                params: Array<{
                    dataIndex: number
                    name: string
                    seriesName: string
                    value: number
                }>,
            ) => {
                const point = params[0]
                if (!point) return ""
                const record = dataPoints[point.dataIndex]
                if (!record) return ""
                const id = Number.isFinite(record.recordId)
                    ? `记录 #${Number(record.recordId)}`
                    : "训练记录"
                const time = new Date(record.createdAt).toLocaleString("zh-CN", { hour12: false })
                return `${point.name}<br/>${id} · ${time}<br/>${point.seriesName}: ${point.value.toFixed(1)}°`
            },
        },
        grid: { top: 44, right: 20, bottom: 24, left: 48 },
        xAxis: {
            type: "category",
            data: dataPoints.map((d) =>
                new Date(d.time).toLocaleDateString("zh-CN", { month: "short", day: "numeric" }),
            ),
            axisLine: { lineStyle: { color: color("--surface-border") } },
            axisLabel: { color: color("--text-muted"), fontSize: 12 },
        },
        yAxis: {
            type: "value",
            name: "角度 (°)",
            nameGap: 14,
            nameTextStyle: { color: color("--text-muted"), fontSize: 12, lineHeight: 18 },
            axisLine: { lineStyle: { color: color("--surface-border") } },
            axisLabel: { color: color("--text-muted"), fontSize: 12 },
            splitLine: {
                lineStyle: { color: color("--surface-border") },
            },
        },
        series: [
            {
                name: getAngleDisplayName(angleName),
                type: "line",
                data: dataPoints.map((d) => d.value),
                smooth: true,
                lineStyle: { color: color("--evidence-text"), width: 2 },
                itemStyle: { color: color("--evidence-text") },
                symbol: "circle",
                symbolSize: 6,
            },
        ],
    }
}

const renderChart = async () => {
    const container = chartContainer.value
    if (!container || !selectedAngle.value) return
    const echarts = await importEcharts()
    // Filtering/unmounting may remove the chart while its modules are loading.
    if (chartContainer.value !== container || !container.isConnected) return
    if (!chartInstance) {
        chartInstance = echarts.init(container, undefined, {
            devicePixelRatio: window.devicePixelRatio,
        })
    }
    const option = buildOption()
    chartInstance.setOption(option, true)
}

watch(
    isLightTheme,
    () => {
        void renderChart()
    },
    { flush: "post" },
)
watch(selectedAngle, () => {
    void renderChart()
})

watch(
    () => props.records,
    () => {
        void renderChart()
    },
    { deep: true },
)

onMounted(() => {
    void renderChart()

    resizeObserver = new ResizeObserver(() => {
        chartInstance?.resize()
    })
    if (chartContainer.value) {
        resizeObserver.observe(chartContainer.value)
    }

    handleWindowResize = () => {
        requestAnimationFrame(() => {
            chartInstance?.resize()
        })
    }
    window.addEventListener("resize", handleWindowResize)
})

onUnmounted(() => {
    if (handleWindowResize) {
        window.removeEventListener("resize", handleWindowResize)
    }
    resizeObserver?.disconnect()
    chartInstance?.dispose()
    chartInstance = null
})
</script>

<template>
    <div v-if="records.length > 1 && angleNames.length" class="progress-chart">
        <div class="progress-chart__header">
            <h4 class="progress-chart__title">训练趋势</h4>
            <select
                v-model="selectedAngle"
                class="progress-chart__select"
                aria-label="训练趋势角度"
            >
                <option v-for="name in angleNames" :key="name" :value="name">
                    {{ getAngleDisplayName(name) }}
                </option>
            </select>
        </div>
        <div ref="chartContainer" class="progress-chart__canvas" />
    </div>
</template>

<style scoped>
.progress-chart {
    margin-top: 12px;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid color-mix(in srgb, var(--surface-border) 74%, transparent);
    background: color-mix(in srgb, var(--card-bg) 94%, var(--background));
}

.progress-chart__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
}

.progress-chart__title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
}

.progress-chart__select {
    height: 30px;
    padding: 0 8px;
    border-radius: 8px;
    border: 1px solid var(--surface-border);
    background: var(--glass-xs);
    color: var(--text-primary);
    font-size: 12px;
    outline: none;
    cursor: pointer;
}

.progress-chart__canvas {
    width: 100%;
    height: 220px;
}
</style>
