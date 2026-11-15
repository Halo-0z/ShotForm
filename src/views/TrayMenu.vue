<script setup lang="ts">
import { onMounted, onUnmounted } from "vue"
import { useRouter } from "vue-router"
import { invoke } from "@tauri-apps/api/core"
import { ChevronRight, X } from "lucide-vue-next"
import { hasTauriRuntime } from "@/lib/tauri-runtime"

const router = useRouter()
const isDesktop = hasTauriRuntime()

const menuItems = [
    { label: "开始分析", path: "/upload" },
    { label: "姿势分析", path: "/analysis" },
    { label: "历史记录", path: "/history" },
    { label: "球星对比", path: "/compare" },
    { label: "模板库", path: "/templates" },
]

async function openRoute(path: string) {
    if (!isDesktop) {
        await router.push(path)
        return
    }

    await invoke("tray_open_route", { path })
}

async function showMain() {
    if (!isDesktop) {
        await router.push("/")
        return
    }

    await invoke("tray_show_main")
}

async function quitApp() {
    if (isDesktop) {
        await invoke("tray_quit")
    }
}

async function hidePanel() {
    if (isDesktop) {
        await invoke("tray_hide_panel")
    }
}

function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
        void hidePanel()
    }
}

function handleMousedown(event: MouseEvent) {
    const target = event.target as HTMLElement
    const panel = document.querySelector(".tray-menu-panel")
    if (!panel) return
    if (panel.contains(target) && !target.closest("button")) {
        void hidePanel()
    }
}

onMounted(() => {
    document.body.classList.add("tray-panel-window")
    window.addEventListener("keydown", handleKeydown)
    window.addEventListener("mousedown", handleMousedown)
})

onUnmounted(() => {
    document.body.classList.remove("tray-panel-window")
    window.removeEventListener("keydown", handleKeydown)
    window.removeEventListener("mousedown", handleMousedown)
})
</script>

<template>
    <main class="tray-menu-shell" aria-label="ShotForm 系统托盘菜单">
        <section class="tray-menu-panel">
            <header class="tray-menu-header">
                <p class="tray-menu-title">ShotForm</p>
                <button
                    class="tray-menu-icon-button"
                    type="button"
                    aria-label="收起托盘菜单"
                    @click="hidePanel"
                >
                    <X :size="16" aria-hidden="true" />
                </button>
            </header>

            <div class="tray-menu-status" aria-label="系统状态">
                <span class="tray-menu-status-dot" aria-hidden="true"></span>
                <span>本地工作台待命</span>
            </div>

            <nav class="tray-menu-nav" aria-label="快捷入口">
                <button
                    v-for="item in menuItems"
                    :key="item.path + item.label"
                    class="tray-menu-item"
                    type="button"
                    @click="openRoute(item.path)"
                >
                    <span class="tray-menu-item-label">{{ item.label }}</span>
                    <ChevronRight :size="16" class="tray-menu-item-chevron" aria-hidden="true" />
                </button>
            </nav>

            <div class="tray-menu-divider" role="presentation"></div>

            <footer class="tray-menu-footer">
                <button
                    class="tray-menu-item tray-menu-item-compact"
                    type="button"
                    @click="showMain"
                >
                    <span class="tray-menu-item-label">打开 ShotForm</span>
                    <ChevronRight :size="16" class="tray-menu-item-chevron" aria-hidden="true" />
                </button>
                <button
                    class="tray-menu-item tray-menu-item-compact tray-menu-item-danger"
                    type="button"
                    @click="quitApp"
                >
                    <span class="tray-menu-item-label">退出 ShotForm</span>
                    <ChevronRight :size="16" class="tray-menu-item-chevron" aria-hidden="true" />
                </button>
            </footer>
        </section>
    </main>
</template>

<style scoped>
:global(body.tray-panel-window),
:global(body.tray-panel-window #app) {
    overflow: hidden;
    background: transparent !important;
}

.tray-menu-shell {
    width: 100vw;
    height: 100vh;
    display: grid;
    place-items: stretch;
    color: var(--text-primary);
    background: transparent;
    font-family: var(--font-ui);
}

.tray-menu-panel {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-radius: 14px;
    border: 1px solid var(--surface-border);
    background: var(--surface-color);
    box-shadow: none;
}

.tray-menu-header,
.tray-menu-status,
.tray-menu-nav,
.tray-menu-footer {
    position: relative;
    z-index: 1;
}

.tray-menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 6px;
}

.tray-menu-title {
    color: var(--text-primary);
    font-size: 19px;
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: 0;
}

.tray-menu-icon-button {
    width: 28px;
    height: 28px;
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: 8px;
    color: var(--text-secondary);
    background: var(--selection-bg);
    border: 1px solid var(--surface-border);
    transition:
        background-color 150ms ease,
        color 150ms ease,
        transform 150ms ease;
}

.tray-menu-icon-button:hover {
    color: var(--text-primary);
    background: var(--selection-bg);
    transform: translateY(-1px);
}

.tray-menu-status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin: 0 16px 4px;
    padding: 6px 0 8px;
    border-bottom: 1px solid var(--surface-border);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 700;
}

.tray-menu-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--color-success);
    box-shadow: none;
}

.tray-menu-nav {
    padding: 4px 10px 0;
}

.tray-menu-footer {
    margin-top: auto;
    padding: 0 10px 6px;
}

.tray-menu-item {
    width: 100%;
    min-height: 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    color: var(--text-primary);
    text-align: left;
    transition:
        background-color 140ms ease,
        color 140ms ease,
        transform 140ms ease;
}

.tray-menu-item + .tray-menu-item {
    margin-top: 1px;
}

.tray-menu-item:hover {
    background: var(--selection-bg);
    transform: translateX(2px);
}

.tray-menu-item:focus-visible,
.tray-menu-icon-button:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
}

.tray-menu-item-label {
    min-width: 0;
    overflow: hidden;
    color: currentColor;
    font-size: 14.5px;
    line-height: 1.2;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tray-menu-item-chevron {
    flex: 0 0 auto;
    color: var(--text-secondary);
    transition:
        color 140ms ease,
        transform 140ms ease;
}

.tray-menu-item:hover .tray-menu-item-chevron {
    color: var(--text-secondary);
    transform: translateX(2px);
}

.tray-menu-item-compact {
    min-height: 34px;
    padding: 6px 12px;
}

.tray-menu-item-compact .tray-menu-item-label {
    font-size: 14px;
    font-weight: 600;
}

.tray-menu-item-danger {
    color: var(--color-danger);
}

.tray-menu-divider {
    position: relative;
    z-index: 1;
    height: 1px;
    margin: 4px 16px;
    background: var(--surface-border);
    box-shadow: none;
}

@media (prefers-reduced-motion: reduce) {
    .tray-menu-item,
    .tray-menu-icon-button {
        transition-duration: 0.01ms !important;
        transform: none !important;
    }
}
</style>
