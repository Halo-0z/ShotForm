import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Button } from "./Button.vue"

export const buttonVariants = cva(
  "button-surface inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium disabled:cursor-not-allowed disabled:opacity-[0.55] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "button-variant-default",
        destructive:
          "bg-gradient-to-br from-[var(--color-danger)] to-[var(--color-danger-hover)] text-white shadow-[0_2px_8px_rgba(239,68,68,0.3),var(--inset-highlight)] hover:shadow-[0_4px_12px_rgba(239,68,68,0.4),var(--inset-highlight)]",
        outline:
          "border border-[var(--surface-border)] bg-[var(--card-bg)] text-[var(--text-primary)] shadow-[var(--shadow-sm),var(--inset-highlight)] hover:bg-[var(--glass-sm)] hover:border-[var(--border-color)]",
        secondary:
          "bg-[var(--glass-sm)] text-[var(--text-secondary)] border border-[var(--surface-border)] shadow-[var(--shadow-sm),var(--inset-highlight)] hover:bg-[var(--glass-md)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)]",
        "segmented-active":
          "button-variant-segmented-active",
        "upload-cta":
          "button-variant-upload-cta",
        ghost: "hover:bg-[var(--glass-xs)] hover:text-[var(--text-primary)]",
        link: "text-[var(--primary-color)] underline-offset-4 hover:underline",
        accent: "bg-[var(--accent-color)] text-[var(--text-inverse)] border border-[color-mix(in_srgb,var(--accent-hover)_78%,black)] shadow-[var(--shadow-sm),inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-md),inset_0_1px_0_rgba(255,255,255,0.16)]",
      },
      size: {
        "default": "h-9 px-4 py-2",
        "xs": "h-7 rounded px-2",
        "sm": "h-8 rounded-md px-3 text-xs",
        "lg": "h-10 rounded-md px-8",
        "icon": "h-9 w-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
