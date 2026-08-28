/**
 * 111: JEDNA definicja poziomów streszczenia dla OBU ścieżek streszczania.
 *
 * Zgłoszenie właściciela: „mam w ustawieniach, by streszczało mi na poziomie średnim, ale jak
 * streszczę na krótki, a potem znowu na średni, to jest streszczenie około dwa razy dłuższe".
 *
 * Streszczenia powstają w dwóch miejscach i do 111 **każde z nich miało własną kopię** instrukcji
 * długości — dosłownie tę samą funkcję w dwóch plikach (`jobs/newsRefresh.ts` i `actions/news.ts`).
 * Dwie kopie jednej reguły to zawsze pytanie „która obowiązuje", ale sam duplikat nie był jeszcze
 * usterką: teksty były identyczne.
 *
 * Usterką była druga różnica, niewidoczna w instrukcji: **te dwie ścieżki widzą inną ilość
 * materiału**. Przebieg odświeżania streszcza wsadowo, ze skrótu z kanału RSS (kilkaset znaków na
 * pozycję, po kilkanaście pozycji w jednym wywołaniu), a ponowne streszczenie dociąga PEŁNY artykuł
 * (kilka tysięcy znaków) dla jednej pozycji. Ten sam „poziom średni" przy kilkakrotnie większym
 * materiale daje kilkakrotnie dłuższy tekst — model dostawał limit jako miękką sugestię, a nie jako
 * granicę.
 *
 * Dlatego w jednym miejscu mieszka **wszystko troje**: instrukcja, twardy pułap słów (żeby dało się
 * sprawdzić, czy wynik go przekroczył) i **wspólny limit materiału wejściowego** — bo bez tego
 * ostatniego sam rozmiar wsadu dalej różnicowałby wynik, choćby instrukcja była jedna.
 */

export type PoziomStreszczenia = "short" | "medium" | "long";

/**
 * Ile znaków materiału wchodzi do promptu — TAK SAMO w obu ścieżkach.
 *
 * Nie jest to optymalizacja kosztu, tylko warunek powtarzalności: gdy jedna ścieżka widzi 600
 * znaków, a druga 4000, „ten sam poziom" znaczy w nich co innego.
 */
export const LIMIT_MATERIALU = 4000;

/**
 * Limit materiału na pozycję w przebiegu WSADOWYM — mniejszy, bo w jednym wywołaniu jedzie
 * kilkanaście pozycji.
 *
 * 111 (recenzja): `LIMIT_MATERIALU` jest policzony dla JEDNEJ pozycji. Zastosowany w partii
 * dziesięciu (`SUMMARY_BATCH`) dałby do 40 kB promptu — po dociągnięciu pełnych artykułów realnie
 * przekraczałby okno kontekstu modelu, a wtedy pada CAŁA partia, ponawia się trzykrotnie (płacąc
 * za każdym razem) i wszystkie jej pozycje lądują jako „bez streszczenia".
 */
export const LIMIT_MATERIALU_WSAD = 1200;

/** Twardy pułap słów dla każdego poziomu — ta sama liczba, która stoi w instrukcji dla modelu. */
const PULAP_SLOW: Record<PoziomStreszczenia, number> = {
  short: 25,
  medium: 60,
  long: 130,
};

/**
 * Ile razy wolno przekroczyć pułap, zanim uznamy wynik za wymagający korekty.
 *
 * Nie 1.0, bo model liczy słowa inaczej niż my i odrzucanie tekstu o dwa słowa za długiego
 * kosztowałoby wywołanie za nic. Nie 2.0, bo dokładnie o dwukrotność chodziło w zgłoszeniu.
 */
const TOLERANCJA = 1.5;

export function poziomStreszczenia(wartosc: string | null | undefined): PoziomStreszczenia {
  return wartosc === "short" || wartosc === "long" ? wartosc : "medium";
}

export function maksSlow(poziom: PoziomStreszczenia): number {
  return PULAP_SLOW[poziom];
}

export function instrukcjaDlugosci(poziom: PoziomStreszczenia): string {
  switch (poziom) {
    case "short":
      return `Streszczenie KRÓTKIE: jedno zdanie, maks. ${PULAP_SLOW.short} słów, sama esencja. ` +
        "Limit słów jest GRANICĄ, nie sugestią — nie przekraczaj go, nawet jeśli materiał jest długi.";
    case "long":
      return `Streszczenie SZCZEGÓŁOWE: 4–6 zdań, kontekst, liczby, konsekwencje, maks. ${PULAP_SLOW.long} słów. ` +
        "Limit słów jest GRANICĄ, nie sugestią — nie przekraczaj go, nawet jeśli materiał jest długi.";
    default:
      return `Streszczenie ŚREDNIE: 2–3 zdania, najważniejsze fakty, maks. ${PULAP_SLOW.medium} słów. ` +
        "Limit słów jest GRANICĄ, nie sugestią — nie przekraczaj go, nawet jeśli materiał jest długi.";
  }
}

/** Liczba słów w tekście — jedno miejsce, żeby pułap i kontrola liczyły tak samo. */
export function liczSlowa(tekst: string): number {
  const t = tekst.trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * Czy wynik przekroczył pułap na tyle, że wart jest jednej korekty.
 *
 * Świadomie NIE skracamy tekstu sami: ucięcie streszczenia w połowie zdania jest gorsze niż
 * streszczenie o dwadzieścia słów za długie. Prosimy model o skrót — raz.
 */
export function czyZaDlugie(tekst: string, poziom: PoziomStreszczenia): boolean {
  return liczSlowa(tekst) > maksSlow(poziom) * TOLERANCJA;
}

/** Prośba o korektę, gdy pierwszy wynik przekroczył pułap. */
export function instrukcjaKorekty(poziom: PoziomStreszczenia): string {
  return `To streszczenie jest za długie. Skróć je do maks. ${maksSlow(poziom)} słów, ` +
    "zachowując najważniejsze fakty. Zwróć WYŁĄCZNIE JSON w tym samym kształcie.";
}

/**
 * Czy materiał w ogóle nadaje się do streszczenia.
 *
 * Drugie zgłoszenie właściciela: „czasem generujesz coś w stylu, że brak informacji, a jak się
 * zmieni poziom, to jednak znajdujesz treść". Przyczyna jest ta sama, co wyżej: przebieg widzi
 * wyłącznie skrót z kanału, a ten bywa pusty albo jednozdaniowy — model nie miał z czego streszczać
 * i pisał o tym wprost. Ponowienie widziało pełny artykuł, więc „nagle" treść się znajdowała.
 *
 * Ten próg jest sygnałem „sięgnij po pełny artykuł, zanim zapytasz model", a nie oceną jakości.
 */
export const MIN_MATERIALU = 200;

export function materialUbogi(tekst: string | null | undefined): boolean {
  return (tekst ?? "").trim().length < MIN_MATERIALU;
}
