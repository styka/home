import { pageContainerStyle, pageInnerStyle } from "./styles";
import { useTranslations } from "next-intl";

/**
 * Spójny stan ładowania całej strony (route-level `loading.tsx`).
 * Delikatne „szkielety" + pulsowanie — zamiast pustego ekranu przy nawigacji.
 */
export function LoadingState({ label, rows = 4 }: { label?: string; rows?: number }) {
  const t = useTranslations("ui");
  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <div className="omnia-skeleton" style={{ height: 26, width: 200, borderRadius: 8 }} />
        <div className="omnia-skeleton" style={{ height: 13, width: 280, borderRadius: 6, marginTop: -8 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="omnia-skeleton" style={{ height: 56, borderRadius: 10 }} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 4 }}>{label ?? t("loading")}</span>
      </div>
    </div>
  );
}
