<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue"
import { invoke } from "@tauri-apps/api/core"
import { useRouter } from "vue-router"
import { Check, Loader2, PencilLine, Trash2, X } from "lucide-vue-next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PAGE_COVER_ART } from "@/lib/page-cover-art"
import { useAnalysisStore } from "@/stores/analysis"
import { getShotTypeName, type PlayerTemplate } from "@/types"

const router = useRouter()
const analysisStore = useAnalysisStore()

const templates = ref<PlayerTemplate[]>([])
const isLoadingTemplates = ref(false)
const isSaving = ref(false)
const isUpdatingTemplate = ref(false)
const deletingTemplateId = ref<number | null>(null)
const pendingDeleteTemplateId = ref<number | null>(null)
const editingTemplateId = ref<number | null>(null)
const loadError = ref("")
const saveError = ref("")
const saveSuccess = ref("")
const editError = ref("")
const editSuccess = ref("")
const deleteError = ref("")

const form = reactive({
    name: "",
    team: "",
    description: "",
})

const editForm = reactive({
    name: "",
    team: "",
    description: "",
})

const currentAnalysis = computed(() => analysisStore.currentAnalysis)
const currentVideoAnalysis = computed(() => analysisStore.currentVideoAnalysis)
const currentVideoTemplateProfile = computed(
    () => currentVideoAnalysis.value?.templateProfile ?? null,
)
const currentImage = computed(
    () => analysisStore.currentAnnotatedImage || analysisStore.currentImage,
)

const currentAnalysisSnapshot = computed(() => {
    if (!currentAnalysis.value) {
        return null
    }

    return {
        shotType: getShotTypeName(currentAnalysis.value.shotType),
        confidence: `${(currentAnalysis.value.shotTypeConfidence * 100).toFixed(1)}%`,
        angleCount: currentAnalysis.value.angles.length,
        keypointCount: currentAnalysis.value.poseData.keypoints.length,
    }
})

const canSaveTemplate = computed(() => {
    return Boolean(
        currentAnalysis.value &&
        currentVideoTemplateProfile.value &&
        form.name.trim() &&
        form.team.trim(),
    )
})

const canSaveTemplateEdits = computed(() => {
    return Boolean(editingTemplateId.value && editForm.name.trim() && editForm.team.trim())
})

const defaultDescription = () => {
    if (!currentAnalysis.value) {
        return ""
    }

    return `${getShotTypeName(currentAnalysis.value.shotType)}整段视频参考模板，采集于当前视频分析结果。`
}

const formatTemplateCoverage = (coverage?: number | null) => {
    if (typeof coverage !== "number" || !Number.isFinite(coverage)) {
        return "0%"
    }

    return `${(coverage * 100).toFixed(0)}%`
}

const applySortedTemplates = (response: PlayerTemplate[]) => {
    templates.value = [...response].sort((left, right) => left.id - right.id)
}

const resetForm = () => {
    form.name = ""
    form.team = ""
    form.description = defaultDescription()
}

const resetEditState = () => {
    editingTemplateId.value = null
    editForm.name = ""
    editForm.team = ""
    editForm.description = ""
    editError.value = ""
}

const clearLibraryFeedback = () => {
    editSuccess.value = ""
    editError.value = ""
    deleteError.value = ""
}

const loadTemplates = async () => {
    isLoadingTemplates.value = true
    loadError.value = ""

    try {
        const response = await invoke<PlayerTemplate[]>("get_player_templates_db")
        applySortedTemplates(response)

        if (
            editingTemplateId.value !== null &&
            !templates.value.some((template) => template.id === editingTemplateId.value)
        ) {
            resetEditState()
        }
    } catch (error) {
        loadError.value = error instanceof Error ? error.message : "球星模板加载失败，请稍后重试。"
    } finally {
        isLoadingTemplates.value = false
    }
}

