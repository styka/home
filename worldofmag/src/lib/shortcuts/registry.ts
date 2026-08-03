// 043: JEDNO miejsce prawdy o skrótach klawiszowych — definicje, dopasowanie i reguły modyfikatorów.
//
// Powód powstania jest konkretny: w 042 `useKeyboardShortcuts` reagował na gołe cyfry `1`–`5`
// (zakładki filtrów) w `switch (e.key)` **bez sprawdzania modyfikatorów**, a skróty ulubionych
// (`Alt+1..9`) siedziały w osobnym listenerze. Efekt: `Alt+1` odpalał OBA — skok do ulubionego
// i przełączenie zakładki. Naprawa objawu (dopisanie `!e.altKey` w jednym miejscu) zostawiłaby
// tę samą pułapkę na następny skrót, więc reguła mieszka tu i tylko tu.
//
// Moduł jest czysto obliczeniowy (bez Reacta, bez Prismy) — tak samo jak
// `lib/favorites/favoriteViews.ts` i `lib/ai/assistantStarters.ts`.

/** `"page"` wygrywa z `"global"` — skrót strony ma pierwszeństwo (decyzja właściciela, 043). */
export type ShortcutScope = "page" | "global";

export interface ShortcutDef {
  /** Stabilny identyfikator (do kluczy Reacta i do wykrywania duplikatów). */
  id: string;
  /** Zapis skrótu: `"j"`, `"Alt+1"`, `"Ctrl+K"`, `"?"`, `"ArrowDown"`. */
  keys: string;
  /** Opis po polsku — trafia wprost do ściągawki (C-32). */
  label: string;
  /** Nagłówek grupy w ściągawce, np. „Nawigacja", „Ulubione". */
  group: string;
  scope: ShortcutScope;
}

interface ParsedKeys {
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  /** Główny klawisz, znormalizowany do małych liter dla znaków jednoliterowych. */
  key: string;
}

function parseKeys(keys: string): ParsedKeys {
  const parts = keys.split("+").map((p) => p.trim()).filter(Boolean);
  const out: ParsedKeys = { alt: false, ctrl: false, meta: false, key: "" };
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "alt") out.alt = true;
    else if (lower === "ctrl" || lower === "control") out.ctrl = true;
    else if (lower === "meta" || lower === "cmd") out.meta = true;
    else out.key = part.length === 1 ? part.toLowerCase() : part;
  }
  return out;
}

/**
 * Czy zdarzenie odpowiada skrótowi.
 *
 * Trzy reguły, wszystkie wynikające z realnych błędów, a nie z teorii:
 *
 *  1. **Goły klawisz wymaga BRAKU Alt/Ctrl/Meta.** To jest naprawa kolizji `Alt+1` — bez tego
 *     `Alt+1` pasuje jednocześnie do skrótu ulubionych i do gołej `1` (zakładka filtra).
 *  2. **`Shift` NIE blokuje.** Shift jest częścią wpisywania znaku (`?` to Shift+/), więc
 *     traktowanie go jak modyfikatora blokującego uniemożliwiłoby ściągawkę.
 *  3. **`Alt+…` wymaga `!ctrlKey`.** Na klawiaturze polskiej **AltGr = Ctrl+Alt** i służy do
 *     wpisywania `ą ć ę ł ń ó ś ź ż`. Bez tego skrót przechwytywałby polskie znaki w aplikacji,
 *     której cały interfejs jest po polsku (C-32).
 *
 * Cyfry porównujemy przez `e.code` (`"Digit1"`), bo przy wciśniętym Alt układ klawiatury potrafi
 * zwrócić w `e.key` znak specjalny zamiast cyfry.
 */
export function matchShortcut(e: KeyboardEvent, keys: string): boolean {
  const want = parseKeys(keys);

  if (want.alt !== e.altKey) return false;
  if (want.meta !== e.metaKey) return false;
  // Ctrl: gdy skrót go nie wymaga, musi być wyłączony — także (a zwłaszcza) przy skrótach z Altem.
  if (want.ctrl !== e.ctrlKey) return false;

  if (/^[0-9]$/.test(want.key)) return e.code === `Digit${want.key}`;
  // Spację zapisujemy jako `"Space"`, bo `" "` zniknęłoby przy rozbijaniu zapisu po `+`.
  if (want.key.toLowerCase() === "space") return e.key === " ";
  if (want.key.length === 1) return e.key.toLowerCase() === want.key;
  return e.key === want.key;
}

/** Czy fokus jest w polu, w którym użytkownik pisze — wtedy skróty milczą (AC-12). */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.getAttribute("contenteditable") === "true";
}

const KEY_LABELS: Record<string, string> = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  escape: "Esc",
  enter: "Enter",
  delete: "Delete",
  backspace: "Backspace",
  " ": "Spacja",
  space: "Spacja",
};

/** Zapis skrótu w postaci czytelnej dla człowieka — używa go ściągawka. */
export function formatKeys(keys: string): string {
  return keys
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "alt") return "Alt";
      if (lower === "ctrl" || lower === "control") return "Ctrl";
      if (lower === "meta" || lower === "cmd") return "Cmd";
      return KEY_LABELS[lower] ?? (part.length === 1 ? part.toUpperCase() : part);
    })
    .join(" + ");
}

/** Kolejność wyświetlania grup w ściągawce; nieznane grupy lądują na końcu. */
export const SHORTCUT_GROUP_ORDER = ["Nawigacja", "Działanie", "Widok", "Ulubione", "Ogólne"];

export function compareGroups(a: string, b: string): number {
  const ia = SHORTCUT_GROUP_ORDER.indexOf(a);
  const ib = SHORTCUT_GROUP_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b, "pl");
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}
