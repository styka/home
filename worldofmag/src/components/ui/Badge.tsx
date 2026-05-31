import { HTMLAttributes } from "react"
import { cn } from "@/lib/cn"

type Tone = "neutral" | "blue" | "green" | "red" | "amber" | "purple"

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--bg-elevated)] text-[var(--text-secondary)]",
  blue: "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]",
  green: "bg-[var(--accent-green)]/15 text-[var(--accent-green)]",
  red: "bg-[var(--accent-red)]/15 text-[var(--accent-red)]",
  amber: "bg-[var(--accent-amber)]/15 text-[var(--accent-amber)]",
  purple: "bg-[var(--accent-purple)]/15 text-[var(--accent-purple)]",
}

/** Small status/label pill. */
export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  )
}
