<script setup lang="ts">
import { computed } from "vue"
import type { CorrectionSuggestion } from "@/types"
import { AlertTriangle } from "lucide-vue-next"

interface Props {
    suggestions: CorrectionSuggestion[]
    count: number
}

const props = defineProps<Props>()

const displaySuggestions = computed(() => {
    if (props.suggestions && props.suggestions.length > 0) {
        return props.suggestions
    }
    return [
        {
            bodyPart: "躯干",
            issue: "躯干前倾偏大",
            suggestion: "适当收紧核心，保持躯干直立稳定。",
            priority: "high" as const,
        },
        {
            bodyPart: "手肘",
            issue: "手肘偏外",
            suggestion: "投篮时手肘尽量对准篮筐，提升投篮一致性。",
            priority: "medium" as const,
        },
    ]
})

const getPriorityLabel = (priority: string) => {
    if (priority === "high") return "高优先级"
    if (priority === "medium") return "中优先级"
    return "低优先级"
}

const getPriorityClass = (priority: string) => {
    if (priority === "high") return "analysis-suggestion--high"
    if (priority === "medium") return "analysis-suggestion--medium"
    return "analysis-suggestion--low"
}
</script>

<template>
    <div class="analysis-suggestion-list">
        <div
            v-for="(suggestion, idx) in displaySuggestions"
            :key="idx"
            class="analysis-suggestion"
            :class="getPriorityClass(suggestion.priority)"
        >
            <div class="analysis-suggestion__header">
                <div class="analysis-suggestion__body-part">
                    <AlertTriangle class="h-4 w-4" />
                    <span>{{ suggestion.bodyPart }}</span>
                </div>
                <span class="analysis-suggestion__priority-label">{{
                    getPriorityLabel(suggestion.priority)
                }}</span>
            </div>
            <div class="analysis-suggestion__issue">问题：{{ suggestion.issue }}</div>
            <div class="analysis-suggestion__suggestion-text">
                建议：{{ suggestion.suggestion }}
            </div>
        </div>

        <button class="analysis-suggestion__generate-btn">生成完整 AI 报告</button>
    </div>
</template>

<style scoped>
.analysis-suggestion-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.analysis-suggestion {
    padding: 14px;
    border-radius: 10px;
    border: 1px solid var(--surface-border);
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.analysis-suggestion--high {
    background: color-mix(in srgb, var(--color-danger) 4%, var(--bg-solid));
    border-color: color-mix(in srgb, var(--color-danger) 16%, var(--surface-border));
}

.analysis-suggestion--medium {
    background: color-mix(in srgb, var(--color-warning) 4%, var(--bg-solid));
    border-color: color-mix(in srgb, var(--color-warning) 16%, var(--surface-border));
}

.analysis-suggestion--low {
    border-color: var(--surface-border);
}

.analysis-suggestion__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.analysis-suggestion__body-part {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
}

.analysis-suggestion__body-part svg {
    color: var(--color-warning);
}

.analysis-suggestion__priority-label {
    font-size: 11px;
    color: var(--text-muted);
}

.analysis-suggestion__issue {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.55;
}

.analysis-suggestion__suggestion-text {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.55;
}

.analysis-suggestion__generate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    border-radius: 10px;
    border: 1px solid var(--surface-border);
    background: var(--bg-solid);
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all 160ms ease;
}

.analysis-suggestion__generate-btn:hover {
    border-color: var(--accent-color);
    color: var(--accent-color);
}
</style>
