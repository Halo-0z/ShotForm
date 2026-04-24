<template>
  <div class="radar-chart" ref="chartRef"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { RadarChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

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
let chartInstance: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

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

  const option: echarts.EChartsCoreOption = {
    tooltip: {
      trigger: 'item'
    },
    legend: {
      data: ['你的姿势', props.playerName],
      bottom: 0
    },
    radar: {
      indicator: props.indicators,
      center: ['50%', '45%'],
      radius: '60%'
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: props.userData,
            name: '你的姿势',
            areaStyle: {
              color: 'rgba(64, 158, 255, 0.3)'
            },
            lineStyle: {
              color: '#409EFF'
            },
            itemStyle: {
              color: '#409EFF'
            }
          },
          {
            value: props.playerData,
            name: props.playerName,
            areaStyle: {
              color: 'rgba(103, 194, 58, 0.3)'
            },
            lineStyle: {
              color: '#67C23A'
            },
            itemStyle: {
              color: '#67C23A'
            }
          }
        ]
      }
    ]
  }

  chartInstance.setOption(option)
}

watch(() => [props.userData, props.playerData, props.playerName, props.indicators], updateChart, { deep: true })

onMounted(() => {
  initChart()
})

onUnmounted(() => {
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
  height: 300px;
}
</style>