const saveCurrentAnalysisAsTemplate = async () => {
    if (!currentAnalysis.value) {
        return
    }

    const templateProfile = currentVideoTemplateProfile.value
    if (!templateProfile) {
        saveError.value = "请先上传并分析一段球星投篮视频，再保存整段视频模板。"
        saveSuccess.value = ""
        return
    }

    if (!canSaveTemplate.value) {
        return
    }

    isSaving.value = true
    saveError.value = ""
    saveSuccess.value = ""

    try {
        const template = {
            id: 0,
            name: form.name.trim(),
            team: form.team.trim(),
            description: form.description.trim(),
            poseData: currentAnalysis.value.poseData,
            angles: currentAnalysis.value.angles,
            templateProfile: templateProfile,
        }

        const templateId = await invoke<number>("add_player_template", { template })
        saveSuccess.value = `视频模板已保存，编号 #${templateId}`
        editSuccess.value = ""
        await loadTemplates()
        resetForm()
    } catch (error) {
        saveError.value = error instanceof Error ? error.message : "模板保存失败，请稍后重试。"
    } finally {
        isSaving.value = false
    }
}

const startEditingTemplate = (template: PlayerTemplate) => {
    clearLibraryFeedback()
    pendingDeleteTemplateId.value = null
    editingTemplateId.value = template.id
    editForm.name = template.name
    editForm.team = template.team
    editForm.description = template.description ?? ""
}

const cancelEditingTemplate = () => {
    resetEditState()
}

const requestDeleteTemplate = (template: PlayerTemplate) => {
    clearLibraryFeedback()
    resetEditState()
    pendingDeleteTemplateId.value = template.id
}

const cancelDeleteTemplate = () => {
    pendingDeleteTemplateId.value = null
}

const saveTemplateEdits = async () => {
    if (!canSaveTemplateEdits.value || editingTemplateId.value === null) {
        return
    }

    const currentTemplate = templates.value.find(
        (template) => template.id === editingTemplateId.value,
    )
    if (!currentTemplate) {
        editError.value = "未找到正在编辑的模板，请刷新列表后重试。"
        return
    }

    isUpdatingTemplate.value = true
    clearLibraryFeedback()

    try {
        const payload = {
            id: currentTemplate.id,
            name: editForm.name.trim(),
            team: editForm.team.trim(),
            description: editForm.description.trim(),
        }

        await invoke<void>("update_player_template_metadata", { template: payload })
        applySortedTemplates(
            templates.value.map((entry) =>
                entry.id === payload.id
                    ? {
                          ...entry,
                          name: payload.name,
                          team: payload.team,
                          description: payload.description,
                      }
                    : entry,
            ),
        )
        editSuccess.value = `模板 #${payload.id} 已更新`
        resetEditState()
    } catch (error) {
        editError.value = error instanceof Error ? error.message : "模板更新失败，请稍后重试。"
    } finally {
        isUpdatingTemplate.value = false
    }
}

const confirmDeleteTemplate = async (template: PlayerTemplate) => {
    if (pendingDeleteTemplateId.value !== template.id) {
        return
    }

    deletingTemplateId.value = template.id
    clearLibraryFeedback()

    try {
        await invoke<void>("delete_player_template", { id: template.id })
        templates.value = templates.value.filter((entry) => entry.id !== template.id)
        if (editingTemplateId.value === template.id) {
            resetEditState()
        }
        pendingDeleteTemplateId.value = null
        editSuccess.value = `模板 #${template.id} 已删除`
    } catch (error) {
        deleteError.value = error instanceof Error ? error.message : "模板删除失败，请稍后重试。"
    } finally {
        deletingTemplateId.value = null
    }
}

const goToUpload = () => {
    router.push("/upload")
}

watch(
    currentAnalysis,
    (analysis) => {
        if (!analysis || form.description.trim()) {
            return
        }

        form.description = defaultDescription()
    },
    { immediate: true },
)

onMounted(() => {
    void loadTemplates()
})
</script>

