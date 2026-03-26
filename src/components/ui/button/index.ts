import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Button } from "./Button.vue"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-br from-[var(--primary-color)] to-[var(--primary-hover)] text-white shadow-[0_2px_8px_rgba(99,102,241,0.3),var(--inset-highlight)] hover:shadow-[0_4px_12px_rgba(99,102,241,0.4),var(--inset-highlight)] active:shadow-[var(--inset-depth)]",
        destructive:
          "bg-gradient-to-br from-[var(--color-danger)] to-[var(--color-danger-hover)] text-white shadow-[0_2px_8px_rgba(239,68,68,0.3),var(--inset-highlight)] hover:shadow-[0_4px_12px_rgba(239,68,68,0.4),var(--inset-highlight)]",
        outline:
          "border border-[var(--surface-border)] bg-[var(--glass-md)] backdrop-blur-sm text-[var(--text-primary)] shadow-[var(--shadow-sm),var(--inset-highlight)] hover:bg-[var(--glass-lg)] hover:border-[var(--border-color)] hover:shadow-[var(--shadow-md),var(--inset-highlight)]",
        secondary:
          "bg-[var(--glass-md)] backdrop-blur-sm text-[var(--text-primary)] border border-[var(--surface-border)] shadow-[var(--shadow-sm),var(--inset-highlight)] hover:bg-[var(--glass-lg)] hover:border-[var(--border-color)]",
        ghost: "hover:bg-[var(--glass-sm)] hover:text-[var(--text-primary)]",
        link: "text-[var(--primary-color)] underline-offset-4 hover:underline",
        accent: "bg-gradient-to-br from-[var(--accent-color)] to-[var(--accent-hover)] text-white shadow-[0_2px_8px_rgba(16,185,129,0.3),var(--inset-highlight)] hover:shadow-[0_4px_12px_rgba(16,185,129,0.4),var(--inset-highlight)]",
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
