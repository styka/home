/**
 * 109: stan pusty sekcji ustawień.
 *
 * `ModuleView` ma prop `state` na stany brzegowe CAŁEGO widoku, a tu chodzi o coś węższego: widok
 * wczytał się poprawnie, tylko ta jedna sekcja nie ma czego pokazać. Użycie `state="empty"`
 * skasowałoby razem z treścią listę sekcji, czyli jedyne wyjście z tego ekranu.
 */
export function PustaSekcja({ tytul, opis }: { tytul: string; opis: string }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "20px 24px",
      }}
    >
      <div style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 500 }}>{tytul}</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{opis}</div>
    </div>
  );
}
