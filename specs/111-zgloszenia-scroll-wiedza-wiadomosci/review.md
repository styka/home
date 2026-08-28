# Recenzja: 111 — powrót do miejsca czytania, wiedza o użytkowniku, układ Wiadomości

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-28
- **Diff:** `origin/develop...HEAD` — 34 pliki, +3170 / −164, 17 commitów
- **Recenzent:** Claude Code (etap `/review`). Równolegle zlecono świeże spojrzenie subagentowi
  `omnia-reviewer`; **nie zwrócił ustaleń w rozsądnym czasie**, więc podstawą tego werdyktu jest
  recenzja przeprowadzona tutaj. Odnotowane wprost, żeby nie sugerować drugiej pary oczu, której
  nie było.

## Ustalenia

Trzy ustalenia — wszystkie **naprawione w trakcie recenzji** i potwierdzone testami. Żadne nie
wymagało zawracania do `/implement`, bo żadne nie wynikało z błędnego speca ani planu.

### 1. `platform/wiedza/harmonogram.ts` — automat pomijał konta bez ustawień asystenta
- **Kategoria:** correctness · **Waga:** wysoka (przewracała główny cel zgłoszenia 2)
- **Opis:** przemiatanie pytało o wiersze `AssistantPref`. Ten wiersz powstaje **dopiero wtedy, gdy
  ktoś coś w asystencie ustawi**, więc konto, które nigdy nie zajrzało w te ustawienia, **nigdy nie
  trafiało do wnioskowania**.
- **Scenariusz awarii:** nowe konto używa Zadań i Nawyków przez miesiąc → w „Wiedzy o Tobie" pusto,
  bo automat nigdy go nie wybrał. Objaw **identyczny z pierwotnym zgłoszeniem właściciela**, tyle że
  po naprawie — czyli najgorszy możliwy rodzaj usterki: taki, który wygląda jak brak naprawy.
- **Dlaczego to nie było widać:** właściciel ma ten wiersz od dawna (ustawiał poziom asystenta), więc
  ani klikacz, ani ręczny test na jego koncie by tego nie pokazały.
- **Poprawka:** zapytanie idzie po `User` z lewym złączeniem; **brak wiersza znaczy „automat
  włączony"**, zgodnie z domyślną wartością kolumny (`@default(true)`). Nowy przypadek testowy
  „konto bez wiersza ustawień asystenta JEST kandydatem".

### 2. `modules/news/jobs/newsRefresh.ts` — poziom normalizowany dwa razy, dwa różne sposoby
- **Kategoria:** correctness · **Waga:** średnia
- **Opis:** w jednym bloku `NewsItem.summaryLength` dostawał **surowy** ciąg z ustawień użytkownika,
  a `NewsItemSummary.length` — wartość przepuszczoną przez `poziomStreszczenia()`.
- **Scenariusz awarii:** `NewsPref.defaultSummaryLength` zawiera cokolwiek spoza trójki (ręczna
  edycja bazy, przyszła migracja, literówka w seedzie) → pozycja zapisuje się z poziomem `"x"`,
  a jej streszczenie w pamięci pod poziomem `"medium"`. Przełączenie na „średnie" **nie trafia
  w pamięć** i generuje od nowa — czyli dokładnie ta usterka, którą ta zmiana naprawia, wraca
  tylnymi drzwiami.
- **Poprawka:** normalizacja **raz**, jedna zmienna dla obu zapisów i dla instrukcji promptu.

### 3. `hooks/usePrzywroceniePrzewijania.ts` — sprzątanie mogło skasować właśnie zapisaną pozycję
- **Kategoria:** correctness · **Waga:** średnia (ryzyko utajone)
- **Opis:** sprzątanie efektu czytało `el.scrollTop` z elementu, który przy współbieżnym renderowaniu
  potrafi być już **odłączony od dokumentu**. Odłączony element zwraca `0`, a zapis zera **kasuje
  wpis** (próg w `przewijanie.ts`).
- **Scenariusz awarii:** przewinięcie → wyjście z widoku w momencie, gdy React zdąży odłączyć
  kontener przed sprzątaniem → wpis skasowany → powrót „wstecz" pokazuje górę strony. Objaw
  **niedeterministyczny**: raz działa, raz nie, i nie da się go odtworzyć na żądanie.
