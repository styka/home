import { HTMLAttributes, forwardRef } from "react"
import { cn } from "@/lib/cn"

type Tone = "base" | "surface" | "elevated"

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone
  bordered?: boolean
}

const tones: Record<Tone, string> = {
  base: "bg-[var(--bg-base)]",
  surface: "bg-[var(--bg-surface)]",
  elevated: "bg-[var(--bg-elevated)]",
}

/**
 * Generic background surface (panels, sheets, modals). Tone maps to a CSS token,
 * so callers stop hardcoding hex values.
 */
export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ tone = "surface", bordered = false, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        tones[tone],
        bordered && "border border-[var(--border)]",
        className
      )}
      {...props}
    />
  )
)
Surface.displayName = "Surface"
