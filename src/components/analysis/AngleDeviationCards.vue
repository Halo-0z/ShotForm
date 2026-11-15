<script setup lang="ts">
import { computed } from "vue"
import type { JointAngle } from "@/types"
import { getAngleDisplayName } from "@/types"
const props = defineProps<{ angles: JointAngle[] }>()
const rows = computed(() =>
    props.angles
        .filter((a) => Number.isFinite(a.value))
        .map((a) => {
            const reliable = a.status !== "low_confidence" && a.value > 0
            const difference =
                a.value < a.normalRange[0]
                    ? a.value - a.normalRange[0]
                    : a.value > a.normalRange[1]
                      ? a.value - a.normalRange[1]
                      : 0
            return { ...a, reliable, label: getAngleDisplayName(a.name), difference }
        }),
)
</script>
<template>
    <div class="analysis-deviation-cards">
        <div v-for="angle in rows" :key="angle.name" class="angle-reading">
            <div>
                <span>{{ angle.label }}</span
                ><small>{{
                    angle.reliable
                        ? `参考 ${angle.normalRange[0]}°–${angle.normalRange[1]}°`
                        : "识别不稳定，暂不判断"
                }}</small>
            </div>
            <div
                class="angle-reading__value"
                :class="{ 'is-deviation': angle.reliable && angle.difference !== 0 }"
            >
                <strong>{{ angle.reliable ? `${angle.value.toFixed(1)}°` : "—" }}</strong
                ><small v-if="angle.reliable">{{
                    angle.difference === 0
                        ? "位于参考范围"
                        : `${angle.difference < 0 ? "低于" : "高于"}参考 ${Math.abs(angle.difference).toFixed(1)}°`
                }}</small>
            </div>
        </div>
        <p v-if="!rows.length">当前帧没有可用的角度数据。</p>
    </div>
</template>
<style scoped>
.analysis-deviation-cards {
    display: grid;
    gap: 0;
}
.angle-reading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid var(--divider-color);
}
.angle-reading:last-child {
    border-bottom: 0;
}
.angle-reading span {
    font-size: 14px;
}
.angle-reading small {
    display: block;
    margin-top: 4px;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.6;
}
.angle-reading__value {
    text-align: right;
}
.angle-reading strong {
    font-size: 21px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
}
.angle-reading__value.is-deviation strong {
    color: var(--evidence-text);
}
p {
    font-size: 13px;
    color: var(--text-secondary);
}
</style>
