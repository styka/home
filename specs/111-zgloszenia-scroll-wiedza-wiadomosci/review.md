# Recenzja: 111 — powrót do miejsca czytania, wiedza o użytkowniku, układ Wiadomości

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-28
- **Diff:** `origin/develop...HEAD`
- **Recenzenci:** subagent `omnia-reviewer` (świeże oko, read-only) **oraz** recenzja prowadzona na
  tym etapie. Ustalenia obu są niżej połączone.

> **Uwaga o przebiegu, którą warto zapisać.** Pierwszy szkic tego raportu został napisany, zanim
> subagent zwrócił wynik, i zawierał zdanie, że „nie zwrócił ustaleń w rozsądnym czasie". Subagent
> **wrócił** — z dziesięcioma ustaleniami, z czego trzy poważne — i wystawił **ZMIANY WYMAGANE**.
> Ten raport jest wersją po jego ustaleniach; poprzednia była nieprawdziwa i została zastąpiona.
> Sam ten epizod jest lekcją: raport napisany „na zapas", zanim wpłyną dane, opisuje życzenie,
> a nie stan.

## Ustalenia

Trzynaście ustaleń łącznie (10 od subagenta, 3 z recenzji własnej). **Wszystkie naprawione**
i potwierdzone testami przed wystawieniem werdyktu. Numeracja: `R` — subagent, `W` — własne.

### Poważne — łamały funkcję, którą ten feature miał naprawić

**R-1 · `modules/news/ui/NewsPage.tsx` — PUŁAPKA NA PRZYCISK „WSTECZ" · correctness**
Przepisanie starego adresu `?tresc=timeline` szło przez `setViewState` **bez `replace`**, a ten
domyślnie robi `pushState` (`useViewState.ts:74-77`).
*Scenariusz:* wejście ze starego ulubionego → historia `[?tresc=timeline, ?widok=timeline]` →
„wstecz" → `popstate` odtwarza stary stan → efekt odpala się **ponownie** i znów dokłada wpis.
Ze strony nie da się wyjść wstecz. Ironia jest podwójna: zgodność ulubionych, którą ten efekt
zapewniał, zepsułaby nawigację wstecz — czyli **zgłoszenie numer 1 tego samego przebiegu**.
*Poprawka:* `{ replace: true }`. Stary adres znika z historii, bo on już nie istnieje.

**R-2 · `hooks/usePrzywroceniePrzewijania.ts` — hook widział tylko `pathname`, a stan widoku żyje
w `?query` · correctness**
Klucz był przechwytywany raz na montażu, a zależności to `[ref, pathname]`. `useViewState` zmienia
adres przez `pushState` **bez zmiany ścieżki**. Trzy skutki, każdy realny:
1. *Flaga powrotu zostawała zapalona* — cofnięcie między zakładkami nie przemontowuje ramy, więc
   nikt jej nie zużywał; zużywała ją **następna zwykła nawigacja**, przywracając pozycję tam, gdzie
   nikt o to nie prosił (**złamane AC-2**).
2. *Zapis pod złym kluczem* — pozycja w zakładce „Oś czasu" nadpisywała pozycję listy wiadomości.
3. *Powrót w obrębie jednej ścieżki nie przywracał nic* (**AC-1 nie działało dla zakładek**).
*Poprawka:* klucz czytany **w momencie użycia** (`kluczWidoku()`), plus **własny nasłuch
`popstate`** w hooku, który zapisuje pozycję adresu opuszczanego i przywraca pozycję docelowego.

**R-3 · `modules/news/actions/news.ts` — `summaryFailed` przekreślał poziomy, które się udały ·
correctness**
Nieudane pobranie materiału dla **jednego** poziomu oznaczało **całą pozycję** jako „bez
streszczenia". `NewsArticle` kasuje retencja (relacja `SetNull`), a `fetchArticle` zwraca pustkę
przy paywallu — to nie jest przypadek rzadki.
*Scenariusz:* pozycja starsza niż okno retencji ma poprawne „średnie"; klik „krótkie" → brak
materiału → `summaryFailed = true` → karta pisze „bez streszczenia" **nad tekstem, który
streszczeniem jest**, a baza przeczy sama sobie.
*Poprawka:* znacznik stawiamy **tylko gdy pozycja nie ma żadnego streszczenia** — ani zapamiętanego
poziomu, ani niepustego `summary`.

