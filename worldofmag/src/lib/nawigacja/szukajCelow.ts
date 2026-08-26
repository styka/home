import type { CelGlebiej } from "@/lib/nawigacja/celeModulu";

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
 * 104: dopasowanie frazy **bez znaków diakrytycznych i bez wielkości liter**.
 *
 * To nie jest udogodnienie, tylko warunek działania wyszukiwarki na telefonie. Połowa nazw w Omnii
 * ma ogonki („Zaległe", „Spiżarnia", „Przepływ"), a na klawiaturze telefonu pisze się je dłuższym
 * przytrzymaniem klawisza — więc użytkownik szukający szybko wpisze „zalegle". Porównanie
 * dosłowne dałoby wtedy zero wyników przy nazwie, która jest na ekranie.
 *
 * `normalize("NFD")` rozkłada literę na znak bazowy + znak łączący, a zakres `\u0300-\u036f`
 * (blok „Combining Diacritical Marks") te drugie usuwa. Świadomie zakresem, a nie własnością
 * `\p{M}`: ta ostatnia wymaga flagi `u`, której główny `tsconfig` nie dopuszcza przy swoim
 * docelowym standardzie — a zakres pokrywa wszystkie ogonki, jakie mogą wyjść z rozkładu NFD.
 * Polskie „ł" nie ma rozkładu kanonicznego (nie jest „l" z ogonkiem), więc podmieniamy je wprost —
 * bez tego „przeplyw" nie znalazłoby „Przepływ", czyli akurat ten przypadek, dla którego całość
 * powstała.
 */
export function bezOgonkow(tekst: string): string {
  return tekst
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase();
}

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