<template>
    <div class="templates-page">
        <div
            class="templates-page__cover"
            :style="{ backgroundImage: `url(${PAGE_COVER_ART.compare})` }"
            aria-hidden="true"
        />
        <div class="templates-page__veil" aria-hidden="true" />

        <div class="templates-page__content">
            <header class="templates-page__header">
                <div class="templates-page__heading">
                    <p class="templates-page__eyebrow">TEMPLATES</p>
                    <h1 class="templates-page__title">球星模板管理</h1>
                    <p class="templates-page__summary">
                        管理员先上传并分析一段球星标准投篮视频，再将整段动作画像保存为模板，供后续球星对比直接复用。
                    </p>
                </div>

                <div class="templates-page__toolbar">
                    <Button variant="outline" @click="void loadTemplates()">刷新模板列表</Button>
                </div>
            </header>

            <section class="templates-page__grid">
                <Card class="templates-panel templates-panel--composer">
                    <CardHeader>
                        <CardTitle>从当前视频分析生成模板</CardTitle>
                        <CardDescription>
                            只支持完整投篮视频生成模板；单帧截图不再保存为球星模板。
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="templates-panel__content">
                        <div v-if="currentAnalysisSnapshot" class="templates-analysis">
                            <div class="templates-analysis__media">
                                <img
                                    v-if="currentImage"
                                    :src="currentImage"
                                    alt="当前分析预览"
                                    class="templates-analysis__image"
                                />
                                <div v-else class="templates-analysis__placeholder">
                                    当前分析结果可用，但暂无图像预览
                                </div>
                            </div>

                            <div class="templates-analysis__meta">
                                <div class="templates-analysis__metric">
                                    <span class="templates-analysis__label">投篮类型</span>
                                    <strong>{{ currentAnalysisSnapshot.shotType }}</strong>
                                </div>
                                <div class="templates-analysis__metric">
                                    <span class="templates-analysis__label">识别置信度</span>
                                    <strong>{{ currentAnalysisSnapshot.confidence }}</strong>
                                </div>
                                <div class="templates-analysis__metric">
                                    <span class="templates-analysis__label">角度数量</span>
                                    <strong>{{ currentAnalysisSnapshot.angleCount }}</strong>
                                </div>
                                <div class="templates-analysis__metric">
                                    <span class="templates-analysis__label">关键点数量</span>
                                    <strong>{{ currentAnalysisSnapshot.keypointCount }}</strong>
                                </div>
                                <div
                                    v-if="currentVideoTemplateProfile"
                                    class="templates-analysis__metric templates-analysis__metric--video"
                                >
                                    <span class="templates-analysis__label">视频采样</span>
                                    <strong
                                        >{{ currentVideoTemplateProfile.samplesUsed }} 帧</strong
                                    >
                                </div>
                                <div
                                    v-if="currentVideoTemplateProfile"
                                    class="templates-analysis__metric templates-analysis__metric--video"
                                >
                                    <span class="templates-analysis__label">动作覆盖</span>
                                    <strong>{{
                                        formatTemplateCoverage(currentVideoTemplateProfile.coverage)
                                    }}</strong>
                                </div>
                            </div>

                            <div
                                v-if="!currentVideoTemplateProfile"
                                class="templates-video-required"
                            >
                                <p class="templates-video-required__title">当前分析不是视频模板</p>
                                <p class="templates-video-required__body">
                                    球星模板现在只接受完整投篮视频分析结果。请上传库里、科比等球星的一段完整投篮视频，系统会抽取关键帧并保存整段动作画像。
                                </p>
                                <Button type="button" @click="goToUpload">上传完整投篮视频</Button>
                            </div>

                            <form
                                v-else
                                class="templates-form"
                                @submit.prevent="void saveCurrentAnalysisAsTemplate()"
                            >
                                <div class="templates-form__row">
                                    <div class="templates-form__field">
                                        <Label for="template-name">球星名称</Label>
                                        <Input
                                            id="template-name"
                                            v-model="form.name"
                                            placeholder="例如：斯蒂芬·库里"
                                        />
                                    </div>

                                    <div class="templates-form__field">
                                        <Label for="template-team">球队 / 标签</Label>
                                        <Input
                                            id="template-team"
                                            v-model="form.team"
                                            placeholder="例如：金州勇士"
                                        />
                                    </div>
                                </div>

                                <div class="templates-form__field">
                                    <Label for="template-description">模板说明</Label>
                                    <textarea
                                        id="template-description"
                                        v-model="form.description"
                                        class="templates-form__textarea"
                                        rows="4"
                                        placeholder="记录采样阶段、出手特点或适用场景。"
                                    />
                                </div>

                                <div
                                    v-if="saveError"
                                    class="templates-form__feedback templates-form__feedback--error"
                                >
                                    {{ saveError }}
                                </div>
                                <div
                                    v-else-if="saveSuccess"
                                    class="templates-form__feedback templates-form__feedback--success"
                                >
                                    {{ saveSuccess }}
                                </div>

                                <div class="templates-form__actions">
                                    <Button type="submit" :disabled="!canSaveTemplate || isSaving">
                                        <Loader2 v-if="isSaving" class="h-4 w-4 animate-spin" />
                                        保存为球星模板
                                    </Button>
                                </div>
                            </form>
                        </div>

                        <div v-else class="templates-empty">
                            <p class="templates-empty__title">当前没有可保存的视频模板</p>
                            <p class="templates-empty__body">
                                请先上传并分析一段完整投篮视频，再回到这里保存模板。这样导入的数据才包含整段动作节奏、关键帧和阶段角度画像。
                            </p>
                            <Button @click="goToUpload">前往上传分析</Button>
                        </div>
                    </CardContent>
                </Card>

                <Card class="templates-panel templates-panel--library">
                    <CardHeader>
                        <CardTitle>已导入模板</CardTitle>
                        <CardDescription>
                            默认内置模板会在首次启动时自动写入，新增模板会继续叠加，不覆盖已有数据。
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="templates-panel__content">
                        <div
                            v-if="loadError"
                            class="templates-library__feedback templates-library__feedback--error"
                        >
                            {{ loadError }}
                        </div>

                        <div
                            v-else-if="editSuccess"
                            class="templates-library__feedback templates-library__feedback--success"
                        >
                            {{ editSuccess }}
                        </div>

                        <div
                            v-else-if="deleteError"
                            class="templates-library__feedback templates-library__feedback--error"
                        >
                            {{ deleteError }}
                        </div>

                        <div v-if="isLoadingTemplates" class="templates-library__loading">
                            <Loader2 class="h-4 w-4 animate-spin" />
                            <span>正在加载模板列表...</span>
                        </div>

                        <div v-else-if="templates.length" class="templates-library">
                            <article
                                v-for="template in templates"
                                :key="template.id"
                                class="templates-library__item"
                            >
                                <div class="templates-library__topline">
                                    <div>
                                        <h2 class="templates-library__name">{{ template.name }}</h2>
                                        <p class="templates-library__team">{{ template.team }}</p>
                                    </div>

                                    <div class="templates-library__header-actions">
                                        <span class="templates-library__badge"
                                            >#{{ template.id }}</span
                                        >
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="templates-library__edit-trigger"
                                            :disabled="
                                                deletingTemplateId === template.id ||
                                                pendingDeleteTemplateId === template.id
                                            "
                                            @click="startEditingTemplate(template)"
                                        >
                                            <PencilLine class="h-4 w-4" />
                                            编辑
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="templates-library__delete-trigger"
                                            :disabled="
                                                deletingTemplateId === template.id ||
                                                isUpdatingTemplate
                                            "
                                            @click="requestDeleteTemplate(template)"
                                        >
                                            <Loader2
                                                v-if="deletingTemplateId === template.id"
                                                class="h-4 w-4 animate-spin"
                                            />
                                            <Trash2 v-else class="h-4 w-4" />
                                            删除
                                        </Button>
                                    </div>
                                </div>

                                <div
                                    v-if="pendingDeleteTemplateId === template.id"
                                    class="templates-delete-confirm"
                                >
                                    <div class="templates-delete-confirm__copy">
                                        <p class="templates-delete-confirm__title">
                                            确认删除这个模板？
                                        </p>
                                        <p class="templates-delete-confirm__body">
                                            「{{
                                                template.name
                                            }}」删除后不会再参与球星对比。这个操作不能撤销。
                                        </p>
                                    </div>

                                    <div class="templates-delete-confirm__actions">
                                        <Button
                                            variant="destructive"
                                            class="templates-delete-confirm__submit"
                                            :disabled="deletingTemplateId === template.id"
                                            @click="void confirmDeleteTemplate(template)"
                                        >
                                            <Loader2
                                                v-if="deletingTemplateId === template.id"
                                                class="h-4 w-4 animate-spin"
                                            />
                                            <Trash2 v-else class="h-4 w-4" />
                                            确认删除
                                        </Button>
                                        <Button
                                            variant="outline"
                                            class="templates-delete-confirm__cancel"
                                            :disabled="deletingTemplateId === template.id"
                                            @click="cancelDeleteTemplate"
                                        >
                                            取消
                                        </Button>
                                    </div>
                                </div>

                                <template v-if="editingTemplateId === template.id">
                                    <form
                                        class="templates-edit-form"
                                        @submit.prevent="void saveTemplateEdits()"
                                    >
                                        <div class="templates-form__row">
                                            <div class="templates-form__field">
                                                <Label :for="`template-edit-name-${template.id}`"
                                                    >球星名称</Label
                                                >
                                                <Input
                                                    :id="`template-edit-name-${template.id}`"
                                                    v-model="editForm.name"
                                                    placeholder="例如：斯蒂芬·库里"
                                                />
                                            </div>

                                            <div class="templates-form__field">
                                                <Label :for="`template-edit-team-${template.id}`"
                                                    >球队 / 标签</Label
                                                >
                                                <Input
                                                    :id="`template-edit-team-${template.id}`"
                                                    v-model="editForm.team"
                                                    placeholder="例如：金州勇士"
                                                />
                                            </div>
                                        </div>

                                        <div class="templates-form__field">
                                            <Label :for="`template-edit-description-${template.id}`"
                                                >模板说明</Label
                                            >
                                            <textarea
                                                :id="`template-edit-description-${template.id}`"
                                                v-model="editForm.description"
                                                class="templates-form__textarea"
                                                rows="4"
                                                placeholder="记录采样阶段、出手特点或适用场景。"
                                            />
                                        </div>

                                        <div
                                            v-if="editError"
                                            class="templates-form__feedback templates-form__feedback--error"
                                        >
                                            {{ editError }}
                                        </div>

                                        <div class="templates-edit-form__actions">
                                            <Button
                                                type="submit"
                                                :disabled="
                                                    !canSaveTemplateEdits || isUpdatingTemplate
                                                "
                                            >
                                                <Loader2
                                                    v-if="isUpdatingTemplate"
                                                    class="h-4 w-4 animate-spin"
                                                />
                                                <Check v-else class="h-4 w-4" />
                                                保存修改
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                :disabled="isUpdatingTemplate"
                                                @click="cancelEditingTemplate"
                                            >
                                                <X class="h-4 w-4" />
                                                取消
                                            </Button>
                                        </div>
                                    </form>
                                </template>

                                <template v-else>
                                    <p class="templates-library__description">
                                        {{ template.description || "暂无模板说明。" }}
                                    </p>

                                    <div class="templates-library__meta">
                                        <span
                                            v-if="template.templateProfile"
                                            class="templates-library__mode templates-library__mode--video"
                                        >
                                            整段视频模板 ·
                                            {{ template.templateProfile.samplesUsed }} 帧 · 覆盖
                                            {{
                                                formatTemplateCoverage(
                                                    template.templateProfile.coverage,
                                                )
                                            }}
                                        </span>
                                        <span
                                            v-else
                                            class="templates-library__mode templates-library__mode--legacy"
                                        >
                                            旧单帧模板 · 建议删除后用完整视频重建
                                        </span>
                                        <span>{{ template.angles.length }} 个角度特征</span>
                                        <span
                                            >{{
                                                template.poseData.keypoints.length
                                            }}
                                            个姿态关键点</span
                                        >
                                    </div>
                                </template>
                            </article>
                        </div>

                        <div v-else class="templates-empty">
                            <p class="templates-empty__title">模板库仍为空</p>
                            <p class="templates-empty__body">
                                先用完整投篮视频保存一个球星模板，后续球星对比页才能给出更稳定的整段动作匹配结果。
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    </div>
</template>

