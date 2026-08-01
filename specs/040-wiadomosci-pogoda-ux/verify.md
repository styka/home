# Weryfikacja: 040 — Wiadomości i Pogoda, poprawki UX po 039

- **Data:** 2026-08-01
- **Branch:** `claude/weather-features-expansion-ic9okq`
- **Zakres:** 17/17 zadań z `tasks.md` odhaczonych

## Bramki

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0220)" |
| `npm run check:actions` | ✅ 160 akcji, wszystkie z egzekutorem i kontraktem |
| `npm run check:ai-coverage` | ✅ 533 akcje z zakresem **i guardem w kodzie** |
| `npm run check:cost-badge` | ✅ 34 pliki |
| `npm run check:content-memory` | ✅ 34 pliki sklasyfikowane |
| `npx next lint --dir src` | ✅ **0 błędów** (ostrzeżenia kosmetyczne sprzed tej zmiany) |
| `npx next build` | ✅ „Compiled successfully"; `/wiadomosci` 17,4 kB |
| `npm run test:unit` | ✅ **567/567, 0 pominiętych** (+7 nowych testów `sourceColor`) |

Wyłącznie lokalny Postgres (`127.0.0.1:5432/omnia_dev`); `scripts/migrate.js` nie uruchamiany (C-13).

## Kryteria akceptacji

Oznaczenie „[żywa baza]" = sprawdzone skryptem jednorazowym na lokalnej bazie (tworzył i kasował
własnych użytkowników; nie został w repo).

| AC | Werdykt | Dowód |
|---|---|---|
| AC-1 pole tekstowe zamiast listy | ✅ | `grep "<select"` w `src/components/news/` → **brak trafień**. `NewsSettings.tsx` ma `SourceDescriptorInput` (wiersz źródła) i `<input maxLength={60}>` (formularz dodawania). [żywa baza] zapis opisu „pop-science" przechodzi — kolumna przyjmuje dowolny tekst, nie tylko trzy dawne wartości |
| AC-2 opis w prezentacji | ✅ | [żywa baza] opis dociera tam, gdzie UI go czyta: `NewsItem.source.descriptor` **i** `NewsTimelineEntry.source.descriptor` zwracają „pop-science". W UI: `NewsItemCard` (obok nazwy + `title` badge'a), `NewsPage` (kropka zakładki), `NewsTimeline` (kropka osi) |
| AC-3 kolor stabilny i rozróżnialny | ✅ | Test `sourceColor.test.ts` (7 przypadków, w tym stabilność, paleta, rozrzut ≥3 kolorów). [żywa baza] dwa niezależne odczyty tego samego wiersza dają ten sam kolor, należący do palety |
| AC-4 migracja bez pustych opisów | ✅ | **Sprawdzone na danych przed migracją**: kopia tabeli z `left/center/right` **+ wartość spoza zbioru** przepuszczona przez ten sam `CASE` → „Lewica/Centrum/Prawica/Centrum", 0 pustych. [żywa baza] `information_schema`: kolumna `leaning` **nie istnieje**, `descriptor` istnieje |
| AC-5 pusty opis nie psuje widoku | ✅ | [żywa baza] źródło bez opisu powstaje (`descriptor === ""`), opis **da się wyczyścić** (dowód, że `updateSource` sprawdza `undefined`, a nie prawdziwość), pusty opis → kolor neutralny. W UI `title={… \|\| undefined}` i warunkowy `{descriptor && …}` — brak pustego badge'a |
| AC-6 „Monitoruj" nie wyrzuca z listy | ✅ | `HotTopics.add()` nie woła już `onAdded()`; prop przemianowany na `onTopicsChanged`, a `NewsPage` przekazuje `() => router.refresh()` — bez `setView` |
| AC-7 potwierdzenie + oznaczenie | ✅ | `showToast("Dodano „X" do monitorowanych")` + stan `monitored: Set<fingerprint>` → przycisk zamienia się w nieaktywne „Monitorowany" z ikoną `Check` |
| AC-8 brak kolumny na desktopie | ✅ | `grep "md:grid-cols-\[240px"` → **0 trafień**; widok tematu to `<div className="min-w-0">` na pełną szerokość |
| AC-9 pełne nazwy tematów | ✅ | `grep truncate` wewnątrz `TopicTabs` → **0 trafień**; zakładki mają `whitespace-nowrap` + `shrink-0`, więc nazwa nie jest ani ucinana, ani łamana |
| AC-10 najpierw nowe wiadomości | ✅ | `useState<ContentTabKey>("items")` — domyślny segment to wiadomości; linia czasu renderuje się tylko przy `contentTab === "timeline"` |
| AC-11 wybór przeżywa zmianę tematu | ✅ | `contentTab` leży w stanie strony i **nie ma** żadnego `useEffect` resetującego go przy zmianie `selectedId` (sprawdzone przeglądem wszystkich efektów w `NewsPage`) |
| AC-12 jeden mechanizm nawigacji | ✅ | `grep "hidden md:"` w `NewsPage.tsx` → **0 trafień**; `ViewTabs` i `TopicTabs` renderują się identycznie na obu szerokościach |
| AC-13 powrót jednym dotknięciem | ✅ | `<ViewTabs>` stoi **przed** blokami `view === …`, więc jest w każdym trybie; kliknięcie „Tematy" wraca z „Źródeł" i „Gorących tematów" |
| AC-14 widać, gdzie jestem | ✅ | Aktywna zakładka: `border-[var(--accent-blue)]` + `text-primary` + `aria-selected`; `role="tablist"` z etykietą |
| AC-15 brak poziomego scrolla | ✅ | `grep "flex-1 truncate"` bez `min-w-0` w Wiadomościach i Pogodzie → **0 trafień**. Nowy pasek zakładek ma `overflow-x-auto` **i** `min-w-0` na własnym kontenerze, więc sam nie odtwarza problemu |
| AC-16 przyczyna, nie objaw | ✅ | `git diff origin/develop...HEAD -- '*.tsx' '*.ts' '*.css' \| grep "^+.*overflow-x-hidden"` → **0**. (Pierwszy przebieg grepa dał 5 trafień — wszystkie okazały się **tekstem dokumentacji** mówiącym, że tego nie robimy; ograniczenie grepa do plików kodu to potwierdziło.) Naprawą jest `min-w-0` na elemencie, który rozpychał wiersz |
| AC-17 szczegóły w polu widzenia | ✅ | `IdeaDetailSheet` renderowany **wewnątrz** `ideas.map(...)`, bezpośrednio pod kartą o `fingerprint` równym `open.fingerprint`; stare renderowanie na końcu panelu usunięte |
| AC-18 brak dublującego przycisku | ✅ | `grep ChevronRight src/components/weather/IdeasPanel.tsx` → **0 trafień** (usunięty także z importów) |
| AC-19 jedna rozwinięta naraz | ✅ | Stan `open` przechowuje **jedną** propozycję; `isOpen` liczone per karta z porównania odcisków — dwie rozwinięte są niewyrażalne w tym stanie |
| AC-20 jawne zamknięcie | ✅ | Przycisk zamykania w nagłówku sheeta (`onClose`) **oraz** ponowne kliknięcie tej samej karty (`isOpen ? setOpen(null) : openIdea(idea)`) |

