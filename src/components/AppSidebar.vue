<script setup lang="ts">
import { useRoute, useRouter } from "vue-router"
import { Home, Video, History, Layers, Settings, User } from "lucide-vue-next"
import { navigateWithFogTransition } from "@/composables/useFogRouteTransition"

const route = useRoute()
const router = useRouter()

interface NavItem {
    label: string
    path: string
    icon: typeof Home
    disabled?: boolean
}

const navItems: NavItem[] = [
    { label: "首页", path: "/", icon: Home },
    { label: "上传视频", path: "/upload", icon: Video },
    { label: "历史记录", path: "/history", icon: History },
    { label: "模板管理", path: "/templates", icon: Layers },
    { label: "设置", path: "", icon: Settings, disabled: true },
]

const isActive = (path: string) => {
    if (!path) return false
    return route.path === path
}

const handleNav = async (item: NavItem) => {
    if (item.disabled || !item.path) return
    await navigateWithFogTransition(router, item.path)
}
</script>

<template>
    <aside class="app-sidebar">
        <div class="app-sidebar__logo">
            <div class="app-sidebar__logo-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" />
                    <path
                        d="M12 2C12 2 15 6 15 12C15 18 12 22 12 22"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />
                    <path
                        d="M12 2C12 2 9 6 9 12C9 18 12 22 12 22"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />
                    <path
                        d="M2 12H22"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />
                </svg>
            </div>
            <div class="app-sidebar__logo-text">
                <span class="app-sidebar__logo-name">ShotForm</span>
                <span class="app-sidebar__logo-sub">投篮分析大师</span>
            </div>
        </div>

        <nav class="app-sidebar__nav">
            <button
                v-for="item in navItems"
                :key="item.path || item.label"
                class="app-sidebar__nav-item"
                :class="{
                    'app-sidebar__nav-item--active': isActive(item.path),
                    'app-sidebar__nav-item--disabled': item.disabled,
                }"
                :disabled="item.disabled"
                @click="handleNav(item)"
            >
                <component :is="item.icon" class="app-sidebar__nav-icon" />
                <span>{{ item.label }}</span>
            </button>
        </nav>

        <div class="app-sidebar__footer">
            <div class="app-sidebar__user-avatar">
                <User class="app-sidebar__user-avatar-icon" />
            </div>
            <div class="app-sidebar__user-info">
                <span class="app-sidebar__user-name">Coach</span>
                <span class="app-sidebar__user-plan">专业版</span>
            </div>
        </div>
    </aside>
</template>

<style scoped>
.app-sidebar {
    width: 210px;
    min-width: 210px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-solid);
    border-right: 1px solid var(--surface-border);
    padding: 16px 12px;
    gap: 24px;
}

.app-sidebar__logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px;
}

.app-sidebar__logo-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-color);
    flex-shrink: 0;
}

.app-sidebar__logo-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.app-sidebar__logo-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
}

.app-sidebar__logo-sub {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 500;
}

.app-sidebar__nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    padding-top: 4px;
}

.app-sidebar__nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 160ms ease;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
}

.app-sidebar__nav-item:hover:not(.app-sidebar__nav-item--disabled):not(
        .app-sidebar__nav-item--active
    ) {
    background: var(--glass-sm);
    color: var(--text-primary);
}

.app-sidebar__nav-item--active {
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
    color: var(--accent-color);
    font-weight: 600;
}

.app-sidebar__nav-item--disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.app-sidebar__nav-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
}

.app-sidebar__footer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 8px;
    border-top: 1px solid var(--surface-border);
    margin-top: auto;
}

.app-sidebar__user-avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent-color) 14%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-color);
    flex-shrink: 0;
}

.app-sidebar__user-avatar-icon {
    width: 18px;
    height: 18px;
}

.app-sidebar__user-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.app-sidebar__user-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
}

.app-sidebar__user-plan {
    font-size: 11px;
    color: var(--text-muted);
}
</style>
