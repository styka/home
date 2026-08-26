"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { dopisz, odczytaj, zapisz, type WpisHistorii } from "@/platform/nawigacja/historia";
import { normalizeFavoritePath, suggestFavoriteLabel, type FavoriteViewDTO } from "@/platform/favorites/favoriteViews";
import { MODULES } from "@/lib/modules";

/**
 * 103: REJESTRATOR historii odwiedzonych stron — mieszka w powłoce, bo tylko ona widzi każdą
 * zmianę adresu w aplikacji.
 *
 * Podział pracy jest celowy i wynika z C-36: `platform/nawigacja/historia.ts` trzyma **czystą
 * logikę listy** i nie zna żadnego modułu, a nazwanie ścieżki („Zakupy", „Zadania — Zaległe") jest
 * wiedzą modułową, więc dzieje się TUTAJ, w korzeniu kompozycji, i wchodzi tam gotowym tekstem.
 *
 * Kolejność źródeł etykiety nie jest przypadkowa: **etykieta ulubionego wygrywa z nazwą modułu**,
 * bo jeśli użytkownik nazwał to miejsce po swojemu, to jest nazwa, po której je rozpozna.
 */
export function useHistoriaNawigacji(favorites: FavoriteViewDTO[]): WpisHistorii[] {
  const pathname = usePathname();
  const [historia, setHistoria] = useState<WpisHistorii[]>([]);
  const [biezaca, setBiezaca] = useState<string | null>(null);

  // Pierwszy odczyt osobno od zapisu: gdyby szedł w tym samym efekcie co dopisanie, po odświeżeniu
  // strony historia z pamięci sesji ginęłaby, nadpisana jednoelementową listą bieżącej strony.
  useEffect(() => { setHistoria(odczytaj()); }, []);

  useEffect(() => {
    const sciezka = normalizeFavoritePath(window.location.pathname + window.location.search);
    if (!sciezka) return;

    const modul = MODULES.find((m) => (m.exact ? sciezka === m.href : sciezka === m.href || sciezka.startsWith(`${m.href}/`) || sciezka.startsWith(`${m.href}?`)));
    const ulubiony = favorites.find((f) => f.path === sciezka);
    const etykieta = ulubiony?.label ?? suggestFavoriteLabel(sciezka, modul?.label);
    setBiezaca(sciezka);

    setHistoria((poprzednia) => dopisz(poprzednia, { sciezka, etykieta, czas: Date.now() }));
  }, [pathname, favorites]);

  /**
   * Zapis do pamięci sesji idzie OSOBNYM efektem, a nie wewnątrz `setHistoria(...)`.
   *
   * Funkcja aktualizująca stan musi być czysta: React wolno wywołać ją dwa razy dla jednej zmiany
   * (tak robi tryb ścisły w środowisku deweloperskim, żeby wykryć właśnie takie efekty uboczne).
   * Tutaj podwójny zapis byłby nieszkodliwy, bo zapisuje tę samą wartość — ale wzorzec „efekt
   * uboczny w updaterze" wraca później w miejscu, w którym już szkodzi, więc nie zostawiamy go
   * jako przykładu do naśladowania.
   */
  useEffect(() => {
    if (historia.length > 0) zapisz(historia);
  }, [historia]);

  /**
   * Bieżąca strona NIE jest pozycją historii — „wróć tu, gdzie jesteś" nie jest nawigacją. Odsiew
   * robimy przy odczycie, a nie przy zapisie, bo lista ma pamiętać także tę stronę: gdy z niej
   * wyjdziesz, natychmiast staje się „poprzednią".
   *
   * Bieżący adres trzymamy w STANIE, ustawianym w tym samym efekcie co dopisanie, a nie czytamy
   * z `window` podczas renderowania: powłoka renderuje się także na serwerze, gdzie `window` nie
   * istnieje, a wynik zależny od niego rozjeżdżałby się z tym, co przyszło z serwera.
   */
  return historia.filter((w) => w.sciezka !== biezaca);
}