**20/20 spełnionych.** Żadne AC nie jest częściowe ani niespełnione.

## Zgodność z konstytucją

| Reguła | Stan |
|---|---|
| C-01 praca w `worldofmag/` | ✅ poza `specs/` (C-03) i `doświadczenia.md` (C-51) |
| C-02 alias `@/*` | ✅ nowy import `@/lib/news/sourceColor` |
| C-10, C-11 | ✅ ręczna migracja 0219, numer z `next:migration` |
| C-12 zero enumów Prisma | ✅ `descriptor` to `String`; tu nie tylko konwencja — dowolny tekst jest sednem zmiany |
| C-13 nigdy prod DB | ✅ wyłącznie lokalny Postgres |
| C-20 `revalidatePath` | ✅ `createSource`/`updateSource` bez zmian w tym zakresie |
| C-21 własność | ✅ guardy `requireAuth` + `ownerId` nietknięte |
| C-22 RBAC | ✅ bez nowych slugów i tras |
| C-23 `AIAction` | ✅ cztery miejsca warstwy AI przeszły na `descriptor`; `check:actions` zielony |
| C-30 zmienne CSS | ✅ paleta `sourceColor` to wyłącznie `var(--accent-*)`; licznik na zakładce używa `var(--on-accent)` zamiast `text-white` |
| C-31 mobile-first | ✅ jeden mechanizm nawigacji, cele `py-3`, przewijanie w kontenerze zakładek |
| C-32 teksty PL | ✅ całe UI po polsku |
| C-51 `doświadczenia.md` | ✅ lekcja o `flex-1`/`truncate`/`min-w-0` wraz ze wskazówką diagnostyczną |
| C-53 minimalizm | ✅ jeden nowy plik (helper koloru, ~50 linii z komentarzami) + jego test; zero nowych zależności |

## Regresje

- **Warstwa AI** — `agentPrompt`, `actionContract`, `newsExecutor`, `agentTools` konsekwentnie na
  `descriptor`; `grep leaning` w całym `src` → **0 trafień**.
- **Eksport RODO** (`actions/privacy.ts`) — nie odwoływał się do `leaning`, więc `DROP COLUMN` go nie
  dotyka; `grep` potwierdza brak odwołań.
- **Martwy kod** — `TopicList` usunięty w całości (`grep TopicList` → 0); `TopicModal` nadal używany
  przez `TopicTabs`, więc został.
- **Testy** — 567/567, w tym integracyjne na bazie; przyrost +7 to nowe testy `sourceColor`.
- **Build** — `/wiadomosci` 17,4 kB (przed zmianą 17 kB); brak nowych ostrzeżeń lint.

### Uwagi (nieblokujące)

1. **Filtr źródeł a przełącznik treści.** Filtr portalu (`sourceFilter`) działa na obu widokach
   tematu — także na linii czasu, gdzie odsiewa fakty bez źródła dopiero przy wybranym portalu
   (`t.sourceKey === null` przechodzi zawsze). To zachowanie sprzed 040, celowo nietknięte.
2. **Kolor przy dwóch źródłach o tym samym opisie** będzie identyczny. Świadomy kompromis (spec §9):
   kolor jest wsparciem, nazwa źródła stoi obok.
3. **Opis źródła nie trafia jeszcze do promptów modelu** — plan §7 zakładał tylko synchronizację
   katalogu akcji, a klasyfikacja i tak nigdy nie dostawała `leaning`. Dołożenie opisu do promptu
   byłoby nową funkcją, nie poprawką UX.

## Werdykt końcowy

**GOTOWE** — 20/20 kryteriów akceptacji spełnionych (10 potwierdzonych zachowaniem na żywej bazie,
reszta przeglądem kodu i grepami wykluczającymi), wszystkie bramki zielone, brak naruszeń konstytucji,
brak wykrytych regresji.
