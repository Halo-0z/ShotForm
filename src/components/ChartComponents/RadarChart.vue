<template>
    <div ref="chartRef" class="radar-chart"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue"
import { useResolvedThemeState } from "@/composables/useResolvedThemeState"
import * as echarts from "echarts/core"
import { RadarChart } from "echarts/charts"
import { TooltipComponent, LegendComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"

echarts.use([RadarChart, TooltipComponent, LegendComponent, CanvasRenderer])

export interface RadarIndicator {
    name: string
    max: number
}

const props = defineProps<{
    userData: number[]
    playerData: number[]
    playerName: string
    indicators: RadarIndicator[]
}>()

const chartRef = ref<HTMLDivElement | null>(null)
const { isLightTheme } = useResolvedThemeState()
let chartInstance: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null
let handleWindowResize: (() => void) | null = null

const initChart = () => {
    if (!chartRef.value) return

    chartInstance = echarts.init(chartRef.value)
    updateChart()

    resizeObserver = new ResizeObserver(() => {
        chartInstance?.resize()
    })
    resizeObserver.observe(chartRef.value)
}

const updateChart = () => {
    if (!chartInstance) return
    const css = getComputedStyle(document.documentElement)
    const color = (token: string) => css.getPropertyValue(token).trim()

    const option: echarts.EChartsCoreOption = {
        animation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        textStyle: {
            color: color("--text-secondary"),
            fontFamily: "HarmonyOS Sans SC",
            fontSize: 12,
        },
        tooltip: {
            trigger: "item",
        },
        legend: {
            data: ["你的姿势", props.playerName],
            bottom: 0,
            textStyle: { color: color("--text-secondary") },
        },
        radar: {
            indicator: props.indicators,
            center: ["50%", "45%"],
            radius: "60%",
            axisName: { color: color("--text-secondary"), fontSize: 12 },
            axisLine: { lineStyle: { color: color("--surface-border") } },
            splitLine: { lineStyle: { color: color("--surface-border") } },
            splitArea: { show: false },
        },
        series: [
            {
                type: "radar",
                data: [
                    {
                        value: props.userData,
                        name: "你的姿势",
                        areaStyle: {
                            color: color("--primary-color"),
                            opacity: 0.15,
                        },
                        lineStyle: {
                            color: color("--primary-color"),
                        },
                        itemStyle: {
                            color: color("--primary-color"),
                        },
                    },
                    {
                        value: props.playerData,
                        name: props.playerName,
                        areaStyle: {
                            color: color("--evidence-text"),
                            opacity: 0.12,
                        },
                        lineStyle: {
                            color: color("--evidence-text"),
                        },
                        itemStyle: {
                            color: color("--evidence-text"),
                        },
                    },
                ],
            },
        ],
    }

    chartInstance.setOption(option)
}

watch(() => [props.userData, props.playerData, props.playerName, props.indicators], updateChart, {
    deep: true,
})
watch(isLightTheme, updateChart, { flush: "post" })

onMounted(() => {
    initChart()

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
    if (chartInstance) {
        chartInstance.dispose()
        chartInstance = null
    }
})
</script>

<style scoped>
.radar-chart {
    width: 100%;
    height: 240px;
}
</style>
