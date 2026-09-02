// 028 (optymalizacja kosztów asystenta): higiena kontekstu pętli agenta.
//
// Wyniki narzędzi (step "query") to największy ZMIENNY koszt tokenów: są wstrzykiwane
// do tablicy `messages` i re-wysyłane w KAŻDEJ kolejnej iteracji pętli. Tniemy to
// dwiema czystymi (testowalnymi) dźwigniami, wydzielonymi tu z `route.ts`:
//   1. `compactToolResults` — twardy limit rekordów/znaków POJEDYNCZEGO bloku wyników,
//      z czytelnym znacznikiem ucięcia (model wie, że dane są niepełne — może zawęzić),
//   2. `collapseUsedToolData` — zwijanie ZUŻYTYCH bloków do stuba (pełny zostaje tylko
//      ostatni, którego model właśnie potrzebuje) → koniec kwadratowego narostu tokenów.
// Oba są provider-agnostyczne i nie ruszają delimitera „NIEUFNE DANE" (dokłada go wołający).

/**
 * 112: czy przy TYM wywołaniu modelu oznaczyć drugim punktem cięcia pamięci podręcznej także blok
 * ZMIENNY promptu (katalog narzędzi i akcji, ~12–18 tys. tokenów).
 *
 * Prompt systemowy jest budowany RAZ przed pętlą i przekazywany do każdego wywołania identyczny co
 * do znaku — mimo to do 112 opłacano go w pełnej cenie za każdym razem (zgłoszona sesja: sześć
 * iteracji, ~67% rachunku tury).
 *
 * Reguła ma dwa brzegi i oba są celowe:
 *  - **pierwsze wywołanie: NIE.** Zapis do pamięci kosztuje 1,25× ceny wejścia, więc oznaczanie
 *    katalogu w turze, która skończy się na jednym wywołaniu, PODNIOSŁOBY koszt — czyli dokładnie
 *    przypadku z drugiego zgłoszenia („czemu ta prosta operacja kosztowała 30 groszy").
 *  - **wywołanie domykające przebieg: NIE.** Po nim nic już nie nastąpi, więc zapłacilibyśmy 1,25×
 *    za pamięć, której nikt nie odczyta. W zgłoszonej sesji tak wyrzucono 11 860 tokenów.
 *
 * Rachunek za katalog, w jednostkach ceny wejścia (zmierzony katalog: 10 584 tokeny):
 *
 * | wywołań w przebiegu | przed | po   |        |
 * |---------------------|-------|------|--------|
 * | 1                   | 1,00  | 1,00 |  bez zmian |
 * | 2                   | 2,00  | 2,25 | **+12 %** |
 * | 3                   | 3,00  | 2,35 |  −22 % |
 * | 6                   | 6,00  | 2,65 |  −56 % |
 *
 * **Świadomy koszt: przebieg dwuwywołaniowy (`query` → `answer`) płaci 12 % więcej za katalog** —
 * zapis kosztuje 1,25×, a odczytać go zdąży tylko raz. Przyjmujemy to, bo (a) przebiegi 3+ są tymi
 * drogimi i tam oszczędność sięga połowy, (b) pamięć dostawcy żyje ~5 minut i jest wspólna dla
 * kolejnych TUR tej samej rozmowy, więc zapis z drugiego wywołania odczytuje pierwsze wywołanie
 * następnej tury — w rozmowie dłuższej niż jedna tura nadpłata wraca.
 *

 * @param numerWywolania numer wywołania modelu w przebiegu, licząc od 1
 * @param czyDomykajace czy to ostatnie wywołanie przebiegu (podsumowanie/dokończenie)
 */
/**
 * 120: BUDŻET TOKENÓW WYJŚCIA — dobierany do etapu tury, nie do treści wiadomości użytkownika.
 *
 * Do 120 budżet był liczony RAZ, przed pętlą: wklejona długa lista → 4000, prośba o raport → 2800,
 * wszystko inne → 1200. „Duży plan" nie jest żadną z tych kategorii i **z zasady nie da się go
 * rozpoznać po wiadomości** — o rozmiarze odpowiedzi decyduje ilość danych, które asystent
 * PRZECZYTAŁ, a nie długość prośby. Zgłoszona sesja: prośba na trzy zdania, plan na kilkanaście
 * akcji, pięć odpowiedzi uciętych na 1200 tokenach i wyrzuconych.
 *
 * Bierzemy MAKSIMUM z mających zastosowanie progów — próg to dolna granica potrzeby, a nie wybór
 * spośród wykluczających się wariantów: raport zbudowany z odczytanych danych potrzebuje i jednego,
 * i drugiego zapasu.
 */
