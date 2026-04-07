import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Badge } from "./Badge.vue"

export const badgeVariants = cva(
  "inline-flex gap-1 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all duration-150",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--glass-sm)] text-[var(--text-secondary)] border border-[var(--surface-border)]",
        secondary:
          "bg-[var(--glass-xs)] text-[var(--text-muted)] border border-[var(--border-color)]",
        destructive:
          "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border border-[var(--color-danger-border)]",
        outline: "text-[var(--text-primary)] border border-[var(--surface-border)] bg-[var(--glass-xs)]",
        excellent:
          "bg-[var(--color-success-bg)] text-[var(--quality-excellent)] border border-[var(--color-success-border)]",
        good:
          "bg-[color-mix(in_srgb,var(--quality-good)_14%,transparent)] text-[var(--quality-good)] border border-[color-mix(in_srgb,var(--quality-good)_34%,transparent)]",
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
