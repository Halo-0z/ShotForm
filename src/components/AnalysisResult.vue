<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  getShotTypeGuidance,
  SHOT_TYPE_NAMES,
  normalizeShotType,
  type ShotAnalysis,
  type ShotType
} from '@/types'

const props = defineProps<{
  analysis: ShotAnalysis
  visible: boolean
}>()

const showContent = ref(false)
const showShotType = ref(false)
const showConfidence = ref(false)
const showReasons = ref(false)
const showAngles = ref(false)

const shotTypeName = () => {
  return SHOT_TYPE_NAMES[normalizeShotType(props.analysis?.shotType)]
  const names: Record<string, string> = {
    OneMotion: '1段式投篮',
    OnePointFiveMotion: '1.5段式投篮',
    TwoMotion: '2段式投篮'
  }
  return names[props.analysis?.shotType] || props.analysis?.shotType
}

const getShotTypeBadgeVariant = (): 'excellent' | 'good' | 'average' | 'poor' | 'secondary' => {
  const variantsByType: Record<ShotType, 'excellent' | 'good' | 'average' | 'poor' | 'secondary'> = {
    one_motion: 'excellent',
    one_point_five_motion: 'good',
    two_motion: 'average',
    unknown: 'secondary'
  }
  return variantsByType[normalizeShotType(props.analysis?.shotType)]
  const variants: Record<string, 'excellent' | 'good' | 'average' | 'poor'> = {
    OneMotion: 'excellent',
    OnePointFiveMotion: 'good',
    TwoMotion: 'average'
  }
  return variants[props.analysis?.shotType] || 'good'
}

const shotTypeGuidance = () => {
  return getShotTypeGuidance(props.analysis?.shotType, props.analysis?.shotTypeConfidence ?? 0)
}

const shotConfidenceHint =
  '关键点可靠度看骨骼点识别稳不稳，分型确定度看这次一段式或二段式判断有多稳。'

watch(() => props.visible, (val) => {
  if (val) {
    startAnimation()
  } else {
    resetAnimation()
  }
})

const startAnimation = () => {
  setTimeout(() => { showContent.value = true }, 100)
  setTimeout(() => { showShotType.value = true }, 300)
  setTimeout(() => { showConfidence.value = true }, 500)
  setTimeout(() => { showReasons.value = true }, 700)
  setTimeout(() => { showAngles.value = true }, 900)
}

const resetAnimation = () => {
  showContent.value = false
  showShotType.value = false
  showConfidence.value = false
  showReasons.value = false
  showAngles.value = false
}

onMounted(() => {
  if (props.visible) {
    startAnimation()
  }
})
</script>

<template>
  <div class="space-y-6">
    <Card class="transition-all duration-500" :class="showContent ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <span v-if="!showShotType" class="skeleton h-6 w-24 rounded"></span>
          <span v-else>投篮类型</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div class="flex items-center gap-4">
          <template v-if="!showShotType">
            <div class="skeleton h-8 w-28 rounded-full"></div>
            <div class="skeleton h-4 w-40 rounded"></div>
          </template>
          <template v-else>
            <Badge :variant="getShotTypeBadgeVariant()" class="text-base px-5 py-2 animate-fade-in">
              {{ shotTypeName() }}
            </Badge>
          </template>
          
          <template v-if="showConfidence">
            <div class="flex items-center gap-3 animate-fade-in">
              <span class="text-sm text-[var(--text-secondary)]">分型确定度:</span>
              <Progress :value="analysis.shotTypeConfidence * 100" class="w-28" />
              <span class="text-sm font-medium text-[var(--text-primary)]">{{ (analysis.shotTypeConfidence * 100).toFixed(1) }}%</span>
            </div>
          </template>
        </div>

        <p v-if="showConfidence" class="mt-3 text-xs leading-6 text-[var(--text-muted)] animate-fade-in">
          {{ shotConfidenceHint }}
        </p>

        <div
          v-if="showShotType && shotTypeGuidance()"
          class="mt-4 rounded-xl border border-dashed border-[var(--primary-color)]/25 bg-[var(--glass-sm)] px-4 py-3 text-sm leading-6 text-[var(--text-primary)]"
        >
          {{ shotTypeGuidance() }}
        </div>
        
        <Separator class="my-4" />
        
        <div class="space-y-2">
          <template v-if="!showReasons">
            <div class="skeleton h-4 w-full rounded"></div>
            <div class="skeleton h-4 w-3/4 rounded"></div>
            <div class="skeleton h-4 w-5/6 rounded"></div>
          </template>
          <template v-else>
            <p 
              v-for="(reason, index) in analysis.shotTypeReasons" 
              :key="reason"
              class="text-sm text-[var(--text-secondary)] pl-3 border-l-2 border-[var(--primary-color)]/30 animate-slide-up"
              :style="{ animationDelay: `${index * 100}ms` }"
            >
              {{ reason }}
            </p>
          </template>
        </div>
      </CardContent>
    </Card>

    <Card class="transition-all duration-500" :class="showAngles ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'">
      <CardHeader>
        <CardTitle>关节角度数据</CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="!showAngles" class="space-y-4">
          <div class="skeleton h-8 w-full rounded"></div>
          <div class="skeleton h-32 w-full rounded-xl"></div>
          <div class="grid grid-cols-3 gap-4">
            <div class="skeleton h-16 rounded-lg"></div>
            <div class="skeleton h-16 rounded-lg"></div>
            <div class="skeleton h-16 rounded-lg"></div>
          </div>
        </div>
        <div v-else class="animate-fade-in">
          <slot name="angles"></slot>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    var(--glass-xs) 25%,
    var(--glass-sm) 50%,
    var(--glass-xs) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
</style>