<style scoped>
.templates-page {
    position: relative;
    min-height: 100%;
    padding: clamp(3.75rem, 6vh, 4.5rem) 28px 28px;
    overflow: hidden;
    background:
        radial-gradient(
            circle at 14% 14%,
            color-mix(in srgb, var(--accent-color) 4%, transparent),
            transparent 20%
        ),
        radial-gradient(
            circle at 84% 18%,
            color-mix(in srgb, var(--primary-color) 4%, transparent),
            transparent 24%
        ),
        linear-gradient(
            180deg,
            color-mix(in srgb, var(--bg-solid) 97%, var(--surface-color)),
            var(--bg-solid)
        );
}

.templates-page__cover,
.templates-page__veil {
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.templates-page__cover {
    background-position: right -1rem top 1rem;
    background-repeat: no-repeat;
    background-size: min(31vw, 27rem) auto;
    opacity: 0.08;
    transform: translate3d(0, 0, 0) scale(1.01);
}

.templates-page__veil {
    background:
        radial-gradient(
            circle at 72% 22%,
            color-mix(in srgb, var(--accent-color) 8%, transparent),
            transparent 22%
        ),
        linear-gradient(
            180deg,
            color-mix(in srgb, var(--bg-solid) 58%, transparent),
            color-mix(in srgb, var(--bg-solid) 90%, var(--background))
        );
    opacity: 0.44;
}

.templates-page__content {
    position: relative;
    z-index: 1;
    max-width: 1280px;
    margin: 0 auto;
    display: grid;
    gap: 22px;
}

.templates-page__header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 18px;
}

