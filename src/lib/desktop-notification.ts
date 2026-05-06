import { hasTauriRuntime } from "@/lib/tauri-runtime"

export async function showDesktopNotification(title: string, body?: string): Promise<void> {
    if (!hasTauriRuntime()) return

    try {
        const { sendNotification, isPermissionGranted, requestPermission } =
            await import("@tauri-apps/plugin-notification")

        let granted = await isPermissionGranted()
        if (!granted) {
            const result = await requestPermission()
            granted = result === "granted"
        }

        if (granted) {
            void sendNotification({ title, body: body ?? "" })
        }
    } catch {
        console.warn("[Notification] plugin not available")
    }
}
