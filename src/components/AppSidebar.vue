<script setup lang="ts">
import { ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import {
    Home,
    Upload,
    Activity,
    History,
    GitCompareArrows,
    Layers,
    Settings,
    PanelLeftClose,
    PanelLeftOpen,
} from "lucide-vue-next"
import { navigateWithFogTransition } from "@/composables/useFogRouteTransition"
import AppSettings from "@/components/AppSettings.vue"
const route = useRoute(),
    router = useRouter()
const settingsOpen = ref(false)
const collapsed = ref(false)
const navItems = [
    { label: "首页", path: "/", icon: Home },
    { label: "上传素材", path: "/upload", icon: Upload },
    { label: "动作分析", path: "/analysis", icon: Activity },
    { label: "训练历史", path: "/history", icon: History },
    { label: "球星对比", path: "/compare", icon: GitCompareArrows },
    { label: "模板管理", path: "/templates", icon: Layers },
]
</script>
<template>
    <aside class="app-sidebar" :class="{ 'app-sidebar--collapsed': collapsed }" aria-label="主导航">
        <RouterLink class="app-sidebar__brand" to="/" aria-label="ShotForm 首页">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3v18M6 5c6 4 6 10 0 14M18 5c-6 4-6 10 0 14" /></svg
            ><span>ShotForm</span>
        </RouterLink>
        <nav class="app-sidebar__nav">
            <button
                v-for="item in navItems"
                :key="item.path"
                type="button"
                class="app-sidebar__nav-item"
                :class="{ 'is-active': route.path === item.path }"
                :aria-current="route.path === item.path ? 'page' : undefined"
                :aria-label="item.label"
                :title="item.label"
                @click="navigateWithFogTransition(router, item.path)"
            >
                <component :is="item.icon" aria-hidden="true" /><span>{{ item.label }}</span>
            </button>
        </nav>
        <div class="app-sidebar__footer">
            <button
                type="button"
                class="app-sidebar__nav-item"
                aria-label="设置"
                title="设置"
                @click="settingsOpen = true"
            >
                <Settings aria-hidden="true" /><span>设置</span>
            </button>
            <button
                type="button"
                class="app-sidebar__nav-item app-sidebar__collapse"
                :aria-label="collapsed ? '展开导航' : '收起导航'"
                :title="collapsed ? '展开导航' : '收起导航'"
                :aria-expanded="!collapsed"
                @click="collapsed = !collapsed"
            >
                <PanelLeftOpen v-if="collapsed" aria-hidden="true" /><PanelLeftClose
                    v-else
                    aria-hidden="true"
                /><span>收起导航</span>
            </button>
            <p class="app-sidebar__privacy">基础分析在本机完成</p>
        </div>
    </aside>
    <AppSettings v-model:open="settingsOpen" />
</template>
<style scoped>
.app-sidebar {
    width: 176px;
    flex: 0 0 176px;
    background: var(--surface-color);
    border-right: 1px solid var(--surface-border);
    padding: 20px 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    min-height: 0;
    transition:
        width 180ms ease,
        flex-basis 180ms ease;
}
.app-sidebar__brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 3px 9px;
    color: var(--text-primary);
    text-decoration: none;
    font-weight: 700;
    font-size: 18px;
}
.app-sidebar__brand svg {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    stroke: var(--evidence-text);
    stroke-width: 1.5;
}
.app-sidebar__nav {
    display: grid;
    gap: 6px;
}
.app-sidebar__nav-item {
    display: flex;
    align-items: center;
    gap: 11px;
    min-height: 42px;
    padding: 10px;
    width: 100%;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--text-secondary);
    background: transparent;
    text-align: left;
    font-size: 14px;
    white-space: nowrap;
    transition:
        background-color 160ms,
        color 160ms;
}
.app-sidebar__nav-item svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    stroke-width: 1.7;
}
.app-sidebar__nav-item:hover {
    background: var(--glass-sm);
    color: var(--text-primary);
}
.app-sidebar__nav-item.is-active {
    background: var(--selection-bg);
    color: var(--selection-text);
    border-color: color-mix(in srgb, var(--primary-color) 35%, transparent);
    font-weight: 600;
}
.app-sidebar__footer {
    margin-top: auto;
    display: grid;
    gap: 4px;
    padding-top: 20px;
}
.app-sidebar__privacy {
    border-top: 1px solid var(--surface-border);
    margin: 12px 8px 0;
    padding-top: 16px;
    font-size: 12px;
    color: var(--text-muted);
}
.app-sidebar--collapsed {
    width: 64px;
    flex-basis: 64px;
    padding-inline: 8px;
}
.app-sidebar--collapsed span,
.app-sidebar--collapsed .app-sidebar__privacy {
    display: none;
}
.app-sidebar--collapsed .app-sidebar__brand {
    padding-inline: 12px;
}
.app-sidebar--collapsed .app-sidebar__nav-item {
    justify-content: center;
}
@media (max-width: 1050px) {
    .app-sidebar {
        width: 64px;
        flex-basis: 64px;
        padding-inline: 8px;
    }
    .app-sidebar span,
    .app-sidebar__privacy,
    .app-sidebar__collapse {
        display: none;
    }
    .app-sidebar__brand {
        padding-inline: 12px;
    }
    .app-sidebar__nav-item {
        justify-content: center;
    }
}
@media (max-height: 560px) {
    .app-sidebar {
        gap: 12px;
        padding-top: 10px;
        overflow-y: auto;
    }
    .app-sidebar__footer {
        padding-top: 6px;
    }
    .app-sidebar__nav-item {
        min-height: 36px;
        padding-block: 7px;
    }
    .app-sidebar__privacy {
        display: none;
    }
}
</style>
