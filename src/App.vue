<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import FogRouteTransition from "@/components/transition/FogRouteTransition.vue"
import TitleBar from "@/components/TitleBar.vue"
import ErrorBoundary from "@/components/ErrorBoundary.vue"
import ToastContainer from "@/components/ui/toast/Toast.vue"
import { useTheme } from "@/composables/useTheme"
import { useToast } from "@/composables/useToast"
import { useGlobalShortcuts } from "@/composables/useGlobalShortcuts"
import { useWindowPositionMemory } from "@/composables/useWindowPositionMemory"
import { COPY_LOCK_CLASS, createCopyGuardHandlers } from "@/lib/copy-guard.js"
import { hasTauriRuntime } from "@/lib/tauri-runtime"

const route = useRoute()
const router = useRouter()
const { initTheme } = useTheme()
const { handleCopy, handleCut } = createCopyGuardHandlers()
const { messages, dismiss } = useToast()
useGlobalShortcuts()
useWindowPositionMemory()

const isImmersiveChrome = computed(() => Boolean(route.meta.immersiveChrome))
const isWorkbenchChrome = computed(() => Boolean(route.meta.workbenchPage))
const isTrayPanel = computed(() => Boolean(route.meta.trayPanel))

let unlistenTrayRoute: (() => void) | undefined

onMounted(() => {
    initTheme()
    document.addEventListener("copy", handleCopy)
    document.addEventListener("cut", handleCut)

    if (hasTauriRuntime()) {
        void import("@tauri-apps/api/event").then(async ({ listen }) => {
            unlistenTrayRoute = await listen<{ path: string }>("tray://open-route", (event) => {
                if (event.payload?.path) {
                    void router.push(event.payload.path)
                }
            })
        })
    }
})

onUnmounted(() => {
    document.removeEventListener("copy", handleCopy)
    document.removeEventListener("cut", handleCut)
    unlistenTrayRoute?.()
})
</script>

<template>
    <div
        class="app-container"
        :class="[
            COPY_LOCK_CLASS,
            { 'immersive-home': isImmersiveChrome, 'tray-panel': isTrayPanel },
        ]"
    >
        <TitleBar
            v-if="!isTrayPanel"
            :immersive="isImmersiveChrome"
            :workbench="isWorkbenchChrome"
        />
        <FogRouteTransition v-if="!isTrayPanel" />
        <div
            class="app-content"
            :class="{ 'immersive-home': isImmersiveChrome, 'tray-panel': isTrayPanel }"
        >
            <ErrorBoundary>
                <router-view />
            </ErrorBoundary>
        </div>
        <ToastContainer v-if="!isTrayPanel" :messages="messages" @remove="dismiss" />
    </div>
</template>

<style>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html,
body,
#app {
    width: 100%;
    height: 100%;
    overflow: hidden;
}

.app-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.app-container.immersive-home {
    background: transparent;
}

.app-container.tray-panel {
    background: transparent;
}

.app-content {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-gutter: stable;
}

.app-content.immersive-home {
    position: relative;
}

.app-content.tray-panel {
    overflow: hidden;
    background: transparent;
}

.app-copy-locked,
.app-copy-locked * {
    user-select: none;
    -webkit-user-select: none;
}

.app-copy-locked input,
.app-copy-locked textarea,
.app-copy-locked [contenteditable="true"],
.app-copy-locked [contenteditable="plaintext-only"],
.app-copy-locked [data-allow-copy="true"],
.app-copy-locked [data-allow-copy="true"] * {
    user-select: text;
    -webkit-user-select: text;
}
</style>
