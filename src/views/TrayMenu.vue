<script setup lang="ts">
import { onMounted, onUnmounted } from "vue"
import { useRouter } from "vue-router"
import { invoke } from "@tauri-apps/api/core"
import {
    Archive,
    BarChart3,
    ChevronsRight,
    GitCompare,
    LayoutTemplate,
    LogOut,
    PanelTopOpen,
    UploadCloud,
    X,
} from "lucide-vue-next"
import { hasTauriRuntime } from "@/lib/tauri-runtime"

const router = useRouter()
const isDesktop = hasTauriRuntime()

const menuItems = [
    {
        label: "上传分析",
        description: "导入图片或视频",
        path: "/upload",
        icon: UploadCloud,
    },
    {
        label: "姿势分析",
        description: "查看当前训练结论",
        path: "/analysis",
        icon: BarChart3,
    },
    {
        label: "历史记录",
        description: "继续最近一次训练",
        path: "/history",
        icon: Archive,
    },
    {
        label: "球星对比",
        description: "对照模板读差异",
        path: "/compare",
        icon: GitCompare,
    },
    {
        label: "模板库",
        description: "管理参考动作",
        path: "/templates",
        icon: LayoutTemplate,
    },
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
    const panel = document.querySelector(".tray-menu-panel")
    if (panel && !panel.contains(event.target as Node)) {
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
                <img class="tray-menu-cover" src="/hero/kobe-shot.png" alt="" aria-hidden="true" />

                <div class="tray-menu-identity">
                    <div class="tray-menu-title-row">
                        <div>
                            <p class="tray-menu-title">ShotForm</p>
                            <p class="tray-menu-subtitle">篮球投篮姿势分析</p>
                        </div>

                        <button
                            class="tray-menu-icon-button"
                            type="button"
                            aria-label="收起托盘菜单"
                            @click="hidePanel"
                        >
                            <X :size="16" aria-hidden="true" />
                        </button>
                    </div>

                    <div class="tray-menu-actions">
                        <button
                            class="tray-menu-action tray-menu-action-primary"
                            type="button"
                            @click="openRoute('/upload')"
                        >
                            <ChevronsRight :size="16" aria-hidden="true" />
                            开始分析
                        </button>
                        <button
                            class="tray-menu-action"
                            type="button"
                            @click="openRoute('/templates')"
                        >
                            <LayoutTemplate :size="15" aria-hidden="true" />
                            模板库
                        </button>
                    </div>
                </div>
            </header>

            <div class="tray-menu-status" aria-label="系统状态">
                <span class="tray-menu-status-dot" aria-hidden="true"></span>
                <span>本地工作台待命</span>
            </div>

            <nav class="tray-menu-nav" aria-label="快捷入口">
                <button
                    v-for="item in menuItems"
                    :key="item.path"
                    class="tray-menu-item"
                    type="button"
                    @click="openRoute(item.path)"
                >
                    <span class="tray-menu-item-icon">
                        <component :is="item.icon" :size="18" aria-hidden="true" />
                    </span>
                    <span class="tray-menu-item-copy">
                        <span class="tray-menu-item-label">{{ item.label }}</span>
                        <span class="tray-menu-item-description">{{ item.description }}</span>
                    </span>
                </button>
            </nav>

            <div class="tray-menu-divider" role="presentation"></div>

            <footer class="tray-menu-footer">
                <button
                    class="tray-menu-item tray-menu-item-compact"
                    type="button"
                    @click="showMain"
                >
                    <span class="tray-menu-item-icon">
                        <PanelTopOpen :size="18" aria-hidden="true" />
                    </span>
                    <span class="tray-menu-item-label">打开 ShotForm</span>
                </button>
                <button
                    class="tray-menu-item tray-menu-item-compact tray-menu-item-danger"
                    type="button"
                    @click="quitApp"
                >
                    <span class="tray-menu-item-icon">
                        <LogOut :size="18" aria-hidden="true" />
                    </span>
                    <span class="tray-menu-item-label">退出 ShotForm</span>
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
    padding: 10px;
    display: grid;
    place-items: stretch;
    color: #1c2128;
    background: transparent;
    font-family: var(--font-ui);
}

.tray-menu-panel {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.68);
    background:
        linear-gradient(145deg, rgba(250, 247, 242, 0.78), rgba(231, 224, 212, 0.62)),
        rgba(243, 238, 230, 0.62);
    backdrop-filter: blur(24px) saturate(1.45);
    -webkit-backdrop-filter: blur(24px) saturate(1.45);
    box-shadow:
        0 22px 50px rgba(20, 25, 34, 0.24),
        inset 0 1px 0 rgba(255, 255, 255, 0.82),
        inset 0 -1px 0 rgba(103, 114, 130, 0.12);
}

.tray-menu-panel::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
        radial-gradient(circle at 18% 0%, rgba(201, 130, 61, 0.16), transparent 31%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.34), transparent 34%);
}

.tray-menu-header,
.tray-menu-status,
.tray-menu-nav,
.tray-menu-footer {
    position: relative;
    z-index: 1;
}

