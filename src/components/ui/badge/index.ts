import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Badge } from "./Badge.vue"

export const badgeVariants = cva(
  "inline-flex gap-1 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all duration-150",
  {
    variants: {
      variant: {
        default:
          "bg-[rgba(99,102,241,0.1)] text-[var(--primary-color)] border border-[rgba(99,102,241,0.25)]",
        secondary:
          "bg-[var(--glass-sm)] text-[var(--text-secondary)] border border-[var(--surface-border)]",
        destructive:
          "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]",
        outline: "text-[var(--text-primary)] border border-[var(--surface-border)] bg-[var(--glass-xs)]",
        excellent:
          "bg-[var(--color-success-bg)] text-[var(--quality-excellent)] border border-[var(--color-success-border)]",
        good:
          "bg-[rgba(59,130,246,0.1)] text-[var(--quality-good)] border border-[rgba(59,130,246,0.25)]",
        average:
          "bg-[var(--color-warning-bg)] text-[var(--quality-average)] border border-[var(--color-warning-border)]",
        poor:
          "bg-[var(--color-danger-bg)] text-[var(--quality-poor)] border border-[var(--color-danger-border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export type BadgeVariants = VariantProps<typeof badgeVariants>