.templates-page__heading {
    display: grid;
    gap: 8px;
}

.templates-page__eyebrow {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.templates-page__title {
    margin: 0;
    font-size: clamp(1.9rem, 1.55rem + 0.9vw, 2.45rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-primary);
}

.templates-page__summary {
    margin: 0;
    max-width: 56rem;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-secondary);
}

.templates-page__toolbar {
    display: flex;
    justify-content: flex-end;
}

.templates-page__grid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
    gap: 22px;
}

.templates-panel {
    border: 1px solid color-mix(in srgb, var(--surface-border) 88%, transparent);
    background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--surface-color) 96%, var(--background)),
        color-mix(in srgb, var(--glass-xs) 90%, var(--background))
    );
    box-shadow: var(--shadow-lg);
}

.templates-panel__content {
    display: grid;
    gap: 18px;
}

.templates-analysis {
    display: grid;
    gap: 18px;
}

.templates-analysis__media {
    overflow: hidden;
    border-radius: 20px;
    border: 1px solid color-mix(in srgb, var(--surface-border) 82%, transparent);
    background: color-mix(in srgb, var(--glass-xs) 92%, var(--background));
}

.templates-analysis__image {
    display: block;
    width: 100%;
    max-height: 280px;
    object-fit: contain;
    background: color-mix(in srgb, var(--bg-solid) 92%, transparent);
}

