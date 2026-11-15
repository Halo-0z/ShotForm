<script setup lang="ts">
import { useId } from "vue"
withDefaults(
    defineProps<{
        name?:
            | "ball"
            | "court"
            | "upload"
            | "replay"
            | "history"
            | "compare"
            | "template"
            | "play"
            | "pause"
            | "save"
            | "export"
            | "target"
            | "settings"
    }>(),
    { name: "ball" },
)
const id = `ball-${useId().replace(/:/g, "")}`
</script>

<template>
    <svg
        class="basketball-glyph"
        :data-glyph="name"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        focusable="false"
    >
        <defs>
            <radialGradient :id="id" cx=".3" cy=".2" r=".85">
                <stop stop-color="#ffd69a" />
                <stop offset=".48" stop-color="#ed9a4d" />
                <stop offset="1" stop-color="#b75b25" />
            </radialGradient>
        </defs>
        <g v-if="name === 'ball'" class="basketball-glyph__ball">
            <circle cx="16" cy="17" r="12" fill="#592d1b" opacity=".32" />
            <circle
                cx="16"
                cy="15"
                r="12"
                :fill="`url(#${id})`"
                stroke="#91451f"
                stroke-width="1.4"
            />
            <g stroke="#753e24" stroke-width="1.35" stroke-linecap="round">
                <path d="M4 15h24M16 3v24M8 6c8 4 8 14 0 18M24 6c-8 4-8 14 0 18" />
            </g>
            <path
                d="M8 10a10 10 0 0 1 6-5"
                stroke="#fff0d3"
                stroke-width="1.4"
                stroke-linecap="round"
                opacity=".8"
            />
        </g>
        <g
            v-else
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <g v-if="name === 'court'">
                <rect
                    x="3.5"
                    y="5"
                    width="25"
                    height="22"
                    rx="4"
                    fill="currentColor"
                    fill-opacity=".06"
                />
                <path d="M16 5v22M4 10h5v12H4m24-12h-5v12h5" />
                <circle cx="16" cy="16" r="4" fill="#ed9a4d" fill-opacity=".85" />
            </g>
            <g v-else-if="name === 'upload'">
                <path d="M5 19v7h22v-7M16 21V5m-6 6 6-6 6 6" />
                <path d="m8 26 3 3h10l3-3" stroke="#dc914f" />
            </g>
            <g v-else-if="name === 'replay'">
                <rect
                    x="4"
                    y="4"
                    width="24"
                    height="24"
                    rx="5"
                    fill="currentColor"
                    fill-opacity=".06"
                />
                <path d="M4 10h24M4 22h24M10 4v6m12-6v6M10 22v6m12-6v6" />
                <path d="m13 12 7 4-7 4z" fill="#ed9a4d" stroke="#dc914f" />
            </g>
            <g v-else-if="name === 'history'">
                <path
                    d="M7 5h18v23H7zM12 10h8M12 15h8M12 20h4"
                    fill="currentColor"
                    fill-opacity=".06"
                />
                <path d="M4 9h5M4 15h5M4 21h5" />
                <circle cx="24" cy="24" r="5" :fill="`url(#${id})`" stroke="#91451f" />
                <path d="M24 21v3l2 1" stroke="#753e24" />
            </g>
            <g v-else-if="name === 'compare'">
                <path
                    d="m11 5 5 4 5-4 7 6-4 5-3-2v14H11V14l-3 2-4-5z"
                    fill="currentColor"
                    fill-opacity=".07"
                />
                <path d="m13 18 3-3 3 3m-6 4 3 3 3-3" stroke="#dc914f" />
            </g>
            <g v-else-if="name === 'template'">
                <path d="m7 4 17 2 3 22H6z" fill="currentColor" fill-opacity=".06" />
                <path d="M10 11h10M10 23h10" />
                <path
                    d="m15 13 1.6 3.1 3.4.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4-2.5-2.4 3.4-.5z"
                    fill="#ed9a4d"
                    stroke="#dc914f"
                    stroke-width="1"
                />
            </g>
            <g v-else-if="name === 'play'">
                <path d="m11 6 16 10-16 10z" fill="currentColor" stroke-width="1.2" />
            </g>
            <g v-else-if="name === 'pause'">
                <rect x="7" y="6" width="6" height="20" rx="1.5" fill="currentColor" />
                <rect x="20" y="6" width="6" height="20" rx="1.5" fill="currentColor" />
            </g>
            <g v-else-if="name === 'save'">
                <path d="M5 4h18l5 5v19H5z" fill="currentColor" fill-opacity=".07" />
                <path d="M10 4v9h12V4M10 28V18h13v10" />
                <path d="m13 22 2 2 5-5" stroke="#dc914f" />
            </g>
            <g v-else-if="name === 'export'">
                <path d="M18 4H6v24h20V17M13 19 28 4M19 4h9v9" />
                <path d="M10 24h10" stroke="#dc914f" />
            </g>
            <g v-else-if="name === 'settings'">
                <path d="M5 8h22M5 16h22M5 24h22" />
                <rect x="10" y="4" width="5" height="8" rx="2" fill="#ed9a4d" />
                <rect x="20" y="12" width="5" height="8" rx="2" fill="#ed9a4d" />
                <rect x="8" y="20" width="5" height="8" rx="2" fill="#ed9a4d" />
            </g>
            <g v-else>
                <circle cx="16" cy="16" r="11" />
                <circle cx="16" cy="16" r="5" />
                <path d="m16 2 0 5m14 9h-5M16 30v-5M2 16h5" />
                <circle cx="16" cy="16" r="1.5" fill="#ed9a4d" stroke="none" />
            </g>
        </g>
    </svg>
</template>

<style scoped>
.basketball-glyph {
    width: 24px;
    height: 24px;
    flex: none;
    overflow: visible;
}
.basketball-glyph__ball {
    transform-origin: 16px 15px;
    transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
</style>
