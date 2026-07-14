"use client";

import { useState, useTransition } from "react";
import { HardDrive, Check, Loader2 } from "lucide-react";
import { disconnectDrive, type DriveStatus } from "@/actions/drive";

// Settings panel for the per-user Google Drive connection. Connecting redirects
// through Google's consent (the /api/drive/connect route); disconnecting is a
// plain server action.
export function DriveSettings({ status, notice }: { status: DriveStatus; notice?: string }) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

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
        <HardDrive size={22} style={{ color: "var(--text-secondary)" }} />
        <div style={{ flex: 1 }}>
          {status.connected ? (
            <>
              <div style={{ color: "var(--text-primary)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                <Check size={15} style={{ color: "var(--accent-green)" }} /> Połączono
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                {status.email ?? "Twój Dysk Google"}
                {status.fileCount > 0 ? ` · ${status.fileCount} plik(ów)` : ""}
              </div>
            </>
          ) : (
            <>
              <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>Dysk Google nie jest połączony</div>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Połącz, aby wgrywać pliki (zdjęcia) do własnego Dysku.
              </div>
            </>
          )}
        </div>

        {status.connected ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => void disconnectDrive())}
            style={btnStyle("transparent")}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : null} Odłącz
          </button>
        ) : (
          <a
            href="/api/drive/connect"
            onClick={() => setBusy(true)}
            style={{ ...btnStyle("var(--accent-blue)"), color: "var(--on-accent)", textDecoration: "none" }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} Połącz Dysk Google
          </a>
        )}
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
        Aplikacja używa uprawnienia <code>drive.file</code> — widzi i zarządza wyłącznie plikami,
        które sama utworzy w folderze <strong>„Omnia”</strong> na Twoim Dysku. Nie ma dostępu do
        reszty Twoich plików.
      </p>

      {notice === "connected" ? (
        <p style={{ color: "var(--accent-green)", fontSize: 12, margin: 0 }}>Połączono pomyślnie.</p>
      ) : notice === "error" ? (
        <p style={{ color: "var(--accent-red)", fontSize: 12, margin: 0 }}>
          Nie udało się połączyć. Spróbuj ponownie.
        </p>
      ) : notice === "denied" ? (
        <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>Anulowano połączenie.</p>
      ) : null}
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    background: bg,
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--text-secondary)",
    fontSize: 13,
    cursor: "pointer",
  };
}
