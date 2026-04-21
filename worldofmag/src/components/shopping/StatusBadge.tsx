import type { ItemStatus } from "@/types";
import { cn } from "@/lib/cn";

interface StatusBadgeProps {
  status: ItemStatus;
  className?: string;
}

const STATUS_CONFIG: Record<ItemStatus, { label: string; style: React.CSSProperties }> = {
  NEEDED: {
    label: "needed",
    style: { color: "var(--text-muted)", backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)" },
  },
  IN_CART: {
    label: "in cart",
    style: { color: "var(--accent-blue)", backgroundColor: "rgba(59,130,246,0.1)", borderColor: "rgba(59,130,246,0.3)" },
  },
  DONE: {
    label: "done",
    style: { color: "var(--accent-green)", backgroundColor: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.3)" },
  },
  MISSING: {
    label: "missing",
    style: { color: "var(--accent-amber)", backgroundColor: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)" },
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-xs border font-mono",
        className
      )}
      style={config.style}
    >
      {config.label}
    </span>
  );
}
