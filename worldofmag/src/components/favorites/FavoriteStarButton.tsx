"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Star } from "lucide-react";
import { openFavoritesSwitcher } from "@/platform/favorites/favoritesBus";
import { normalizeFavoritePath, type FavoriteViewDTO } from "@/platform/favorites/favoriteViews";

interface FavoriteStarButtonProps {
  favorites: FavoriteViewDTO[];
  /**
   * `topbar` — sama ikona w górnym pasku (telefon) · `chrome` — sama ikona w rzędzie chromu
   * pod nazwą aplikacji (komputer). Od 087 wariant wpływa już wyłącznie na kontekst, w jakim ikona
   * stoi — dialog jest jeden i pełnoekranowy, więc nie ma kierunku otwierania do wyboru.
   */
  placement: "topbar" | "chrome";
}

/**
 * 042/087: gwiazdka — JEDNO wejście do ulubionych.
 *
 * Do 087 gwiazdka miała własne okienko „zapisz to miejsce", a obok stał drugi przycisk otwierający
 * listę zapisanych widoków. Dwa wejścia do jednej rzeczy nie dawały wyboru, tylko niepewność, które
 * jest właściwe — i to było zgłoszenie właściciela. Teraz gwiazdka otwiera **ten sam** dialog co
 * `Alt+0`, a dodanie i usunięcie bieżącego widoku jest jego pierwszą pozycją (`FavoriteViewForm`).
 *
 * Sam przycisk pokazuje stan bieżącego adresu (pełna/pusta gwiazdka), bo to jedyna informacja,
 * której dialog nie zdąży przekazać przed otwarciem.
 */
export function FavoriteStarButton({ favorites, placement }: FavoriteStarButtonProps) {
  const pathname = usePathname();

  // Pełny adres (ze `?query`) czytamy z przeglądarki, a NIE przez `useSearchParams`: ten ostatni
  // w komponencie powłoki wymusza granicę Suspense i potrafi zepchnąć całą aplikację
  // w renderowanie po stronie klienta (lekcja z 042), a powłoka opakowuje każdą stronę.
  const [fullPath, setFullPath] = useState<string | null>(null);
  useEffect(() => {
    setFullPath(normalizeFavoritePath(window.location.pathname + window.location.search));
  }, [pathname]);

  const zapisany = !!fullPath && favorites.some((f) => f.path === fullPath);
  const tytul = zapisany ? "Ulubione — ten widok jest zapisany" : "Ulubione widoki";

  return (
    <button
      onClick={openFavoritesSwitcher}
      title={tytul}
      aria-label={tytul}
      aria-pressed={zapisany}
      data-placement={placement}
      className="flex items-center justify-center rounded focus:outline-none"
      style={{
        color: zapisany ? "var(--accent-amber)" : "var(--text-secondary)",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        // Cel dotyku ≥32 px (C-31) — w obu wariantach ta sama ikona tej samej wielkości.
        width: 32,
        height: 32,
      }}
    >
      <Star size={18} fill={zapisany ? "var(--accent-amber)" : "none"} style={{ flexShrink: 0 }} />
    </button>
  );
}
