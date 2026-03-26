<template>
  <div class="angle-chart" ref="chartRef"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { getAngleDisplayName, type JointAngle } from '@/types'

const props = defineProps<{
  angles: JointAngle[]
}>()

const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null
let observer: MutationObserver | null = null

const getStatusLabel = (status: JointAngle['status']) => {
  const labels: Record<JointAngle['status'], string> = {
    normal: '正常',
    warning: '警告',
    error: '异常',
    low_confidence: '点位不稳'
  }
  return labels[status]
}

const initChart = () => {
  if (!chartRef.value) return

  chartInstance = echarts.init(chartRef.value)
  updateChart()
}

const updateChart = () => {
  if (!chartInstance || !props.angles.length) return

  const isDark = document.documentElement.classList.contains('dark')

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      backgroundColor: isDark ? 'rgba(30, 28, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
      borderColor: isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)',
      textStyle: {
        color: isDark ? '#F0ECF7' : '#1E1B4B'
      },
      formatter: (params: any) => {
        const index = params[0]?.dataIndex ?? 0
        const angle = props.angles[index]
        return [
          getAngleDisplayName(angle.name),
          `角度: ${angle.value.toFixed(1)}°`,
          `关键点可靠度: ${(angle.confidence * 100).toFixed(0)}%`,
          `状态: ${getStatusLabel(angle.status)}`
        ].join('<br/>')
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '14%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: props.angles.map(angle => getAngleDisplayName(angle.name)),
      axisLabel: {
        interval: 'auto',
        hideOverlap: true,
        rotate: 18,
        width: 42,
        overflow: 'truncate',
        color: isDark ? '#B5AFCA' : '#6B7280',
        fontSize: 11
      },
      axisLine: {
        lineStyle: {
          color: isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)'
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '角度 (°)',
      nameTextStyle: {
        color: isDark ? '#B5AFCA' : '#6B7280',
        fontSize: 11
      },
      min: 0,
      max: 180,
      axisLabel: {
        color: isDark ? '#B5AFCA' : '#6B7280',
        fontSize: 11
      },
      axisLine: {
        lineStyle: {
          color: isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)'
        }
      },
      splitLine: {
        lineStyle: {
          color: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)'
        }
      }
    },
    series: [
      {
        name: '当前角度',
        type: 'bar',
        data: props.angles.map(angle => ({
          value: angle.value,
          itemStyle: {
            color: getStatusColor(angle.status),
            borderRadius: [4, 4, 0, 0]
          }
        })),
        label: {
          show: true,
          position: 'top',
          formatter: (params: any) => {
            const angle = props.angles[params.dataIndex]
            return angle.status === 'low_confidence'
              ? `${params.value.toFixed(1)}°\n点位不稳`
              : `${params.value.toFixed(1)}°`
          },
          color: isDark ? '#F0ECF7' : '#1E1B4B',
          fontSize: 11,
          fontWeight: 500,
          textShadowBlur: 0,
          textShadowColor: 'transparent'
        },
        barWidth: '50%'
      },
      {
        name: '正常范围下限',
        type: 'line',
        data: props.angles.map(angle => angle.normalRange[0]),
        lineStyle: {
          color: '#10B981',
          type: 'dashed',
          width: 1.5
        },
        symbol: 'none'
      },
      {
        name: '正常范围上限',
        type: 'line',
        data: props.angles.map(angle => angle.normalRange[1]),
        lineStyle: {
          color: '#10B981',
          type: 'dashed',
          width: 1.5
        },
        symbol: 'none'
      }
    ]
  }

  chartInstance.setOption(option)
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    normal: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    low_confidence: '#94A3B8'
  }
  return colors[status] || '#6366F1'
}

const handleThemeChange = () => {
  updateChart()
}

watch(() => props.angles, updateChart, { deep: true })

onMounted(() => {
  initChart()

  observer = new MutationObserver(() => {
    handleThemeChange()
  })

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
})

onUnmounted(() => {
  observer?.disconnect()
  if (chartInstance) {
    chartInstance.dispose()
  }
})
</script>

<style scoped>
.angle-chart {
  width: 100%;
  height: 332px;
}
</style>
