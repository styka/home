"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useShortcuts, type RegisteredShortcut } from "@/components/shell/ShortcutsProvider";
import type { FavoriteViewDTO } from "@/lib/favorites/favoriteViews";

interface FavoritesShortcutsProps {
  /** Ulubione JUŻ przefiltrowane po uprawnieniach (AC-8) — skrót nie może omijać RBAC. */
  favorites: FavoriteViewDTO[];
  /** Otwarcie pełnej listy (Alt+0). */
  onOpenSwitcher: () => void;
}

/**
 * 042: `Alt+1..9` skacze do n-tego ulubionego, `Alt+0` otwiera pełną listę.
 *
 * 043: skróty nie mają już własnego nasłuchiwacza — **rejestrują się we wspólnym rejestrze**
 * (`ShortcutsProvider`) jako `scope: "global"`. Dwie rzeczy z tego wynikają i obie były błędami
 * zgłoszonymi przez właściciela:
 *
 *  1. **Koniec kolizji.** Wcześniej `Alt+1` odpalał ten listener ORAZ `switch (e.key)` w
 *     `useKeyboardShortcuts`, który nie sprawdzał modyfikatorów — skok do ulubionego i zmiana
 *     zakładki filtra naraz. Teraz dopasowanie idzie przez `matchShortcut`, gdzie goły klawisz
 *     wymaga braku Alt/Ctrl/Meta, a skróty strony mają pierwszeństwo przed globalnymi.
 *  2. **Widać je w ściągawce** (`?`), bo ściągawka czyta rejestr.
 *
 * Warunek `!ctrlKey` (AltGr = Ctrl+Alt na polskiej klawiaturze, wpisywanie `ą ć ę ł ń ó ś ź ż`)
 * i pomijanie pisania w polach są teraz regułami rejestru — nie trzeba ich powtarzać tutaj.
 */
export function FavoritesShortcuts({ favorites, onOpenSwitcher }: FavoritesShortcutsProps) {
  const router = useRouter();

  const entries = useMemo<RegisteredShortcut[]>(() => {
    const out: RegisteredShortcut[] = [];

    out.push({
      id: "fav-switcher",
      keys: "Alt+0",
      label: "Wszystkie ulubione (wyszukiwarka)",
      group: "Ulubione",
      scope: "global",
      handler: () => { onOpenSwitcher(); },
    });

    for (let i = 0; i < 9; i++) {
      const target = favorites[i];
      if (!target) break;
      out.push({
        id: `fav-${i + 1}`,
        keys: `Alt+${i + 1}`,
        label: target.label,
        group: "Ulubione",
        scope: "global",
        handler: () => { router.push(target.path); },
      });
    }

    return out;
  }, [favorites, router, onOpenSwitcher]);

  useShortcuts(entries);

  return null;
}
