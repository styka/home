import { ButtonHTMLAttributes, forwardRef } from "react"
import { cn } from "@/lib/cn"

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label — required since the button has no visible text. */
  label: string
  size?: "sm" | "md"
}

const sizes = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
}

/** Square, icon-only button with an accessible label. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, size = "md", className, children, ...props }, ref) => (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] disabled:opacity-50",
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
)
IconButton.displayName = "IconButton"
