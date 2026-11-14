<script setup lang="ts">
import { ref } from "vue"
import type { AnalysisHistory } from "@/types"
import { useAnalysisStore } from "@/stores/analysis"
import { localDate } from "@/lib/training-comparison.js"
import { Button } from "@/components/ui/button"
const props = defineProps<{ record: AnalysisHistory }>()
const emit = defineEmits<{ saved: []; cancel: [] }>()
const store = useAnalysisStore()
const date = ref(props.record.trainingDate || localDate(props.record.createdAt))
const notes = ref(props.record.notes || "")
const tags = ref((props.record.tags || []).join("，"))
const busy = ref(false),
    error = ref("")
async function save() {
    busy.value = true
    error.value = ""
    try {
        await store.updateTrainingMetadata(props.record.id, date.value, notes.value, [
            ...new Set(
                tags.value
                    .split(/[,，]/)
                    .map((t) => t.trim())
                    .filter(Boolean),
            ),
        ])
        emit("saved")
    } catch (e) {
        error.value = String(e)
    } finally {
        busy.value = false
    }
}
</script>
<template>
    <form class="training-editor" @submit.prevent="save">
        <label>训练日期<input v-model="date" type="date" required aria-label="训练日期" /></label>
        <label
            >标签（逗号分隔，最多 10 个）<input
                v-model="tags"
                aria-label="训练标签"
                placeholder="如：定点投篮，肘部练习"
        /></label>
        <label
            >训练备注<textarea
                v-model="notes"
                maxlength="2000"
                rows="3"
                aria-label="训练备注"
                placeholder="练习内容、感受与发现的问题"
            />
        </label>
        <p v-if="error" role="alert">{{ error }}</p>
        <div class="flex gap-2">
            <Button type="submit" :disabled="busy">{{ busy ? "保存中…" : "保存训练信息" }}</Button
            ><Button type="button" variant="outline" :disabled="busy" @click="emit('cancel')"
                >取消</Button
            >
        </div>
    </form>
</template>
<style scoped>
.training-editor {
    display: grid;
    gap: 12px;
    padding: 20px;
    margin: 12px 0;
    background: var(--card-bg);
    border: 1px solid var(--surface-border);
    border-radius: 12px;
}
.training-editor label {
    display: grid;
    gap: 6px;
    font-size: 14px;
}
.training-editor input,
.training-editor textarea {
    padding: 9px;
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    background: var(--background);
    color: var(--text-primary);
}
[role="alert"] {
    color: var(--color-danger);
}
</style>
