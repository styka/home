import { pageContainerStyle, pageInnerStyle } from "./styles";

/**
 * Spójny stan ładowania całej strony (route-level `loading.tsx`).
 * Delikatne „szkielety" + pulsowanie — zamiast pustego ekranu przy nawigacji.
 */
export function LoadingState({ label = "Ładowanie…", rows = 4 }: { label?: string; rows?: number }) {
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
        <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 4 }}>{label}</span>
      </div>
      <style>{`
        .omnia-skeleton {
          background: linear-gradient(90deg, var(--bg-surface) 25%, var(--bg-elevated) 37%, var(--bg-surface) 63%);
          background-size: 400% 100%;
          animation: omnia-shimmer 1.4s ease-in-out infinite;
        }
        @keyframes omnia-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
      `}</style>
    </div>
  );
}
