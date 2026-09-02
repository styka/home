import { parseJsonLoose } from "@/platform/llm/json";

/**
 * 121 (zgł. 1) — ekstrakcja słówek z tekstu BEZ limitu ilościowego.
 *
 * Zgłoszenie właściciela: „jest ograniczenie przygotowania do 25 słówek z podanego tekstu,
 * a powinny być wszystkie". Limit siedział w trzech miejscach naraz: w wywołaniach UI
 * (`max: 25`), w prompcie („Maksymalnie N słówek") i w `slice(0, limit)` na wyniku. Po jego
 * zniesieniu jedyną realną barierą staje się budżet wyjścia modelu — dlatego tekst dzielimy
 * na fragmenty (każdy fragment to osobne, mniejsze wywołanie), a odpowiedź czytamy
 * tolerancyjnie z odzyskiem kompletnych pozycji z uciętej tablicy (lekcja 119/120: ucięta
 * odpowiedź nie może ani udawać poprawnej, ani zbijać całej operacji).
 *
 * Helpery są CZYSTE (bez sesji, bez Prismy) — plik trasy nie może eksportować nic poza
 * handlerami, więc testowalna logika mieszka tu.
 */

export interface SlowkoZTekstu {
  term: string;
  translation: string;
  example: string | null;
  partOfSpeech: string | null;
}

/**
 * Dzieli tekst na fragmenty o długości ≤ `maksFragment`, tnąc na naturalnych granicach
 * (akapit → koniec zdania → dowolny biały znak) — nigdy w środku słowa, chyba że pojedyncze
 * „słowo" samo przekracza limit (wtedy twarde cięcie, żeby pętla zawsze się kończyła).
 */
export function podzielNaFragmenty(tekst: string, maksFragment: number): string[] {
  const calosc = tekst.trim();
  if (!calosc) return [];
  if (calosc.length <= maksFragment) return [calosc];

  const fragmenty: string[] = [];
  let reszta = calosc;
  while (reszta.length > maksFragment) {
    const okno = reszta.slice(0, maksFragment);
    // Od najlepszej granicy do najgorszej; granica ma sens tylko, gdy nie zostawia pustki.
    const granice = [
      okno.lastIndexOf("\n\n"),
      Math.max(okno.lastIndexOf(". "), okno.lastIndexOf("! "), okno.lastIndexOf("? ")),
      okno.lastIndexOf("\n"),
      okno.lastIndexOf(" "),
    ];
    // Fallback to twarde cięcie: `slice(0, ciecie + 1)` bierze o jeden znak więcej niż indeks,
    // więc granicą jest `maksFragment - 1` — inaczej fragment miałby maksFragment + 1 znaków.
    const ciecie = granice.find((i) => i > 0) ?? maksFragment - 1;
    const fragment = reszta.slice(0, ciecie + 1).trim();
    if (fragment) fragmenty.push(fragment);
    reszta = reszta.slice(ciecie + 1).trim();
  }
  if (reszta) fragmenty.push(reszta);
  return fragmenty;
}

function normalizuj(w: {
  term?: unknown;
  translation?: unknown;
  example?: unknown;
  partOfSpeech?: unknown;
}): SlowkoZTekstu | null {
  const term = typeof w.term === "string" ? w.term.trim() : "";
  const translation = typeof w.translation === "string" ? w.translation.trim() : "";
  if (!term || !translation) return null;
  return {
    term,
    translation,
    example: typeof w.example === "string" && w.example.trim() ? w.example.trim() : null,
    partOfSpeech:
      typeof w.partOfSpeech === "string" && w.partOfSpeech.trim() ? w.partOfSpeech.trim() : null,
  };
}

/**
 * Wyciąga z surowego tekstu odpowiedzi WSZYSTKIE kompletne obiekty `{ … }` (świadome
 * cudzysłowów i escapów, więc klamra w treści przykładu nie psuje zliczania). To ścieżka
 * ratunkowa dla odpowiedzi uciętej budżetem: ostatni, niedomknięty obiekt przepada, ale
 * kompletne pozycje przed nim wracają do użytkownika.
 */
function wyluskajObiekty(raw: string): SlowkoZTekstu[] {
  const wynik: SlowkoZTekstu[] = [];
  // Stos indeksów otwartych `{` — słówka siedzą WEWNĄTRZ niedomkniętego obiektu zewnętrznego
  // (`{"words":[…` ucięte w pół), więc kompletne obiekty trzeba łapać na każdej głębokości,
  // nie tylko na najwyższej. Domknięty obiekt zewnętrzny nie dubluje wyniku: `normalizuj`
  // odrzuci go, bo nie ma pól `term`/`translation`.
  const otwarcia: number[] = [];
  let wNapisie = false;
  let poprzedniEscape = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (wNapisie) {
      if (poprzedniEscape) poprzedniEscape = false;
      else if (ch === "\\") poprzedniEscape = true;
      else if (ch === '"') wNapisie = false;
      continue;
    }
    if (ch === '"') { wNapisie = true; continue; }
    if (ch === "{") {
      otwarcia.push(i);
    } else if (ch === "}") {
      const start = otwarcia.pop();
      if (start !== undefined) {
        try {
          const obiekt = JSON.parse(raw.slice(start, i + 1)) as Record<string, unknown>;
          const slowko = normalizuj(obiekt);
          if (slowko) wynik.push(slowko);
        } catch {
          // niepoprawny wycinek — pomijamy, szukamy dalej
        }
      }
    }
  }
  return wynik;
}

/**
 * Czyta odpowiedź modelu na listę słówek: najpierw tolerancyjnie całość (płotki markdown,
 * tekst wokół JSON-a — `parseJsonLoose`), a gdy się nie da (np. tablica ucięta budżetem
 * wyjścia) — odzysk kompletnych obiektów. Zwraca pustą listę, gdy nie ma czego odzyskać.
 */
export function odzyskajSlowka(raw: string): SlowkoZTekstu[] {
  if (!raw || !raw.trim()) return [];
  const parsed = parseJsonLoose<{ words?: unknown } | unknown[]>(raw);
  const lista = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.words) ? parsed.words : null;
  if (lista) {
    return lista
      .map((w) => (w && typeof w === "object" ? normalizuj(w as Record<string, unknown>) : null))
      .filter((w): w is SlowkoZTekstu => w !== null);
  }
  return wyluskajObiekty(raw);
}

/** Scala listy słówek z kolejnych fragmentów: bez duplikatów (po `term`, bez wielkości liter),
 *  w kolejności pierwszego wystąpienia. Niczego nie ucina — to jest cały sens 121. */
export function scalSlowka(listy: SlowkoZTekstu[][]): SlowkoZTekstu[] {
  const widziane = new Set<string>();
  const wynik: SlowkoZTekstu[] = [];
  for (const lista of listy) {
    for (const slowko of lista) {
      const klucz = slowko.term.toLowerCase();
      if (widziane.has(klucz)) continue;
      widziane.add(klucz);
      wynik.push(slowko);
    }
  }
  return wynik;
}