.templates-analysis__placeholder {
    padding: 28px 22px;
    color: var(--text-secondary);
    font-size: 14px;
}

.templates-analysis__meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.templates-analysis__metric {
    display: grid;
    gap: 6px;
    padding: 14px 16px;
    border-radius: 18px;
    border: 1px solid color-mix(in srgb, var(--surface-border) 85%, transparent);
    background: color-mix(in srgb, var(--glass-xs) 94%, var(--background));
}

.templates-analysis__metric--video {
    border-color: color-mix(in srgb, var(--accent-color) 30%, var(--surface-border));
    background:
        linear-gradient(
            135deg,
            color-mix(in srgb, var(--accent-color) 11%, transparent),
            transparent 72%
        ),
        color-mix(in srgb, var(--glass-xs) 94%, var(--background));
}

.templates-analysis__label {
    font-size: 12px;
    color: var(--text-muted);
}

.templates-form,
.templates-edit-form {
    display: grid;
    gap: 16px;
}

.templates-video-required {
    display: grid;
    justify-items: start;
    gap: 10px;
    padding: 16px 18px;
    border-radius: 18px;
    border: 1px solid color-mix(in srgb, var(--color-warning, #d28b18) 38%, var(--surface-border));
    background:
        linear-gradient(
            135deg,
            color-mix(in srgb, var(--color-warning, #d28b18) 12%, transparent),
            transparent 70%
        ),
        color-mix(in srgb, var(--card-bg) 94%, var(--background));
}

.templates-video-required__title,
.templates-video-required__body {
    margin: 0;
}

.templates-video-required__title {
    color: var(--text-primary);
    font-size: 15px;
    font-weight: 800;
}

.templates-video-required__body {
    max-width: 48rem;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.7;
}

.templates-form__row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
}

.templates-form__field {
    display: grid;
    gap: 8px;
}

.templates-form__textarea {
    width: 100%;
    min-height: 112px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--surface-border) 88%, transparent);
    background: color-mix(in srgb, var(--glass-xs) 92%, var(--background));
    color: var(--text-primary);
    font: inherit;
    resize: vertical;
}

.templates-form__textarea:focus-visible {
    outline: 1px solid var(--ring);
    outline-offset: 1px;
}

.templates-form__feedback,
.templates-library__feedback {
    padding: 12px 14px;
    border-radius: 14px;
    font-size: 14px;
}

.templates-form__feedback--error,
.templates-library__feedback--error {
    border: 1px solid color-mix(in srgb, var(--destructive, #d14343) 36%, transparent);
    background: color-mix(in srgb, var(--destructive, #d14343) 10%, transparent);
    color: color-mix(in srgb, var(--destructive, #d14343) 85%, black);
}

.templates-form__feedback--success,
.templates-library__feedback--success {
    border: 1px solid color-mix(in srgb, var(--accent-color) 34%, transparent);
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
    color: color-mix(in srgb, var(--accent-color) 70%, black);
}

.templates-form__actions,
.templates-edit-form__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-start;
}

.templates-library {
    display: grid;
    gap: 14px;
}

.templates-library__item {
    display: grid;
    gap: 12px;
    padding: 16px 18px;
    border-radius: 20px;
    border: 1px solid color-mix(in srgb, var(--surface-border) 86%, transparent);
    background: color-mix(in srgb, var(--glass-xs) 94%, var(--background));
}

.templates-library__topline {
    display: flex;
    justify-content: space-between;
    gap: 16px;
}

.templates-library__header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
}

.templates-library__edit-trigger,
.templates-library__delete-trigger {
    flex-shrink: 0;
}

.templates-library__delete-trigger {
    border-color: color-mix(in srgb, var(--color-danger) 46%, var(--surface-border));
    background: color-mix(in srgb, var(--color-danger-bg) 76%, var(--card-bg));
    color: color-mix(in srgb, var(--color-danger-hover) 90%, var(--text-primary));
    font-weight: 750;
}

.templates-library__delete-trigger:hover {
    border-color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger-bg) 92%, var(--card-bg));
    color: var(--color-danger-hover);
}

.templates-delete-confirm {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    border-radius: 18px;
    border: 1px solid color-mix(in srgb, var(--color-danger) 38%, var(--surface-border));
    background:
        linear-gradient(
            135deg,
            color-mix(in srgb, var(--color-danger-bg) 96%, transparent),
            transparent 68%
        ),
        color-mix(in srgb, var(--card-bg) 94%, var(--background));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.templates-delete-confirm__copy {
    display: grid;
    gap: 4px;
}

.templates-delete-confirm__title,
.templates-delete-confirm__body {
    margin: 0;
}

.templates-delete-confirm__title {
    color: color-mix(in srgb, var(--color-danger-hover) 88%, var(--text-primary));
    font-size: 14px;
    font-weight: 800;
}

.templates-delete-confirm__body {
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.6;
}

.templates-delete-confirm__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
}

.templates-delete-confirm__submit,
.templates-delete-confirm__cancel {
    min-height: 38px;
}

.templates-delete-confirm__submit {
    border: 1px solid color-mix(in srgb, var(--color-danger-hover) 86%, black);
    background: linear-gradient(135deg, var(--color-danger), var(--color-danger-hover)) !important;
    color: #fff !important;
    font-weight: 800;
    box-shadow: 0 10px 22px color-mix(in srgb, var(--color-danger) 24%, transparent);
}

.templates-delete-confirm__submit:hover {
    border-color: color-mix(in srgb, var(--color-danger-hover) 84%, black);
    background: linear-gradient(
        135deg,
        var(--color-danger-hover),
        color-mix(in srgb, var(--color-danger-hover) 84%, black)
    ) !important;
    color: #fff !important;
}

.templates-delete-confirm__submit:disabled {
    opacity: 0.72;
}

.templates-delete-confirm__submit :deep(svg) {
    color: currentColor;
}

.templates-library__name {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
}

.templates-library__team {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-muted);
}

.templates-library__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent-color) 12%, var(--glass-sm));
    color: color-mix(in srgb, var(--accent-color) 70%, var(--text-primary));
    font-size: 12px;
    font-weight: 600;
}

