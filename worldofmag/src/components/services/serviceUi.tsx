import { Star, BadgeCheck } from "lucide-react";
import type { RequestStatus, PriceModel } from "@/lib/services";
import { REQUEST_STATUS_LABELS, PRICE_MODEL_LABELS } from "@/lib/services";

/** Plakietka „zweryfikowany wykonawca" (M7). */
export function VerifiedBadge({ size = 13, withLabel = false }: { size?: number; withLabel?: boolean }) {
  return (
    <span title="Zweryfikowany wykonawca" style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--accent-green)", fontSize: 11, fontWeight: 600 }}>
      <BadgeCheck size={size} />
      {withLabel && "Zweryfikowany"}
    </span>
  );
}

export const STATUS_COLOR: Record<RequestStatus, string> = {
  REQUESTED: "var(--accent-amber)",
  ACCEPTED: "var(--accent-blue)",
  DECLINED: "var(--text-muted)",
  SCHEDULED: "var(--accent-purple)",
  IN_PROGRESS: "var(--accent-blue)",
  COMPLETED: "var(--accent-green)",
  CANCELLED: "var(--text-muted)",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        color,
        background: "color-mix(in srgb, currentColor 14%, transparent)",
        padding: "2px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {REQUEST_STATUS_LABELS[status]}
    </span>
  );
}

/** Cena oferty w czytelnej formie (kwota w groszach → PLN). */
export function formatPrice(priceModel: PriceModel, amount: number | null, currency: string): string {
  if (priceModel === "quote" || amount == null) return PRICE_MODEL_LABELS.quote;
  const value = (amount / 100).toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const suffix = priceModel === "hourly" ? " / godz." : "";
  return `${value} ${currency}${suffix}`;
}

export function RatingStars({ avg, count, size = 13 }: { avg: number; count: number; size?: number }) {
  if (count === 0) {
    return <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Brak ocen</span>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Star size={size} fill="var(--accent-amber)" color="var(--accent-amber)" />
      <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{avg.toFixed(1)}</span>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({count})</span>
    </span>
  );
}

export const fieldInputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "8px 10px",
  color: "var(--text-primary)",
  fontSize: 13,
};

export const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  display: "block",
  marginBottom: 4,
};

export const primaryButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  background: "var(--accent-blue)",
  color: "var(--on-accent)",
  fontSize: 13,
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
};

export const secondaryButtonStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 8,
  background: "var(--bg-elevated)",
  color: "var(--text-secondary)",
  fontSize: 13,
  fontWeight: 500,
  border: "1px solid var(--border)",
  cursor: "pointer",
};
