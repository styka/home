import type { CelGlebiej } from "@/lib/nawigacja/celeModulu";
import { bezOgonkow } from "@/lib/ui/szukanie";

/** Moduł z jego celami — kształt, na którym pracuje panel szybkiej nawigacji. */
export interface GalazNawigacji {
  id: string;
  etykieta: string;
  href: string;
  kolor: string;
  cele: CelGlebiej[];
}

/** Pojedynczy wynik wyszukiwania — niesie przynależność, żeby dało się pokazać „Moduł — Cel". */
export interface WynikSzukania {
  id: string;
  etykieta: string;
  href: string;
  /** Nazwa modułu, do którego należy trafienie; `null`, gdy trafieniem jest sam moduł. */
  modul: string | null;
  kolor: string;
}

/**
 * 110: `bezOgonkow` mieszka teraz w `src/lib/ui/szukanie.ts`.
 *
 * Ta sama funkcja istniała w dwóch miejscach naraz — tutaj (dla wyszukiwarki celów nawigacji)
 * i w rejestrze ustawień z 109. Panel administratora byłby trzecim. Re-eksport zostaje, bo
 * importują ją stąd konsumenci nawigacji i jej testy.
 *
 * Powód, dla którego całość powstała, zostaje aktualny: nazwa celu ma ogonki („Zaległe",
 * „Spiżarnia", „Przepływ"), a na klawiaturze telefonu pisze się je dłuższym przytrzymaniem
 * klawisza — więc użytkownik szukający szybko wpisze „zalegle", a porównanie dosłowne dałoby zero
 * wyników przy nazwie, która jest na ekranie.
 */
export { bezOgonkow };

/**
 * Filtruje drzewo nawigacji jedną frazą — **moduły i ich cele naraz**.
 *
 * Pusta fraza zwraca `null`, co dla panelu znaczy „pokaż normalne drzewo". Zwrócenie wtedy
 * spłaszczonej listy wszystkiego byłoby wygodne w kodzie i złe w użyciu: panel bez frazy ma
 * pokazywać moduły do przeglądania, a nie pięćdziesiąt pozycji do przewijania.
 *
 * Trafienie w NAZWĘ MODUŁU wciąga jego cele — kto wpisał „zakupy", chce zobaczyć, co w Zakupach
 * może zrobić, a nie sam wiersz „Zakupy".
 */
export function szukajCelow(galezie: GalazNawigacji[], fraza: string): WynikSzukania[] | null {
  const szukana = bezOgonkow(fraza.trim());
  if (!szukana) return null;

  const wyniki: WynikSzukania[] = [];
  for (const g of galezie) {
    const modulPasuje = bezOgonkow(g.etykieta).includes(szukana);
    if (modulPasuje) {
      wyniki.push({ id: g.id, etykieta: g.etykieta, href: g.href, modul: null, kolor: g.kolor });
    }
    for (const cel of g.cele) {
      if (!modulPasuje && !bezOgonkow(cel.etykieta).includes(szukana)) continue;
      wyniki.push({ id: cel.id, etykieta: cel.etykieta, href: cel.href, modul: g.etykieta, kolor: g.kolor });
    }
  }
  return wyniki;
}
