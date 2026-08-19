"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { exportSkin } from "@/actions/skins";
import { validateTokens, type SkinTokens } from "@/lib/skins";

/**
 * 045 — skórka jako plik: pobranie i wczytanie.
 *
 * Import działa TU, w edytorze, na wczytanych tokenach — a nie tworzy od razu nową
 * skórkę w bazie. Dzięki temu wczytanie cudzego pliku jest odwracalne jednym „Anuluj",
 * a nie zostawia śmiecia na koncie, jeśli motyw okazał się nietrafiony.
 *
 * Walidacja jest po OBU stronach: tutaj (żeby od razu pokazać, czego nie przyjęto)
 * i w akcji serwerowej `importSkin` (bo tylko serwer jest granicą bezpieczeństwa).
 * Klient nigdy nie jest jedyną barierą.
 */

export function SkinTransfer({
  skinId,
  tokens,
  onImported,
}: {
  skinId: string | null;
  tokens: SkinTokens;
  onImported: (tokens: SkinTokens) => void;
}) {
  const t = useTranslations("components.skins.SkinTransfer");
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);

  async function download() {
    setNote(null);
    try {
      // Skórka zapisana — bierzemy jej wersję z serwera. Nowa, jeszcze niezapisana —
      // eksportujemy to, co widać w edytorze.
      const json = skinId
        ? await exportSkin(skinId)
        : JSON.stringify({ omniaSkin: 1, name: "Moja skórka", description: null, colorScheme: tokens["--color-scheme"] ?? "dark", tokens }, null, 2);

      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "skorka-omnia.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Nie udało się wyeksportować skórki");
    }
  }

  async function upload(file: File) {
    setNote(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { tokens?: unknown };
      const raw = (parsed?.tokens ?? {}) as Record<string, unknown>;
      const safe = validateTokens(raw);
      const rejected = Object.keys(raw).filter((k) => !(k in safe));

      if (Object.keys(safe).length === 0) {
        setNote("Plik nie zawiera ani jednego poprawnego tokenu skórki.");
        return;
      }

      onImported(safe);
      setNote(
        rejected.length > 0
          ? `Wczytano ${Object.keys(safe).length} tokenów. Pominięto ${rejected.length} niedozwolonych: ${rejected.slice(0, 4).join(", ")}${rejected.length > 4 ? "…" : ""}`
          : `Wczytano ${Object.keys(safe).length} tokenów.`,
      );
    } catch {
      setNote("To nie jest poprawny plik skórki (oczekiwano JSON).");
    }
  }

  const buttonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    padding: "0 12px",
    borderRadius: "var(--radius-control)",
    background: "var(--bg-elevated)",
    border: "var(--border-width) var(--border-style) var(--border)",
    color: "var(--text-secondary)",
    fontSize: 12,
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={download} style={buttonStyle}>
        <Download size={13} /> Pobierz jako plik
      </button>

      <button type="button" onClick={() => fileRef.current?.click()} style={buttonStyle}>
        <Upload size={13} /> Wczytaj z pliku
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />

      {note && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{note}</span>}
    </div>
  );
}
