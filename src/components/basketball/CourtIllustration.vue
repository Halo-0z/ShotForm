<script setup lang="ts">
import { useId } from "vue"
const id = `court-${useId().replace(/:/g, "")}`
</script>
<template>
    <svg
        class="court-illustration"
        viewBox="0 0 240 152"
        fill="none"
        aria-hidden="true"
        focusable="false"
    >
        <defs>
            <radialGradient :id="id" cx=".28" cy=".2" r=".8">
                <stop stop-color="#ffe0ac" />
                <stop offset=".55" stop-color="#ec984c" />
                <stop offset="1" stop-color="#a84b20" />
            </radialGradient>
        </defs>
        <path d="m25 119 72-33 119 27-71 35z" fill="currentColor" opacity=".05" />
        <path
            d="m25 115 72-33 119 27-71 35zM94 86l63 15-40 19-63-15M117 120c9 10 27 10 40 4"
            stroke="currentColor"
            stroke-opacity=".2"
            stroke-width="1.5"
        />
        <path
            d="M164 47v60m0-60h15v64"
            stroke="currentColor"
            stroke-opacity=".2"
            stroke-width="5"
        />
        <rect
            x="133"
            y="15"
            width="74"
            height="47"
            rx="5"
            fill="currentColor"
            fill-opacity=".05"
            stroke="currentColor"
            stroke-width="2.5"
        />
        <path d="M154 59V36h32v23" stroke="currentColor" stroke-opacity=".45" stroke-width="2" />
        <path
            d="m150 61 5 24h29l6-24M157 62l17 23m9-23-19 23M152 71h35M155 79h30"
            stroke="currentColor"
            stroke-opacity=".5"
            stroke-width="1.5"
        />
        <ellipse
            cx="170"
            cy="61"
            rx="22"
            ry="5"
            fill="var(--surface-color)"
            stroke="#d78743"
            stroke-width="3"
        />
        <path
            d="M65 67C88 20 125 9 164 50"
            stroke="currentColor"
            stroke-opacity=".25"
            stroke-width="2"
            stroke-dasharray="3 6"
            stroke-linecap="round"
        />
        <ellipse cx="76" cy="124" rx="30" ry="5" fill="currentColor" opacity=".1" />
        <g class="court-illustration__ball">
            <circle
                cx="73"
                cy="91"
                r="29"
                :fill="`url(#${id})`"
                stroke="#995023"
                stroke-width="2"
            />
            <g stroke="#7c4125" stroke-width="2">
                <path d="M44 91h58M73 62v58M54 69c21 12 21 32 0 44M92 69c-21 12-21 32 0 44" />
            </g>
            <path
                d="M52 80a24 24 0 0 1 13-13"
                stroke="#ffe6bf"
                stroke-width="2"
                stroke-linecap="round"
                opacity=".8"
            />
            <g fill="#713919" opacity=".16">
                <circle cx="61" cy="84" r="1" />
                <circle cx="66" cy="96" r="1" />
                <circle cx="88" cy="87" r="1" />
                <circle cx="82" cy="108" r="1" />
                <circle cx="59" cy="102" r="1" />
            </g>
        </g>
    </svg>
</template>
