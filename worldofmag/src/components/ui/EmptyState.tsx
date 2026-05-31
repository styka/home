import { ReactNode } from "react"
import { cn } from "@/lib/cn"

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

/**
 * Consistent empty/onboarding state used across module lists
 * (architecture report §18.2 — "stany puste wszędzie").
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--border)] px-6 py-12 text-center",
        className
      )}
    >
      {icon && <div className="text-[var(--text-muted)]">{icon}</div>}
      <div className="space-y-1">
        <p className="text-base font-medium text-[var(--text-primary)]">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-[var(--text-muted)]">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
