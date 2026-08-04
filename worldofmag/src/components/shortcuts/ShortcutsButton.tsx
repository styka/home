"use client";

import { Keyboard } from "lucide-react";
import { openShortcutsCheatSheet } from "@/lib/shortcuts/shortcutsBus";

/**
 * 045 — wejście do ściągawki skrótów w pasku bieżącego widoku.
 *
 * Omnia jest aplikacją keyboard-first (C-31), ale jedynym sposobem na poznanie skrótów
 * był klawisz `?` — czyli skrót, o którym trzeba było wcześniej wiedzieć. Przycisk nie
 * dokłada żadnej funkcji, tylko czyni istniejącą odkrywalną.
 *
 * Na telefonie ukryty: ściągawka klawiszowa bez klawiatury nie ma odbiorcy, a miejsce
 * w pasku jest tam najcenniejsze.
 */
export function ShortcutsButton() {
  return (
    <button
      type="button"
      onClick={openShortcutsCheatSheet}
      title="Skróty klawiszowe (?)"
      aria-label="Pokaż skróty klawiszowe"
      className="hidden md:flex"
      style={{
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: "var(--radius-control)",
        background: "transparent",
        border: "none",
        color: "var(--text-secondary)",
        cursor: "pointer",
      }}
    >
      <Keyboard size={16} />
    </button>
  );
}