.templates-library__description {
    margin: 0;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-secondary);
}

.templates-library__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 12px;
    color: var(--text-muted);
}

.templates-library__mode {
    padding: 3px 9px;
    border-radius: 999px;
    font-weight: 700;
}

.templates-library__mode--video {
    background: color-mix(in srgb, var(--accent-color) 12%, transparent);
    color: color-mix(in srgb, var(--accent-color) 74%, var(--text-primary));
}

.templates-library__mode--legacy {
    background: color-mix(in srgb, var(--color-danger-bg) 82%, transparent);
    color: color-mix(in srgb, var(--color-danger-hover) 84%, var(--text-primary));
}

.templates-library__loading {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: var(--text-secondary);
}

.templates-empty {
    display: grid;
    justify-items: start;
    gap: 10px;
    padding: 20px;
    border-radius: 20px;
    border: 1px dashed color-mix(in srgb, var(--surface-border) 88%, transparent);
    background: color-mix(in srgb, var(--glass-xs) 94%, var(--background));
}

.templates-empty__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
}

.templates-empty__body {
    margin: 0;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-secondary);
}

@media (max-width: 1080px) {
    .templates-page__grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 960px) {
    .templates-page {
        padding: 72px 20px 24px;
    }

    .templates-page__cover {
        background-position: right -2rem top 1rem;
        background-size: min(44vw, 18rem) auto;
    }

    .templates-page__header {
        grid-template-columns: auto 1fr;
    }

    .templates-page__toolbar {
        grid-column: 1 / -1;
        justify-content: flex-start;
    }
}

@media (max-width: 640px) {
    .templates-analysis__meta,
    .templates-form__row {
        grid-template-columns: 1fr;
    }

    .templates-delete-confirm {
        grid-template-columns: 1fr;
    }

    .templates-delete-confirm__actions {
        justify-content: flex-start;
    }

    .templates-library__topline,
    .templates-library__header-actions {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>
