<script setup lang="ts">
import { Sun, Moon, Monitor } from "lucide-vue-next"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useTheme, type Theme } from "@/composables/useTheme"
const open = defineModel<boolean>("open", { default: false })
const { theme, setTheme } = useTheme()
const choices: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "浅色", icon: Sun },
    { value: "dark", label: "深色", icon: Moon },
    { value: "system", label: "跟随系统", icon: Monitor },
]
</script>
<template>
    <Dialog v-model:open="open">
        <DialogContent class="settings-dialog">
            <DialogTitle>设置</DialogTitle
            ><DialogDescription>调整外观，查看快捷键与数据处理方式。</DialogDescription>
            <fieldset>
                <legend>外观主题</legend>
                <div class="settings-themes">
                    <label
                        v-for="choice in choices"
                        :key="choice.value"
                        :class="{ selected: theme === choice.value }"
                        ><input
                            type="radio"
                            name="theme"
                            :value="choice.value"
                            :checked="theme === choice.value"
                            @change="setTheme(choice.value)"
                        /><component :is="choice.icon" aria-hidden="true" /><span>{{
                            choice.label
                        }}</span></label
                    >
                </div>
            </fieldset>
            <section>
                <h3>快捷键</h3>
                <dl class="settings-shortcuts">
                    <div>
                        <dt>上传素材</dt>
                        <dd>Ctrl + Shift + U</dd>
                    </div>
                    <div>
                        <dt>动作分析</dt>
                        <dd>Ctrl + Shift + A</dd>
                    </div>
                    <div>
                        <dt>训练历史</dt>
                        <dd>Ctrl + Shift + H</dd>
                    </div>
                    <div>
                        <dt>球星对比</dt>
                        <dd>Ctrl + Shift + C</dd>
                    </div>
                    <div>
                        <dt>模板管理</dt>
                        <dd>Ctrl + Shift + T</dd>
                    </div>
                </dl>
                <p>Mac 使用 ⌘ 替代 Ctrl。编辑文字或打开弹窗时，页面快捷键不触发。</p>
            </section>
            <section>
                <h3>分析与隐私</h3>
                <p>
                    基础姿态识别和训练记录在本机处理。主动生成 AI
                    报告时，图像及分析数据会发送至腾讯混元云服务。
                </p>
                <p>界面动效遵循系统的“减少动态效果”设置。</p>
            </section>
        </DialogContent>
    </Dialog>
</template>
<style scoped>
.settings-dialog {
    max-width: 560px;
}
fieldset {
    border: 0;
    padding: 0;
    margin: 0;
}
legend,
h3 {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 12px;
}
.settings-themes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}
.settings-themes label {
    position: relative;
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 14px 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
}
.settings-themes input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    inset: 0;
    cursor: pointer;
}
.settings-themes label:has(input:focus-visible) {
    outline: 2px solid var(--primary-color);
    outline-offset: 3px;
}
.settings-themes .selected {
    border-color: var(--primary-color);
    background: var(--selection-bg);
    color: var(--selection-text);
}
.settings-themes svg {
    width: 18px;
    height: 18px;
}
section {
    border-top: 1px solid var(--surface-border);
    padding-top: 20px;
}
p {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.7;
    margin: 8px 0 0;
}
.settings-shortcuts {
    margin: 0;
    display: grid;
    gap: 6px;
}
.settings-shortcuts div {
    display: flex;
    justify-content: space-between;
    gap: 16px;
}
.settings-shortcuts dd {
    margin: 0;
    color: var(--text-muted);
    font-size: 13px;
}
@media (max-width: 500px) {
    .settings-themes label {
        flex-direction: column;
        font-size: 13px;
    }
}
</style>
