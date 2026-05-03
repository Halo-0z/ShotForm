import { onMounted, onUnmounted } from "vue"
import { hasTauriRuntime } from "@/lib/tauri-runtime"

const STORAGE_KEY = "window-state"

interface WindowState {
    x: number | null
    y: number | null
    width: number
    height: number
}

async function setTauriWindowPosition(x: number, y: number) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window")
    await getCurrentWindow().setPosition(
        new (await import("@tauri-apps/api/dpi")).LogicalPosition(x, y),
    )
}

async function setTauriWindowSize(width: number, height: number) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window")
    await getCurrentWindow().setSize(
        new (await import("@tauri-apps/api/dpi")).LogicalSize(width, height),
    )
}

async function getTauriWindowState(): Promise<WindowState> {
    const { getCurrentWindow } = await import("@tauri-apps/api/window")
    const win = getCurrentWindow()
    const pos = await win.outerPosition()
    const size = await win.outerSize()
    return {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
    }
}

function readSavedState(): WindowState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? (JSON.parse(raw) as WindowState) : null
    } catch {
        return null
    }
}

function saveState(state: WindowState) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
        // ignore quota errors
    }
}

export function useWindowPositionMemory() {
    if (!hasTauriRuntime()) return
    if (new URLSearchParams(window.location.search).get("surface") === "tray") return

    let unlistenClose: (() => void) | undefined

    const restoreWindow = async () => {
        try {
            const saved = readSavedState()
            if (!saved) return

            if (saved.x !== null && saved.y !== null) {
                await setTauriWindowPosition(saved.x, saved.y)
            }
            if (saved.width > 0 && saved.height > 0) {
                await setTauriWindowSize(saved.width, saved.height)
            }
        } catch {
            // ignore restoration errors
        }
    }

    onMounted(async () => {
        await restoreWindow()

        try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window")
            const win = getCurrentWindow()
            unlistenClose = await win.onCloseRequested(async (_event) => {
                try {
                    const state = await getTauriWindowState()
                    saveState(state)
                } catch {
                    // ignore
                }
            })
        } catch {
            // ignore
        }
    })

    onUnmounted(() => {
        if (unlistenClose) {
            unlistenClose()
        }
    })
}
