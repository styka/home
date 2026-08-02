"use client";

import { useCallback, useEffect, useState } from "react";
import { FavoritesSwitcher } from "./FavoritesSwitcher";
import { FavoritesShortcuts } from "./FavoritesShortcuts";
import { FAVORITES_OPEN_EVENT } from "@/lib/favorites/favoritesBus";
import { filterAccessibleFavorites, type FavoriteViewDTO } from "@/lib/favorites/favoriteViews";

interface FavoritesOverlayProps {
  favorites: FavoriteViewDTO[];
  userPermissions: string[];
}

/**
 * 042: montowane RAZ w `AppShell`. Trzyma nakładkę przełącznika i globalne skróty, żeby nie
 * powielały się przy dwóch wyzwalaczach (pasek boczny + pasek górny) — patrz `favoritesBus.ts`.
 *
 * Filtr uprawnień jest tutaj, żeby zarówno lista, jak i skróty klawiszowe widziały dokładnie
 * ten sam, dozwolony zbiór (AC-8).
 */
export function FavoritesOverlay({ favorites, userPermissions }: FavoritesOverlayProps) {
  const [open, setOpen] = useState(false);
  const accessible = filterAccessibleFavorites(favorites, userPermissions);

  useEffect(() => {
    function onOpen() { setOpen(true); }
    window.addEventListener(FAVORITES_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(FAVORITES_OPEN_EVENT, onOpen);
  }, []);

  const handleOpen = useCallback(() => setOpen(true), []);

  return (
    <>
      <FavoritesShortcuts favorites={accessible} onOpenSwitcher={handleOpen} />
      <FavoritesSwitcher favorites={accessible} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
