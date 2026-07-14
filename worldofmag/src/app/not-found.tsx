import Link from "next/link";
import { Compass } from "lucide-react";

/**
 * Z-111: spójna strona 404 (zamiast domyślnej Next). Renderowana wewnątrz root
 * layoutu (AppShell), więc nawigacja jest dostępna.
 */
export default function NotFound() {
  return (
    <div
      style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 14, padding: "40px 20px", textAlign: "center", backgroundColor: "var(--bg-base)",
        color: "var(--text-primary)",
      }}
    >
      <div
        style={{
          width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--bg-elevated)", color: "var(--text-secondary)",
        }}
      >
        <Compass size={24} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 600 }}>Nie znaleziono strony</div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 380, lineHeight: 1.5 }}>
        Strona, której szukasz, nie istnieje lub została przeniesiona.
      </div>
      <Link
        href="/"
        style={{
          padding: "9px 18px", marginTop: 4, background: "var(--accent-blue)", border: "1px solid var(--accent-blue)",
          borderRadius: 6, color: "var(--on-accent)", fontSize: 14, textDecoration: "none",
        }}
      >
        Wróć do pulpitu
      </Link>
    </div>
  );
}