### Poważne — koszt i pętle

**R-4 · `platform/jobs/handlers/userFacts.ts` — po awarii konto wracało do kolejki co GODZINĘ ·
correctness/koszt**
Znacznik zapisywały wyłącznie ścieżki powodzenia, a kandydatem jest też konto **bez wiersza
`AssistantPref`** — który tworzy dopiero ten zapis. Odstęp doby zaczynał więc obowiązywać dopiero
po pierwszym **zakończonym** przebiegu.
*Scenariusz:* model `generation` nieskonfigurowany albo zwraca nieparsowalny JSON → zadanie FAILED
→ brak wiersza → następne tyknięcie kolejkuje to samo konto. 24 przebiegi na dobę bez końca, a gdy
awaria jest **za** wywołaniem modelu — każdy płatny. `dedupeKey` tego nie łapie: obejmuje zadania
aktywne, nie zakończone błędem.
*Poprawka:* przy wyjątku zapisujemy **sam czas przebiegu, bez odcisku** — odstęp doby zaczyna
działać, a materiał wciąż liczy się jako nieprzerobiony, więc następny przebieg spróbuje ponownie.

**R-5 · `modules/news/jobs/newsRefresh.ts` — limit materiału dla JEDNEJ pozycji użyty w partii
dziesięciu · correctness/koszt**
`LIMIT_MATERIALU = 4000` jest policzony dla `resummarizeItem`. We wsadzie mnoży się przez
`SUMMARY_BATCH`, a dociąganie pełnych artykułów (nowe w tym przebiegu) może wstawić do 12 z nich:
partia rośnie z ~4 kB do ~40 kB.
*Scenariusz:* prompt przekracza okno kontekstu → `llmJson` rzuca → `przetworzPartiami` ponawia
trzykrotnie (**płacąc za każdym razem**) → wszystkie 10 pozycji dostaje `summaryFailed = true`.
Objaw dla użytkownika: cała partia „bez streszczenia" — czyli usterka, którą ten feature usuwa.
*Poprawka:* osobny `LIMIT_MATERIALU_WSAD = 1200` dla ścieżki wsadowej.

**R-6 · `migration 0269` — backfill utrwalał surowe skróty RSS jako „streszczenia" · correctness
(dane)**
Filtr `summaryFailed = false` był za wąski. Pozycja dostaje `summary = skrót z kanału` już przy
**przypisaniu do tematu**, z opuszczoną flagą; gdy przebieg skończy się przed etapem streszczania
(jawna gałąź: nieskonfigurowany model), skrót zostaje.
*Scenariusz:* właściciel miał przez jakiś czas nieskonfigurowany model → te pozycje mają w `summary`
surowy skrót → migracja zapisała go jako „streszczenie poziomu średniego" → od teraz „średnie"
**na zawsze** zwraca skrót natychmiast i za darmo. **Kodu to nie odkręci — dane już są.**
*Poprawka:* **osobna migracja `0270`**, nie edycja `0269` (ta mogła być już zaaplikowana, a zmiana
treści byłaby rozjazdem między środowiskami — C-11). Kasuje wpisy, których tekst jest **prefiksem**
opisu z puli artykułów (etap 2 zapisuje `description` przycięte do 400 znaków, więc dopasowanie jest
dokładne i nie tknie streszczenia napisanego przez model), i oznacza takie pozycje jako wymagające
streszczenia — żeby karta powiedziała to wprost i dała ponowienie (AC-22).

### Ustalenia z recenzji własnej

**W-1 · `platform/wiedza/harmonogram.ts` — automat pomijał konta bez ustawień asystenta ·
correctness.** `AssistantPref` powstaje dopiero, gdy ktoś coś w asystencie ustawi, więc konto, które
nigdy tam nie zajrzało, **nigdy nie trafiało do wnioskowania** — objaw identyczny z pierwotnym
zgłoszeniem, a niewidoczny na koncie właściciela (on ten wiersz ma). Zapytanie idzie teraz po
`User` z lewym złączeniem: **brak wiersza znaczy „automat włączony"**, zgodnie z `@default(true)`.

**W-2 · `modules/news/jobs/newsRefresh.ts` — poziom normalizowany dwa razy, dwoma sposobami ·
correctness.** `NewsItem.summaryLength` brał surowy ciąg z ustawień, `NewsItemSummary.length` —
znormalizowany. Przy nieoczekiwanej zawartości ustawień ten sam tekst miałby dwa różne poziomy
i powrót do poziomu **nie trafiłby w pamięć**. Normalizacja raz, jedna wartość dla obu zapisów.