.tray-menu-header {
    display: grid;
    grid-template-columns: 68px 1fr;
    gap: 12px;
    padding: 12px 14px 10px;
}

.tray-menu-cover {
    width: 68px;
    height: 68px;
    object-fit: cover;
    border-radius: 9px;
    border: 1px solid rgba(255, 255, 255, 0.72);
    box-shadow: 0 10px 24px rgba(20, 25, 34, 0.18);
}

.tray-menu-identity {
    min-width: 0;
}

.tray-menu-title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
}

.tray-menu-title {
    color: #10151c;
    font-size: 19px;
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: 0;
}

.tray-menu-subtitle {
    margin-top: 4px;
    color: rgba(28, 33, 40, 0.62);
    font-size: 12px;
    line-height: 1.2;
    font-weight: 600;
}

.tray-menu-icon-button {
    width: 28px;
    height: 28px;
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: 8px;
    color: rgba(28, 33, 40, 0.64);
    background: rgba(255, 255, 255, 0.42);
    border: 1px solid rgba(103, 114, 130, 0.16);
    transition:
        background-color 150ms ease,
        color 150ms ease,
        transform 150ms ease;
}

.tray-menu-icon-button:hover {
    color: #1c2128;
    background: rgba(255, 255, 255, 0.72);
    transform: translateY(-1px);
}

.tray-menu-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 9px;
    margin-top: 10px;
}

.tray-menu-action {
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border-radius: 9px;
    color: #1c2128;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    background: rgba(255, 255, 255, 0.48);
    border: 1px solid rgba(103, 114, 130, 0.22);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.76);
    transition:
        background-color 150ms ease,
        border-color 150ms ease,
        box-shadow 150ms ease,
        transform 150ms ease;
}

.tray-menu-action-primary {
    color: #f7f4ee;
    background: linear-gradient(180deg, #5d7396, #495f80);
    border-color: rgba(61, 82, 111, 0.78);
    box-shadow:
        0 10px 18px rgba(73, 95, 128, 0.24),
        inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.tray-menu-action:hover {
    background: rgba(255, 255, 255, 0.72);
    border-color: rgba(93, 115, 150, 0.34);
    transform: translateY(-1px);
}

.tray-menu-action-primary:hover {
    background: linear-gradient(180deg, #6e84a8, #4d6384);
    box-shadow:
        0 12px 22px rgba(73, 95, 128, 0.28),
        inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.tray-menu-status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin: 0 14px;
    padding: 7px 10px;
    border-top: 1px solid rgba(103, 114, 130, 0.14);
    border-bottom: 1px solid rgba(255, 255, 255, 0.54);
    color: rgba(28, 33, 40, 0.64);
    font-size: 12px;
    font-weight: 700;
}

.tray-menu-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #2f9d71;
    box-shadow: 0 0 0 4px rgba(47, 157, 113, 0.12);
}

.tray-menu-nav {
    padding: 6px 10px 2px;
}

.tray-menu-footer {
    margin-top: auto;
    padding: 1px 10px 4px;
}

.tray-menu-item {
    width: 100%;
    min-height: 43px;
    display: grid;
    grid-template-columns: 34px 1fr;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 9px;
    color: #1c2128;
    text-align: left;
    transition:
        background-color 140ms ease,
        color 140ms ease,
        transform 140ms ease;
}

.tray-menu-item + .tray-menu-item {
    margin-top: 2px;
}

.tray-menu-item:hover {
    background: rgba(255, 255, 255, 0.54);
    transform: translateX(2px);
}

.tray-menu-item:focus-visible,
.tray-menu-action:focus-visible,
.tray-menu-icon-button:focus-visible {
    outline: 2px solid rgba(93, 115, 150, 0.72);
    outline-offset: 2px;
}

.tray-menu-item-icon {
    width: 30px;
    height: 30px;
    display: inline-grid;
    place-items: center;
    border-radius: 8px;
    color: #495f80;
    background: rgba(255, 255, 255, 0.46);
    border: 1px solid rgba(103, 114, 130, 0.13);
}

.tray-menu-item-copy {
    display: grid;
    min-width: 0;
    gap: 2px;
}

.tray-menu-item-label {
    min-width: 0;
    overflow: hidden;
    color: currentColor;
    font-size: 15px;
    line-height: 1.2;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tray-menu-item-description {
    min-width: 0;
    overflow: hidden;
    color: rgba(28, 33, 40, 0.56);
    font-size: 11px;
    line-height: 1.2;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tray-menu-item-compact {
    min-height: 36px;
}

.tray-menu-item-danger {
    color: #ad3f3b;
}

.tray-menu-item-danger .tray-menu-item-icon {
    color: #ad3f3b;
    background: rgba(216, 92, 87, 0.1);
    border-color: rgba(216, 92, 87, 0.16);
}

.tray-menu-divider {
    position: relative;
    z-index: 1;
    height: 1px;
    margin: 4px 14px;
    background: rgba(103, 114, 130, 0.18);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.62);
}

@media (prefers-reduced-motion: reduce) {
    .tray-menu-item,
    .tray-menu-action,
    .tray-menu-icon-button {
        transition-duration: 0.01ms !important;
        transform: none !important;
    }
}
</style>
