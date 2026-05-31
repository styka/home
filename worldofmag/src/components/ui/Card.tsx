import { HTMLAttributes, forwardRef } from "react"
import { cn } from "@/lib/cn"

/**
 * Surface container with the standard elevated background + border.
 * Foundation primitive replacing repeated inline-styled panels.
 */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"