export const BAZOWY_BUDZET_WYJSCIA = 1200;
export const DUZY_BUDZET_WYJSCIA = 4000;
export const RAPORT_BUDZET_WYJSCIA = 2800;

export function budzetWyjscia(opcje: {
  /** Czy do kontekstu trafiły już wyniki odczytu — czyli czy jest z czego budować dużą odpowiedź. */
  maDaneWKontekscie: boolean;
  /** 080: wiadomość rozpoznana jako zlecenie wsadowe (wklejona długa lista pozycji). */
  wsadowe?: boolean;
  /** Użytkownik prosi o raport (krok „report"). */
  raport?: boolean;
}): number {
  const progi = [BAZOWY_BUDZET_WYJSCIA];
  if (opcje.maDaneWKontekscie) progi.push(DUZY_BUDZET_WYJSCIA);
  if (opcje.wsadowe) progi.push(DUZY_BUDZET_WYJSCIA);
  if (opcje.raport) progi.push(RAPORT_BUDZET_WYJSCIA);
  return Math.max(...progi);
}

/**
 * 120: kroki protokołu, które pętla agenta potrafi wykonać. Odpowiedź niosąca którykolwiek z nich
 * jest UŻYTECZNA — reszta (obiekt bez `step`, `step` spoza listy) jest jałowym obrotem.
 *
 * Lista stoi tutaj, a nie w trasie, bo używają jej dwie decyzje naraz: „czy wolno uznać, że ucięcia
 * nie było" i „czy ten obrót pętli cokolwiek wniósł". Dwie kopie rozjechałyby się przy pierwszym
 * nowym kroku protokołu, a objawem byłaby pętla kręcąca się na kroku, którego nie umie wykonać.
 */
export const KROKI_PROTOKOLU = ["query", "clarify", "answer", "navigate", "plan", "report"] as const;

/** Czy sparsowana odpowiedź modelu niesie krok, który pętla potrafi wykonać. */
export function czyUzytecznyKrok(parsed: Record<string, unknown> | null): boolean {
  const step = parsed?.step;
  return typeof step === "string" && (KROKI_PROTOKOLU as readonly string[]).includes(step);
}

/**
 * 120: ile odpowiedzi BEZ użytecznego kroku wolno jeszcze przyjąć, zanim zamkniemy przebieg.
 *
 * Dziś odpowiedź bez znanego kroku kosztuje dopisanie „Nieznany step…" i **kolejny obrót pętli** —
 * bez żadnego licznika. W zgłoszonej sesji spaliło to pięć iteracji po 1200 tokenów wyjścia, każda
 * wyrzucona. To jest ten sam rodzaj jałowego obrotu, przed którym 032 chroni po stronie ODCZYTÓW
 * (`unproductiveIterations`); tutaj chodzi o jałowe ODPOWIEDZI.
 *
 * Próg jest taki sam jak dla ucięcia (`truncationRetries`): jedna szansa na poprawę, po drugiej
 * nieudanej wychodzimy z tym, co mamy.
 */
export const MAX_ODPOWIEDZI_BEZ_KROKU = 2;

/** Czy po tylu odpowiedziach bez użytecznego kroku należy zakończyć przebieg. */
export function czyPrzerwacBezKroku(licznik: number): boolean {
  return licznik >= MAX_ODPOWIEDZI_BEZ_KROKU;
}

export function czyCachowacKatalog(numerWywolania: number, czyDomykajace = false): boolean {
  if (czyDomykajace) return false;
  return numerWywolania >= 2;
}

/**
 * Maks. rekordów na jedno narzędzie wstrzykiwanych do kontekstu.
 *
 * 112: podniesione 12 → 40. Dwanaście rekordów oznaczało, że polecenie „przeczytaj WSZYSTKIE zadania
 * z projektu i zbuduj z nich profil" było fizycznie niewykonalne w jednym odczycie — a komunikat
 * obcięcia kazał przy tym „zawęzić zapytanie", więc model tnął projekt po statusie, tagu i
 * priorytecie. Zgłoszona sesja: jedenaście odczytów w sześciu iteracjach, zero wyniku. Limit siedział
 * w KONTEKŚCIE, nie w zapytaniu, więc podnoszenie `limit` w argumentach niczego nie odblokowywało.
 *
 * Podwyżkę finansuje naprawa pamięci podręcznej promptu z tego samego przebiegu (`czyCachowacKatalog`).
 */
