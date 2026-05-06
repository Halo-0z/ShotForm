<script setup lang="ts">
import { computed } from "vue"
import type { JointAngle } from "@/types"
import { getAngleDisplayName } from "@/types"

interface Props {
    angles: JointAngle[]
}

const props = defineProps<Props>()

const chartData = computed(() => {
    return props.angles
        .filter((a) => a.value > 0)
        .map((a) => ({
            name: getAngleDisplayName(a.name),
            value: a.value,
            normalMin: a.normalRange[0],
            normalMax: a.normalRange[1],
            status: a.status,
        }))
})

const maxAngle = computed(() => {
    const allValues = chartData.value.flatMap((d) => [d.value, d.normalMax])
    const max = Math.max(...allValues, 0)
    return Math.ceil(max / 30) * 30
})
</script>

<template>
    <div class="angle-chart">
        <div class="angle-chart__bars">
            <div v-for="(item, idx) in chartData" :key="idx" class="angle-chart__bar-group">
                <div class="angle-chart__bar-track">
                    <div
                        class="angle-chart__normal-range"
                        :style="{
                            bottom: `${(item.normalMin / maxAngle) * 100}%`,
                            height: `${((item.normalMax - item.normalMin) / maxAngle) * 100}%`,
                        }"
                    />
                    <div
                        class="angle-chart__bar"
                        :class="`angle-chart__bar--${item.status === 'normal' ? 'good' : item.status === 'warning' ? 'warning' : 'error'}`"
                        :style="{ height: `${(item.value / maxAngle) * 100}%` }"
                    />
                </div>
                <span class="angle-chart__bar-label">{{ item.name }}</span>
            </div>
        </div>

        <svg class="angle-chart__axis-y" width="36" :height="180">
            <line x1="30" y1="0" x2="30" y2="180" stroke="var(--surface-border)" stroke-width="1" />
            <text x="24" y="8" text-anchor="end" fill="var(--text-muted)" font-size="10">
                {{ maxAngle }}
            </text>
            <text x="24" y="94" text-anchor="end" fill="var(--text-muted)" font-size="10">
                {{ Math.round(maxAngle / 2) }}
            </text>
            <text x="24" y="180" text-anchor="end" fill="var(--text-muted)" font-size="10">0</text>
            <line
                x1="30"
                y1="90"
                x2="36"
                y2="90"
                stroke="var(--surface-border)"
                stroke-width="1"
                stroke-dasharray="3 3"
            />
            <line x1="30" y1="0" x2="36" y2="0" stroke="var(--surface-border)" stroke-width="1" />
            <line
                x1="30"
                y1="180"
                x2="36"
                y2="180"
                stroke="var(--surface-border)"
                stroke-width="1"
            />
        </svg>

        <div class="angle-chart__legend">
            <span class="angle-chart__legend-item">
                <span class="angle-chart__legend-swatch angle-chart__legend-swatch--good" />
                正常范围
            </span>
            <span class="angle-chart__legend-item">
                <span class="angle-chart__legend-swatch angle-chart__legend-swatch--warning" />
                偏差一般
            </span>
            <span class="angle-chart__legend-item">
                <span class="angle-chart__legend-swatch angle-chart__legend-swatch--error" />
                偏差较大
            </span>
        </div>
    </div>
</template>

<style scoped>
.angle-chart {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    padding: 8px 0;
}

.angle-chart__bars {
    display: flex;
    gap: 10px;
    flex: 1;
    justify-content: space-around;
    align-items: flex-end;
}

.angle-chart__bar-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.angle-chart__bar-track {
    position: relative;
    width: 32px;
    height: 180px;
    background: color-mix(in srgb, var(--text-muted) 8%, transparent);
    border-radius: 4px;
}

.angle-chart__normal-range {
    position: absolute;
    left: 0;
    right: 0;
    background: color-mix(in srgb, var(--color-success) 16%, transparent);
    border: 1px dashed color-mix(in srgb, var(--color-success) 40%, transparent);
    border-radius: 2px;
}

.angle-chart__bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    border-radius: 4px 4px 0 0;
    transition: height 300ms ease;
}

.angle-chart__bar--good {
    background: var(--color-success);
}

.angle-chart__bar--warning {
    background: var(--color-warning);
}

.angle-chart__bar--error {
    background: var(--color-danger);
}

.angle-chart__bar-label {
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
    max-width: 64px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.angle-chart__legend {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
}

.angle-chart__legend-item {
    font-size: 11px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
}

.angle-chart__legend-swatch {
    width: 12px;
    height: 8px;
    border-radius: 2px;
    flex-shrink: 0;
}

.angle-chart__legend-swatch--good {
    background: var(--color-success);
}

.angle-chart__legend-swatch--warning {
    background: var(--color-warning);
}

.angle-chart__legend-swatch--error {
    background: var(--color-danger);
}
</style>
