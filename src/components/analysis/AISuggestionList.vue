<script setup lang="ts">
import type { CorrectionSuggestion } from "@/types"
import { AlertTriangle, Sparkles } from "lucide-vue-next"

interface CoachingSource {
    data: CorrectionSuggestion[]
    summary: string
    state: "idle" | "loading" | "done" | "error"
    error: string
}

interface Props {
    ruleSource: CoachingSource
    aiSource: CoachingSource
}

defineProps<Props>()
const emit = defineEmits<{
    (e: "generate"): void
}>()

const getPriorityLabel = (priority: string) => {
    if (priority === "high") return "高优先级"
    if (priority === "medium") return "中优先级"
    return "低优先级"
}

const getPriorityClass = (priority: string, prefix = "analysis-suggestion") => {
    if (priority === "high") return `${prefix}--high`
    if (priority === "medium") return `${prefix}--medium`
    return `${prefix}--low`
}
</script>

<template>
    <div class="analysis-suggestion-list">
        <!-- 本地规则分析 -->
        <div v-if="ruleSource.state === 'loading'" class="analysis-suggestion__section-label">
            正在加载规则分析...
        </div>
        <template v-if="ruleSource.data.length > 0">
            <div class="analysis-suggestion__section-header">
                <AlertTriangle class="h-4 w-4" />
                <span>本地规则分析</span>
            </div>
            <p v-if="ruleSource.summary" class="analysis-suggestion__section-summary">
                {{ ruleSource.summary }}
            </p>
            <div
                v-for="(suggestion, idx) in ruleSource.data"
                :key="'rule-' + idx"
                class="analysis-suggestion"
                :class="getPriorityClass(suggestion.priority)"
            >
                <div class="analysis-suggestion__header">
                    <div class="analysis-suggestion__body-part">
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
        </template>
        <div v-else-if="ruleSource.state === 'done'" class="analysis-suggestion__empty">
            当前姿态未检测到明显偏差，整体表现良好。
        </div>

        <!-- AI 深度分析 -->
        <template v-if="aiSource.state === 'done' && aiSource.data.length > 0">
            <div
                class="analysis-suggestion__section-header analysis-suggestion__section-header--ai"
            >
                <Sparkles class="h-4 w-4" />
                <span>AI 深度分析</span>
            </div>
            <p
                v-if="aiSource.summary"
                class="analysis-suggestion__section-summary analysis-suggestion__section-summary--ai"
            >
                {{ aiSource.summary }}
            </p>
            <div
                v-for="(suggestion, idx) in aiSource.data"
                :key="'ai-' + idx"
                class="analysis-suggestion analysis-suggestion--ai"
                :class="getPriorityClass(suggestion.priority, 'analysis-suggestion--ai')"
            >
                <div class="analysis-suggestion__header">
                    <div class="analysis-suggestion__body-part">
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
        </template>

        <!-- AI 错误提示 -->
        <div v-if="aiSource.state === 'error'" class="analysis-suggestion__error">
            AI 分析失败：{{ aiSource.error }}
        </div>

        <!-- 生成按钮 -->
        <button
            v-if="aiSource.state !== 'done'"
            class="analysis-suggestion__generate-btn"
            :disabled="aiSource.state === 'loading'"
            @click="emit('generate')"
        >
            {{ aiSource.state === "loading" ? "生成中..." : "生成完整 AI 报告" }}
        </button>
        <button v-else class="analysis-suggestion__generate-btn" @click="emit('generate')">
            重新生成 AI 报告
        </button>
    </div>
</template>

<style scoped>
.analysis-suggestion-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.analysis-suggestion__section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-top: 4px;
}

.analysis-suggestion__section-header--ai {
    color: var(--accent-color);
}

.analysis-suggestion__section-summary {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
}

.analysis-suggestion__section-summary--ai {
    padding: 10px 12px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--accent-color) 6%, var(--bg-solid));
    border-left: 3px solid var(--accent-color);
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

/* AI 建议卡片样式 */
.analysis-suggestion--ai {
    border-left: 3px solid var(--accent-color);
}

.analysis-suggestion--ai.analysis-suggestion--ai--high {
    background: color-mix(in srgb, var(--accent-color) 4%, var(--bg-solid));
    border-color: color-mix(in srgb, var(--accent-color) 20%, var(--surface-border));
    border-left: 3px solid var(--accent-color);
}

.analysis-suggestion--ai.analysis-suggestion--ai--medium {
    background: color-mix(in srgb, var(--accent-color) 3%, var(--bg-solid));
    border-color: color-mix(in srgb, var(--accent-color) 14%, var(--surface-border));
    border-left: 3px solid var(--accent-color);
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

.analysis-suggestion__empty {
    font-size: 12px;
    color: var(--text-muted);
    padding: 8px 0;
}

.analysis-suggestion__error {
    font-size: 12px;
    color: var(--color-danger);
    padding: 8px 12px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-danger) 6%, var(--bg-solid));
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

.analysis-suggestion__generate-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
</style>
