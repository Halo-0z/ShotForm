<script setup lang="ts">
import { computed } from "vue"
import type { JointAngle } from "@/types"
import { getAngleDisplayName } from "@/types"
import { AlertTriangle } from "lucide-vue-next"

interface Props {
    angles: JointAngle[]
}

const props = defineProps<Props>()

const displayAngles = computed(() => {
    return props.angles
        .filter((a) => a.value > 0)
        .map((a) => {
            const deviation = getDeviation(a.value, a.normalRange[0], a.normalRange[1])
            return {
                name: getAngleDisplayName(a.name),
                value: Math.round(a.value * 10) / 10,
                normalMin: a.normalRange[0],
                normalMax: a.normalRange[1],
                deviation,
                status: a.status,
            }
        })
})

const getDeviation = (value: number, min: number, max: number) => {
    if (value >= min && value <= max) {
        return { amount: 0, label: "表现良好", type: "normal" as const }
    }
    const distToMin = Math.abs(value - min)
    const distToMax = Math.abs(value - max)
    const amount = Math.min(distToMin, distToMax)
    const direction = value < min ? "偏低" : "偏高"
    const displayAmount = Math.round(amount * 10) / 10

    if (amount > 20) {
        return {
            amount: displayAmount,
            label: `${direction} ${displayAmount}°`,
            type: "error" as const,
        }
    }
    return {
        amount: displayAmount,
        label: `${direction} ${displayAmount}°`,
        type: "warning" as const,
    }
}

const cardClass = (type: string) => {
    if (type === "error") return "analysis-deviation-card--error"
    if (type === "warning") return "analysis-deviation-card--warning"
    return "analysis-deviation-card--normal"
}

const cardLabelClass = (type: string) => {
    if (type === "error") return "text-red-500"
    if (type === "warning") return "text-amber-500"
    return "text-green-500"
}
</script>

<template>
    <div class="analysis-deviation-cards">
        <div
            v-for="(angle, idx) in displayAngles"
            :key="idx"
            class="analysis-deviation-card"
            :class="cardClass(angle.deviation.type)"
        >
            <div class="analysis-deviation-card__header">
                <span class="analysis-deviation-card__name">{{ angle.name }}</span>
                <AlertTriangle
                    v-if="angle.deviation.type !== 'normal'"
                    class="h-3.5 w-3.5"
                    :class="cardLabelClass(angle.deviation.type)"
                />
            </div>
            <div class="analysis-deviation-card__value">{{ angle.value }}°</div>
            <div class="analysis-deviation-card__standard">
                标准 {{ angle.normalMin }}°~{{ angle.normalMax }}°
            </div>
            <div
                class="analysis-deviation-card__deviation"
                :class="cardLabelClass(angle.deviation.type)"
            >
                {{ angle.deviation.label }}
            </div>
        </div>
    </div>
</template>

<style scoped>
.analysis-deviation-cards {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
}

.analysis-deviation-card {
    padding: 12px;
    border-radius: 10px;
    border: 1px solid var(--surface-border);
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.analysis-deviation-card--error {
    background: color-mix(in srgb, var(--color-danger) 6%, var(--bg-solid));
    border-color: color-mix(in srgb, var(--color-danger) 20%, var(--surface-border));
}

.analysis-deviation-card--warning {
    background: color-mix(in srgb, var(--color-warning) 6%, var(--bg-solid));
    border-color: color-mix(in srgb, var(--color-warning) 20%, var(--surface-border));
}

.analysis-deviation-card--normal {
    background: color-mix(in srgb, var(--color-success) 4%, var(--bg-solid));
}

.analysis-deviation-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.analysis-deviation-card__name {
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 600;
}

.analysis-deviation-card__value {
    font-size: 18px;
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1;
}

.analysis-deviation-card__standard {
    font-size: 11px;
    color: var(--text-muted);
}

.analysis-deviation-card__deviation {
    font-size: 12px;
    font-weight: 600;
}
</style>
