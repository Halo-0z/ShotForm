<template>
  <div class="radar-chart" ref="chartRef"></div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  userData: number[]
  playerData: number[]
  playerName: string
}>()

const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const indicators = [
  { name: '肘角', max: 180 },
  { name: '膝角', max: 180 },
  { name: '肩角', max: 180 },
  { name: '躯干倾斜', max: 90 }
]

const initChart = () => {
  if (!chartRef.value) return

  chartInstance = echarts.init(chartRef.value)
  updateChart()
}

const updateChart = () => {
  if (!chartInstance) return

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item'
    },
    legend: {
      data: ['你的姿势', props.playerName],
      bottom: 0
    },
    radar: {
      indicator: indicators,
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

watch(() => [props.userData, props.playerData, props.playerName], updateChart, { deep: true })

onMounted(() => {
  initChart()
})
</script>

<style scoped>
.radar-chart {
  width: 100%;
  height: 300px;
}
</style>
