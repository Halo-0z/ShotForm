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
    const max = Math.max(...allValues, 180)
    return Math.ceil(max / 30) * 30
})

const valuePct = (v: number) => `${(v / maxAngle.value) * 100}%`
</script>

<template>
    <div class="angle-chart">
        <div class="angle-chart__scale">
            <span>{{ maxAngle }}°</span>
            <span>{{ Math.round(maxAngle / 2) }}°</span>
            <span>0°</span>
        </div>

        <div class="angle-chart__bars">
            <div v-for="(item, idx) in chartData" :key="idx" class="angle-chart__col">
                <div class="angle-chart__track">
                    <div
                        class="angle-chart__normal-band"
                        :style="{
                            bottom: valuePct(item.normalMin),
                            top: `calc(100% - ${valuePct(item.normalMax)})`,
                        }"
                    />
                    <div
                        class="angle-chart__bar"
                        :class="`angle-chart__bar--${item.status}`"
                        :style="{ height: valuePct(item.value) }"
                    />
                    <span class="angle-chart__value" :class="`angle-chart__value--${item.status}`">
                        {{ item.value }}°
                    </span>
                </div>
                <span class="angle-chart__label">{{ item.name }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.angle-chart {
    display: flex;
    gap: 4px;
    padding: 8px 0 4px;
}

.angle-chart__scale {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-end;
    height: 200px;
    flex-shrink: 0;
    padding-bottom: 24px;
}

.angle-chart__scale span {
    font-size: 10px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    line-height: 1;
}

.angle-chart__bars {
    display: flex;
    gap: 12px;
    flex: 1;
    justify-content: space-around;
    align-items: flex-end;
}

.angle-chart__col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex: 1;
    max-width: 72px;
}

.angle-chart__track {
    position: relative;
    width: 100%;
    height: 200px;
    background: color-mix(in srgb, var(--text-muted) 6%, transparent);
    border-radius: 4px;
}

.angle-chart__normal-band {
    position: absolute;
    left: 0;
    right: 0;
    background: color-mix(in srgb, var(--color-success) 14%, transparent);
    border-left: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
    border-right: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
}

.angle-chart__bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    border-radius: 4px 4px 0 0;
    min-height: 4px;
    transition: height 400ms ease-out;
}

.angle-chart__bar--normal {
    background: var(--color-success);
}

.angle-chart__bar--warning {
    background: var(--color-warning);
}

.angle-chart__bar--error {
    background: var(--color-danger);
}

.angle-chart__value {
    position: absolute;
    top: -18px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

.angle-chart__value--normal {
    color: var(--color-success);
}

.angle-chart__value--warning {
    color: var(--color-warning);
}

.angle-chart__value--error {
    color: var(--color-danger);
}

.angle-chart__label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-align: center;
    line-height: 1.3;
}
</style>