export const PER_TOOL_MAX_RECORDS = 40;
/** Twardy budżet znaków na CAŁY blok wyników (bezpiecznik). 112: 3500 → 12 000, patrz wyżej. */
export const TOOL_RESULT_MAX_CHARS = 12_000;
// Stały prefiks bloku wyników — służy też do ROZPOZNANIA bloków do zwinięcia.
export const TOOL_DATA_HEADER = "Wyniki narzędzi";
export const TOOL_DATA_STUB = "[wyniki narzędzi z wcześniejszego kroku — już wykorzystane]";

export type ToolResult = {
  tool: string;
  args: Record<string, unknown>;
  data: unknown;
  error?: string;
  /** 030: znacznik powtórzonego wywołania (wynik z pamięci tury, nie z narzędzia). */
  repeat?: string;
};

// 030: próg skracania pojedynczego pola tekstowego w wynikach narzędzi. Długie opisy
// (np. zgłoszenia błędów ze zrzutami rozmów w opisie zadania) rozsadzały blok wyników,
// przez co bezpiecznik znakowy ucinał JSON W POŁOWIE — model nie rozumiał wyniku i
// ponawiał to samo zapytanie aż do limitu kroków. Skracamy per-pole (JSON zostaje
// poprawny), z jawnym markerem jak sięgnąć po całość.
export const FIELD_MAX_CHARS = 700;
const FIELD_TRIM_MARKER = (total: number) =>
  ` …[SKRÓCONO z ${total} znaków — pełna treść: get_task/get_note po id]`;

/**
 * Rekurencyjnie skraca wszystkie długie stringi w strukturze wyniku narzędzia do
 * `maxLen` znaków, doklejając czytelny marker skrócenia. Zwraca nową strukturę
 * (nie mutuje wejścia). JSON po serializacji pozostaje poprawny.
 */
export function trimLongStrings(value: unknown, maxLen: number = FIELD_MAX_CHARS): unknown {
  if (typeof value === "string") {
    return value.length > maxLen ? value.slice(0, maxLen) + FIELD_TRIM_MARKER(value.length) : value;
  }
  if (Array.isArray(value)) return value.map((v) => trimLongStrings(v, maxLen));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = trimLongStrings(v, maxLen);
    }
    return out;
  }
  return value;
}

/**
 * Kompaktuje wyniki narzędzi PRZED wstrzyknięciem do kontekstu. Dla każdego narzędzia
 * ogranicza listę rekordów do `PER_TOOL_MAX_RECORDS` z czytelnym znacznikiem ucięcia,
 * skraca długie pola tekstowe per-pole (`trimLongStrings` — JSON zostaje poprawny),
 * a na końcu stosuje twardy bezpiecznik znakowy na cały blok. Zwraca serializowany JSON
 * (string) gotowy do wstawienia między delimitery `<<<DANE … DANE>>>`.
 */
export function compactToolResults(results: ToolResult[]): string {
  const trimmed = results.map((r) => {
    const data = trimLongStrings(r.data);
    if (Array.isArray(data) && data.length > PER_TOOL_MAX_RECORDS) {
      return zRekordami(r, data, PER_TOOL_MAX_RECORDS, data.length);
    }
    return { ...r, data };
  });
  const json = JSON.stringify(trimmed);
  if (json.length <= TOOL_RESULT_MAX_CHARS) return json;

  // 112: bezpiecznik znakowy USUWA CAŁE REKORDY, zamiast ciąć wynikowy string.
  //
  // Poprzednia wersja robiła `json.slice(...)`, czyli oddawała modelowi JSON urwany w połowie
  // rekordu. `doświadczenia.md` odnotowuje już raz, do czego to prowadzi: model nie rozumie wyniku i
  // PONAWIA to samo zapytanie aż do wyczerpania limitu kroków — czyli dokładnie ten objaw, który
  // zgłoszenie opisuje jako „kolejne próby nie wnosiły nic nowego". Wynik musi zawsze pozostać
  // poprawną, zamkniętą strukturą, choćby zawierał mniej rekordów.
  return ograniczDoBudzetu(results);
}

