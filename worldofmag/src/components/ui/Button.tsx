import { ButtonHTMLAttributes, forwardRef } from "react"
import { cn } from "@/lib/cn"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "sm" | "md" | "lg"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

// 118: `whitespace-nowrap` — etykieta przycisku to nazwa akcji, nie akapit. Bez tej reguły w
// ciasnym rzędzie flex tekst łamał się POD ikonę („Nowa przestrzeń" → plus nad napisem);
// kontenery akcji mają `flex-wrap`, więc zawijać ma się cały przycisk, nigdy jego wnętrze.
const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] disabled:opacity-50 disabled:pointer-events-none"

// 045: tekst na tle akcentowym to `--on-accent`, nigdy `text-white` (C-30). Skórka
// z jasnym akcentem (np. bursztyn „Mostka") daje białym napisem kontrast ~1.8:1 —
// przycisk staje się nieczytelny, a wina wygląda na winę skórki, nie kodu.
const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--accent-blue)] text-[var(--on-accent)] hover:opacity-90",
  secondary:
    "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-hover)]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
  danger:
    "bg-[var(--accent-red)] text-[var(--on-accent)] hover:opacity-90",
}

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
}

/**
 * Shared button primitive. Replaces ad-hoc inline-styled buttons across modules
 * (design-system foundation per architecture report §18.2).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  )
)
Button.displayName = "Button"
