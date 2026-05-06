<script setup lang="ts">
import { computed } from "vue"
import type { JointAngle } from "@/types"
import { getAngleDisplayName } from "@/types"
import { AlertTriangle, Check, TrendingDown, TrendingUp } from "lucide-vue-next"

const props = defineProps<{
    angles: JointAngle[]
    comparisonAngles?: JointAngle[] | null
}>()

interface AngleDeviation {
    name: string
    displayName: string
    value: number
    normalRange: [number, number]
    deviation: number
    status: "good" | "warning" | "bad"
}

const deviations = computed<AngleDeviation[]>(() => {
    return props.angles
        .map((angle) => {
            const [min, max] = angle.normalRange
            const range = max - min
            let deviation = 0
            let status: AngleDeviation["status"] = "good"

            if (angle.value < min) {
                deviation = angle.value - min
                const ratio = Math.abs(deviation) / (range * 0.5 || 1)
                status = ratio > 1 ? "bad" : "warning"
            } else if (angle.value > max) {
                deviation = angle.value - max
                const ratio = Math.abs(deviation) / (range * 0.5 || 1)
                status = ratio > 1 ? "bad" : "warning"
            }

            return {
                name: angle.name,
                displayName: getAngleDisplayName(angle.name),
                value: angle.value,
                normalRange: angle.normalRange,
                deviation,
                status,
            }
        })
        .sort((a, b) => {
            const order = { bad: 0, warning: 1, good: 2 }
            return order[a.status] - order[b.status]
        })
})

const hasIssues = computed(() => deviations.value.some((d) => d.status !== "good"))

const statusClass = {
    good: "deviation-item--good",
    warning: "deviation-item--warning",
    bad: "deviation-item--bad",
} as const
</script>

<template>
    <div v-if="angles.length" class="deviation-panel">
        <div class="deviation-panel__header">
            <h4 class="deviation-panel__title">关键角度偏差</h4>
            <span v-if="!hasIssues" class="deviation-panel__all-clear">
                <Check class="h-3.5 w-3.5" />
                全部在正常范围内
            </span>
        </div>

        <div class="deviation-panel__grid">
            <div
                v-for="d in deviations"
                :key="d.name"
                class="deviation-item"
                :class="statusClass[d.status]"
            >
                <div class="deviation-item__head">
                    <AlertTriangle v-if="d.status === 'bad'" class="h-3.5 w-3.5" />
                    <span class="deviation-item__name">{{ d.displayName }}</span>
                </div>
                <div class="deviation-item__value">
                    <span class="deviation-item__current">{{ d.value.toFixed(1) }}°</span>
                    <span class="deviation-item__range">
                        {{ d.normalRange[0].toFixed(0) }}°–{{ d.normalRange[1].toFixed(0) }}°
                    </span>
                </div>
                <div v-if="d.status !== 'good'" class="deviation-item__hint">
                    <TrendingDown v-if="d.deviation < 0" class="h-3 w-3" />
                    <TrendingUp v-else class="h-3 w-3" />
                    {{ d.deviation < 0 ? "偏低" : "偏高" }}
                    {{ Math.abs(d.deviation).toFixed(1) }}°
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.deviation-panel {
    margin-top: 12px;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid color-mix(in srgb, var(--surface-border) 74%, transparent);
    background: color-mix(in srgb, var(--card-bg) 94%, var(--background));
}

.deviation-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
}

.deviation-panel__title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
}

.deviation-panel__all-clear {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--accent-color);
}

.deviation-panel__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
}

.deviation-item {
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid transparent;
    transition: background 0.15s ease;
}

.deviation-item--good {
    border-color: color-mix(in srgb, var(--accent-color) 18%, transparent);
    background: color-mix(in srgb, var(--accent-color) 6%, transparent);
}

.deviation-item--warning {
    border-color: color-mix(in srgb, var(--color-warning) 24%, transparent);
    background: color-mix(in srgb, var(--color-warning) 8%, transparent);
}

.deviation-item--bad {
    border-color: color-mix(in srgb, var(--color-danger) 22%, transparent);
    background: color-mix(in srgb, var(--color-danger) 6%, transparent);
}

.deviation-item__head {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 4px;
}

.deviation-item--bad .deviation-item__head {
    color: var(--color-danger);
}

.deviation-item--warning .deviation-item__head {
    color: var(--color-warning);
}

.deviation-item__name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
}

.deviation-item__value {
    display: flex;
    align-items: baseline;
    gap: 6px;
}

.deviation-item__current {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
}

.deviation-item__range {
    font-size: 11px;
    color: var(--text-muted);
}

.deviation-item__hint {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-top: 4px;
    font-size: 11px;
    font-weight: 600;
}

.deviation-item--bad .deviation-item__hint {
    color: var(--color-danger);
}

.deviation-item--warning .deviation-item__hint {
    color: var(--color-warning);
}
</style>