/** Jeden wynik narzędzia obcięty do `ile` rekordów, ze znacznikiem mówiącym JAK dobrać resztę. */
function zRekordami(r: ToolResult, data: unknown[], ile: number, lacznie: number) {
  const shown = data.slice(0, ile);
  const juzPokazano = (typeof r.args?.offset === "number" ? r.args.offset : 0) + shown.length;
  return {
    tool: r.tool,
    args: r.args,
    data: shown,
    // 112: komunikat wskazuje KONKRETNY następny krok. Poprzednie „zawęź zapytanie
    // (search/status/limit)" było poleceniem niewykonalnym — limit siedzi w kontekście, nie w
    // zapytaniu — a model wykonał je dosłownie i pociął projekt na sześć zapytań po kolejnych
    // wymiarach. Ogólnik w tym miejscu produkuje spiralę; konkret ją kończy.
    truncated:
      `pokazano ${shown.length} z ${lacznie} rekordów. Aby pobrać KOLEJNE, powtórz to samo ` +
      `wywołanie z argumentem offset: ${juzPokazano} (nie zawężaj filtrów — reszta danych istnieje).`,
    ...(r.error ? { error: r.error } : {}),
    ...(r.repeat ? { repeat: r.repeat } : {}),
  };
}

/**
 * Składa blok wyników mieszczący się w budżecie znaków, zmniejszając liczbę rekordów per narzędzie —
 * nigdy nie tnąc serializacji. Schodzi aż do zera rekordów; wtedy zostaje sam znacznik, z którego
 * model dowiaduje się, że dane istnieją i jak po nie sięgnąć mniejszymi porcjami.
 */
function ograniczDoBudzetu(results: ToolResult[]): string {
  let ile = PER_TOOL_MAX_RECORDS;
  let ostatni = "";
  while (ile >= 0) {
    const zmniejszone = results.map((r) => {
      const data = trimLongStrings(r.data);
      // Znacznik dokładamy WYŁĄCZNIE wtedy, gdy naprawdę coś obcinamy. Bez tego warunku wynik
      // kompletny (np. 5 rekordów z drugiego narzędzia w tej samej iteracji) dostawał komunikat
      // „pokazano 5 z 5 — pobierz kolejne przez offset: 5", czyli fałszywy alarm wysyłający model
      // po dane, których nie ma. To dokładnie ten rodzaj pętli, który ten przebieg usuwa.
      if (Array.isArray(data) && data.length > ile) return zRekordami(r, data, ile, data.length);
      return { ...r, data };
    });
    ostatni = JSON.stringify(zmniejszone);
    if (ostatni.length <= TOOL_RESULT_MAX_CHARS) return ostatni;
    ile = ile > 10 ? Math.floor(ile / 2) : ile - 1;
  }
  // Nawet bez rekordów blok nie mieści się w budżecie (same błędy/argumenty są za długie).
  // Oddajemy poprawny JSON z samymi nazwami narzędzi — nigdy urwany string.
  return JSON.stringify(results.map((r) => ({ tool: r.tool, data: [], truncated: "wynik za duży — zawęź zakres" })));
}

/**
 * Zwija ZUŻYTE bloki wyników narzędzi do krótkiego stuba, zostawiając pełny tylko
 * OSTATNI blok. Mutuje przekazaną tablicę wiadomości w miejscu. Blok rozpoznajemy po
 * stałym prefiksie treści (`TOOL_DATA_HEADER`); stub zaczyna się inaczej, więc nie jest
 * ponownie dopasowywany. Bez utraty jakości: starszy surowy listing jest już przetworzony
 * (model wyciągnął z niego id do kolejnego zapytania), a odpowiedź bazuje na najświeższych danych.
 */
export function collapseUsedToolData(messages: { role: string; content: string }[]): void {
  const idxs: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "user" && typeof m.content === "string" && m.content.startsWith(TOOL_DATA_HEADER)) {
      idxs.push(i);
    }
  }
  for (let k = 0; k < idxs.length - 1; k++) {
    messages[idxs[k]].content = TOOL_DATA_STUB;
  }
}
