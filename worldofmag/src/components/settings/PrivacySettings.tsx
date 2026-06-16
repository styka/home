"use client";

import { useState } from "react";
import { Download, Loader2, ShieldCheck, Trash2, AlertTriangle } from "lucide-react";
import { exportMyData, deleteMyAccount } from "@/actions/privacy";

// Z-050 (RODO art. 15/20) + Z-051 (art. 17): panel prywatności w Ustawieniach.
// „Pobierz moje dane" woła Server Action zbierający komplet danych użytkownika i
// zapisuje je jako JSON po stronie przeglądarki. „Usuń konto" trwale kasuje dane
// po potwierdzeniu adresem e-mail.
export function PrivacySettings() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      // Akcja kończy się signOut→redirect; w razie sukcesu nastąpi nawigacja.
      await deleteMyAccount(confirmEmail);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nie udało się usunąć konta.";
      // Redirecty Next nie są błędem do pokazania.
      if (!/NEXT_REDIRECT/.test(msg)) setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `omnia-moje-dane-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się przygotować eksportu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ShieldCheck size={22} style={{ color: "var(--text-secondary)" }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>Pobierz moje dane</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Komplet Twoich danych ze wszystkich modułów w formacie JSON (RODO art. 15/20).
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleExport}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            background: "var(--accent-blue)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--on-accent)",
            fontSize: 13,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {busy ? "Przygotowuję…" : "Pobierz JSON"}
        </button>
      </div>

      {error ? (
        <p style={{ color: "var(--accent-red)", fontSize: 12, margin: 0 }}>{error}</p>
      ) : (
        <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          Eksport obejmuje dane, których jesteś właścicielem. Dane zespołów oraz sekrety logowania
          (tokeny) nie są zawarte.
        </p>
      )}

      {/* Z-051: strefa niebezpieczna — usunięcie konta */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {!showDelete ? (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
              padding: "8px 14px", background: "transparent", border: "1px solid var(--accent-red)",
              borderRadius: 6, color: "var(--accent-red)", fontSize: 13, cursor: "pointer",
            }}
          >
            <Trash2 size={14} /> Usuń konto
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "var(--accent-red)", fontSize: 13 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Trwale usuniesz konto i wszystkie swoje dane. Operacja jest nieodwracalna. Wpisz swój
                adres e-mail, aby potwierdzić.
              </span>
            </div>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="twój@email"
              autoComplete="off"
              style={{
                padding: "8px 12px", background: "var(--bg-base)", border: "1px solid var(--border)",
                borderRadius: 6, color: "var(--text-primary)", fontSize: 13, maxWidth: 320,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={deleting || !confirmEmail.trim()}
                onClick={handleDelete}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
                  background: "var(--accent-red)", border: "1px solid var(--accent-red)", borderRadius: 6,
                  color: "var(--on-accent)", fontSize: 13,
                  cursor: deleting || !confirmEmail.trim() ? "default" : "pointer",
                  opacity: deleting || !confirmEmail.trim() ? 0.6 : 1,
                }}
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? "Usuwam…" : "Usuń konto trwale"}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => { setShowDelete(false); setConfirmEmail(""); setDeleteError(null); }}
                style={{
                  padding: "8px 16px", background: "transparent", border: "1px solid var(--border)",
                  borderRadius: 6, color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
                }}
              >
                Anuluj
              </button>
            </div>
            {deleteError ? <p style={{ color: "var(--accent-red)", fontSize: 12, margin: 0 }}>{deleteError}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