- **Poprawka:** ostatnia pozycja trzymana w zmiennej aktualizowanej przez nasłuch przewijania;
  sprzątanie zapisuje **liczbę**, nie odczyt z DOM-u. Przywrócenie też ją odświeża, żeby wyjście
  z widoku nie zapisało wartości sprzed przywrócenia. Świadome przewinięcie na samą górę dalej
  kasuje wpis (zmienna niesie wtedy `0`) — zachowanie bez zmian.

## Sprawdzone i CZYSTE (bez ustaleń)

| Obszar | Wniosek |
|--------|---------|
| Guardy dostępu (C-21) | `resummarizeItem` zachowuje `czyMojRekord(item.topic, …)` bez zmian; **niczyj dostęp się nie poszerzył** |
| `revalidatePath` (C-20) | obecny na każdej ścieżce wyjścia `resummarizeItem` (pamięć, generacja, brak materiału) i w `updateAssistantPrefs` |
| Migracja vs `schema.prisma` | `check:schema-drift` czysty; backfill **nie utrwala nieudanych streszczeń** (`WHERE summaryFailed = false AND length(btrim(summary)) > 0`) |
| Streszczenie ze streszczenia | niemożliwe: `item.summary` **nie występuje** już jako źródło materiału (`news.ts:753-755`) |
| Zapisane ulubione po zniesieniu `tresc` | `setViewState` **scala** patch (`useViewState.ts:66`), więc normalizacja adresu nie gubi `zrodla` ani `czytanie`; klikacz potwierdza przepisanie |
| Rozjazd `nadpisania` z danymi serwera | niemożliwy: akcja aktualizuje **też** `NewsItem.summary` (`news.ts:795-799`), więc kolejny odczyt z serwera zwraca ten sam tekst |
| Wielokrotne kolejkowanie konta | `dedupeKey: user.facts:<id>` + `enqueue` odsiewa `QUEUED`/`RUNNING` |
| Przywracanie tam, gdzie nie trzeba | flagi powrotu są **jednorazowe** (dwa testy jednostkowe); klikacz: wejście z odnośnika → `0` |
| Wyciek nasłuchu | nasłuch `popstate` rejestrowany **raz na dokument** (flaga modułowa); nasłuch przewijania zdejmowany w sprzątaniu |
| C-12 (bez enumów) | poziom to `String` + unia TS |
| C-30 (kolory) | zero nowych hexów — `check:ui-contract` |
| C-32 (teksty) | 5 nowych tekstów w `messages/pl.json`, `check:i18n` czysty |
| C-41 (klucze) | zmiana nie dotyka sekretów ani logów |
| C-01 / C-53 | praca w `worldofmag/`; zero nowych zależności; usunięty duplikat instrukcji długości i martwy `ContentSwitch` |
| Regresja w `ViewBar` (25 modułów) | wyjątek postawiony po stronie **ikony**, więc widok bez nowej klasy wygląda dokładnie jak przed zmianą |

## Bramki po poprawkach recenzji

`test:unit` **1318 / 0 porażek** · `next lint --dir src` **0 błędów** · `tsc` (aplikacja i testy)
czysty · `next build` **Compiled successfully** · `check:perf` w paśmie ±5 % · komplet `check:*`
zielony.

## Werdykt

**APPROVE Z UWAGAMI.**

Uwagi to trzy ustalenia powyżej — wszystkie naprawione i pokryte testami **przed** tym werdyktem.
Jedno z nich (automat pomijający konta bez ustawień) było poważne: przewracało główny cel
zgłoszenia 2 w sposób nie do zauważenia na koncie właściciela.

Ograniczenie procesu odnotowane uczciwie: świeże spojrzenie subagenta nie dojechało, więc feature
przeszedł **jedną** parę oczu zamiast dwóch. Rekompensują to: 1318 testów jednostkowych, klikacz
na realnej przeglądarce, komplet bramek i osobne pomiary w przeglądarce dla zachowań, których
testy jednostkowe nie widzą (obie ścieżki powrotu, szerokości w pasku akcji).
