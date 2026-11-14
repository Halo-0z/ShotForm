<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { AnalysisHistory } from "@/types"
import { getAngleDisplayName } from "@/types"
import { compareTrainingAngles, recordFrame } from "@/lib/training-comparison.js"
import { buildTrainingReport, saveReportFile } from "@/lib/training-report"
import { Button } from "@/components/ui/button"
const props = defineProps<{ records: AnalysisHistory[] }>()
const emit = defineEmits<{ close: [] }>()
const ordered = computed(() =>
    [...props.records].sort(
        (a, b) =>
            (a.trainingDate || "").localeCompare(b.trainingDate || "") || a.createdAt - b.createdAt,
    ),
)
const indexes = ref([0, 0])
watch(
    () => ordered.value.map((r) => r.id).join(","),
    () => {
        indexes.value = ordered.value.map((r) => r.videoAnalysis?.bestFrameIndex ?? 0)
    },
    { immediate: true },
)
const selected = computed(() => ordered.value.map((r, i) => recordFrame(r, indexes.value[i])))
const rows = computed(() =>
    selected.value.length === 2
        ? compareTrainingAngles(
              selected.value[0].analysis.angles,
              selected.value[1].analysis.angles,
          )
        : [],
)
const show = (value: number | null) =>
    value == null || !Number.isFinite(value) ? "—" : value.toFixed(1)
const message = ref(""),
    busy = ref(false)
async function exportReport() {
    if (ordered.value.length !== 2 || ordered.value[0].id === ordered.value[1].id) return
    busy.value = true
    message.value = ""
    try {
        message.value = (await saveReportFile(
            buildTrainingReport(
                ordered.value[0],
                ordered.value[1],
                indexes.value[0],
                indexes.value[1],
            ),
            "html",
            "训练对比",
        ))
            ? "报告已导出"
            : "已取消导出"
    } catch (e) {
        message.value = `导出失败：${String(e)}`
    } finally {
        busy.value = false
    }
}
</script>
<template>
    <section class="training-comparison" data-allow-copy="true" aria-label="两次训练对比">
        <div class="flex justify-between gap-3">
            <h2>两次训练对比</h2>
            <Button variant="outline" size="sm" @click="emit('close')">清空选择</Button>
        </div>
        <p>
            选择同一训练者、相近拍摄条件的两条记录，并手动对齐动作阶段。变化值＝后一次－前一次，不代表进步评分。
        </p>
        <div class="training-comparison__pair">
            <article v-for="(record, side) in ordered" :key="record.id">
                <h3>
                    {{ side === 0 ? "前一次" : "后一次" }} · {{ record.trainingDate }} · #{{
                        record.id
                    }}
                </h3>
                <img :src="selected[side].image" :alt="side === 0 ? '前一次姿态' : '后一次姿态'" />
                <label v-if="record.videoAnalysis?.frames.length"
                    >动作帧
                    <select
                        v-model.number="indexes[side]"
                        :aria-label="side === 0 ? '前一次动作帧' : '后一次动作帧'"
                    >
                        <option
                            v-for="(frame, index) in record.videoAnalysis.frames"
                            :key="index"
                            :value="index"
                        >
                            第 {{ index + 1 }} 帧 · {{ (frame.timestampMs / 1000).toFixed(2) }} 秒
                        </option>
                    </select>
                </label>
                <p>{{ record.notes || "无训练备注" }}</p>
            </article>
        </div>
        <div class="training-comparison__table">
            <table>
                <thead>
                    <tr>
                        <th>指标</th>
                        <th>前一次</th>
                        <th>后一次</th>
                        <th>变化（°）</th>
                        <th>说明</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in rows" :key="row.name">
                        <td>{{ getAngleDisplayName(row.name) }}</td>
                        <td>{{ show(row.before) }}°</td>
                        <td>{{ show(row.after) }}°</td>
                        <td>{{ show(row.delta) }}</td>
                        <td>{{ row.reason || "可比较" }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="training-comparison__chart" aria-label="角度变化图">
            <div
                v-for="row in rows.filter((r) => r.delta != null)"
                :key="row.name"
                class="training-comparison__bar"
            >
                <span>{{ getAngleDisplayName(row.name) }}</span>
                <div
                    class="delta-track"
                    :aria-label="getAngleDisplayName(row.name) + '变化 ' + show(row.delta) + '度'"
                >
                    <span
                        :style="{
                            left:
                                (row.delta ?? 0) < 0
                                    ? `${50 - Math.abs(row.delta ?? 0) / 3.6}%`
                                    : '50%',
                            width: `${Math.abs(row.delta ?? 0) / 3.6}%`,
                        }"
                    />
                </div>
                <span>{{ show(row.delta) }}°</span>
            </div>
        </div>
        <p v-if="!rows.length">没有可展示的角度。</p>
        <Button :disabled="busy || records.length !== 2" @click="exportReport">导出对比报告</Button>
        <p role="status">{{ message }}</p>
    </section>
</template>
<style scoped>
.training-comparison {
    padding: 24px;
    border: 1px solid var(--surface-border);
    border-radius: 16px;
    background: var(--card-bg);
    margin: 20px 0;
    color: var(--text-primary);
}
h2 {
    font-size: 20px;
    font-weight: 700;
}
h3 {
    font-weight: 600;
    margin: 12px 0;
}
p {
    margin: 12px 0;
    color: var(--text-secondary);
    overflow-wrap: anywhere;
}
.training-comparison__pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}
.training-comparison__pair img {
    width: 100%;
    height: 260px;
    object-fit: contain;
    background: var(--background);
    border-radius: 8px;
}
select {
    max-width: 100%;
    padding: 8px;
    background: var(--background);
    color: var(--text-primary);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
}
.training-comparison__table {
    overflow: auto;
    margin: 20px 0;
}
table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
}
th,
td {
    text-align: left;
    padding: 10px;
    border-bottom: 1px solid var(--surface-border);
}
.training-comparison__chart {
    margin: 18px 0;
}
.training-comparison__bar {
    display: grid;
    grid-template-columns: 130px 1fr 70px;
    align-items: center;
    gap: 12px;
    margin: 8px 0;
}
.delta-track {
    position: relative;
    height: 12px;
    background: var(--background);
    border-radius: 4px;
}
.delta-track:after {
    content: "";
    position: absolute;
    left: 50%;
    height: 100%;
    border-left: 1px solid var(--text-muted);
}
.delta-track span {
    position: absolute;
    height: 100%;
    background: #5d7396;
    border-radius: 3px;
}
@media (max-width: 720px) {
    .training-comparison__pair {
        grid-template-columns: 1fr;
    }
}
</style>