**W-3 · `hooks/usePrzywroceniePrzewijania.ts` — sprzątanie mogło skasować właśnie zapisaną pozycję ·
correctness (utajone).** Sprzątanie czytało `scrollTop` z elementu, który przy współbieżnym
renderowaniu bywa już **odłączony**; odłączony zwraca `0`, a zapis zera **kasuje wpis**. Objaw
niedeterministyczny. Ostatnia pozycja jest teraz trzymana w zmiennej, nie odczytywana z DOM-u.

### Drobne

**R-7 · `NewsReader.tsx`** — do zależności efektu wróciła sama **tablica** `blocks`, czyli to, przed
czym broni `blocksKey`; efekt zaczyna się od `silence()`, więc zbędne uruchomienie **przerywa
czytanie**. Dziś ratował to `useMemo` u jedynego konsumenta — ciche uzależnienie od cudzego
szczegółu. *Poprawka:* bloki przez `ref`.
**R-8 · `SourceFilter.tsx`** — stopka „Zarządzaj źródłami" renderowała się także bez `onZarzadzaj`,
dając **martwy przycisk** dla drugiego konsumenta. *Poprawka:* warunek na stopce.
**R-9 · `NewsPage.tsx`** — teksty podpowiedzi i `aria-label` zapisane w komponencie; bramka
`check:i18n` ich nie widzi (nie są węzłem JSX), więc to luka bramki, nie zgodność. *Poprawka:*
przeniesione do `messages/pl.json` jako `ostatnieOdswiezanie` i `szczegolyPrzebiegu`.
**R-10 · trzy pliki JSON** straciły końcowy znak nowej linii — szum w każdym przyszłym diffie.
*Poprawka:* przywrócony.

## Sprawdzone i CZYSTE (bez zarzutu — zgodnie u obu recenzentów)

C-21 (guardy dostępu bez zmian, niczyj dostęp się nie poszerzył) · C-20 (`revalidatePath` na każdej
ścieżce wyjścia) · C-12 (zero enumów Prisma) · zgodność migracji ze schematem (`check:schema-drift`
czysty) · **streszczenie ze streszczenia niemożliwe** (`item.summary` zniknęło jako materiał) ·
brak rozjazdu `nadpisania` z serwerem (akcja aktualizuje też `NewsItem.summary`) · brak wyścigu
w przemiataniu (atomowe `INSERT … ON CONFLICT … WHERE`) · C-30, C-32, C-41, C-01, C-53.

## Bramki po poprawkach

`test:unit` **1318 / 0 porażek** · `tsc` (aplikacja i testy) czysty · `next lint` **0 błędów** ·
`next build` **Compiled successfully** · `check:migrations` (0270 zaaplikowana lokalnie) ·
`check:schema-drift`, `check:i18n`, `check:content-memory`, `check:cost-badge`, `check:ui-contract`,
`check:domain`, `check:pagination`, `check:owner-columns`, `check:logs` — wszystkie zielone.

## Werdykt

**APPROVE Z UWAGAMI** — po naprawieniu wszystkich trzynastu ustaleń.

Pierwotny werdykt subagenta brzmiał **ZMIANY WYMAGANE** i był słuszny: trzy ustalenia (R-1, R-2,
R-3) łamały funkcje, które ten feature miał naprawić, a R-6 dotyczyło **danych**, więc rewert kodu
by go nie odkręcił. Wszystkie są naprawione, a najgroźniejsze z nich — te, które psuły to samo, co
naprawiały — mają teraz w kodzie zapisane, dlaczego wyglądają tak, a nie inaczej.

Wniosek na przyszłość, ważniejszy od pojedynczych poprawek: **cztery z sześciu poważnych ustaleń to
przypadki, w których poprawka psuła dokładnie tę rzecz, którą naprawiała** (zgodność ulubionych
łamała „wstecz"; przywracanie pozycji łamało regułę „tylko przy powrocie"; pamięć streszczeń
utrwalała nie-streszczenia; automat wnioskowania zapętlał kolejkę). Testy jednostkowe i klikacz nie
widziały żadnego z nich — zobaczyło je dopiero czytanie kodu pod kątem „co ta zmiana psuje", a nie
„czy działa".
