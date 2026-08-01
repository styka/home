# Plan techniczny: Wiadomości i Pogoda — poprawki UX po wdrożeniu 039

- **Spec:** ./spec.md (040-wiadomosci-pogoda-ux)
- **Status:** draft
- **Data:** 2026-08-01

> **Zasada planu:** to jest **JAK**. Feature jest w całości „po istniejącym kodzie" — nie tworzymy
> żadnego nowego mechanizmu, tylko przestawiamy to, co już jest (039/037), i zamieniamy jedno pole
> słownikowe na tekst.

## 1. Podejście

Sześć zgłoszeń rozkłada się na **jedną zmianę danych** (kategoria źródła → opis) i **pięć zmian
prezentacji**. Wzorcem dla nowego układu Wiadomości jest **Magazynowanie/Warsztaty**: mode-aware
sub-nawigacja w jednym poziomym pasku pod nagłówkiem modułu, ta sama na desktopie i na telefonie —
nie wymyślamy nowego wzorca (C-53).

Kolejność prac wynika z zależności: najpierw dane (opis źródła dotyka schematu, akcji, AI i czterech
komponentów), potem układ, na końcu drobiazgi. Zgłoszenie z Pogody jest niezależne i można je robić
równolegle.

## 2. Model danych (Prisma)

### 2.1 `NewsSource.leaning` → `NewsSource.descriptor`

Kategoria światopoglądowa przestaje być zamkniętym zbiorem. Zamiast dokładać kolumnę i utrzymywać
dwie, **zmieniamy nazwę i znaczenie** jednej:

```prisma
model NewsSource {
  …
  // 040: krótki opis źródła własnymi słowami („pop-science", „nature", „lewica").
  // Zastąpił zamknięty zbiór left|center|right — zestaw kanałów dawno wyszedł poza politykę.
  // Pusty = źródło bez opisu (dozwolone).
  descriptor String @default("")
  …
}
```

- **Typ:** `String` z domyślnym `""` — nie `null`, żeby kod nie musiał rozróżniać „brak kolumny" od
  „pusty opis" (AC-5 wymaga tylko, by pusty opis nie psuł widoku).
- **Bez enuma (C-12)** — i tym razem to nie tylko konwencja, ale sedno zgłoszenia.
- **Długość:** ograniczenie egzekwujemy w akcji (60 znaków), nie w DDL — reszta modułu robi tak samo.

### 2.2 Migracja (C-10, C-11)

- Numer: **0219** (`npm run next:migration`)
- Katalog: `prisma/migrations/0219_opis_zrodla_wiadomosci/migration.sql`
- DDL — trzy kroki, w tej kolejności:
  ```sql
  ALTER TABLE "NewsSource" ADD COLUMN "descriptor" TEXT NOT NULL DEFAULT '';

  -- AC-4: żadne istniejące źródło nie może zostać z pustym opisem ani surowym left/center/right.
  UPDATE "NewsSource" SET "descriptor" = CASE "leaning"
      WHEN 'left'   THEN 'Lewica'
      WHEN 'center' THEN 'Centrum'
      WHEN 'right'  THEN 'Prawica'
      ELSE 'Centrum'
    END;

  ALTER TABLE "NewsSource" DROP COLUMN "leaning";
  ```
- **`DROP COLUMN` jest nieodwracalny** — ale poprzedza go `UPDATE`, który przenosi całą informację do
  nowej kolumny, więc nic nie ginie. Komentarz w migracji musi to mówić wprost.
- Kolejność ma znaczenie: `UPDATE` **przed** `DROP`, inaczej mapowanie nie ma z czego czytać.

## 3. Warstwa serwera (Server Actions — C-20)

`src/actions/news.ts`:

| Funkcja | Zmiana |
|---|---|
| `SourceDTO` | `leaning: Leaning` → `descriptor: string` |
| `NewsItemDTO`, `TimelineEntryDTO` | `leaning` → `sourceDescriptor: string \| null` (dla linii czasu nadal `null`, gdy źródło usunięto) |
| `createSource(data)` | przyjmuje `descriptor?: string` zamiast `leaning`; przycina do 60 znaków |
| `updateSource(id, patch)` | `patch.descriptor?: string` zamiast `patch.leaning` |
| `getSources` / `getTopicView` / `getTopicTimeline` | zwracają `descriptor` zamiast `leaning` |
| `ensureNewsSetup` | seeduje `DEFAULT_SOURCES` z opisami po polsku |

Guard i własność bez zmian: `requireAuth()` + `ownerId` (C-21). Każda mutacja kończy
`revalidatePath("/wiadomosci")` (C-20). **Żadnej nowej akcji** — zgłoszenia 2, 3, 5, 6 to wyłącznie
warstwa prezentacji, a zgłoszenie 4 (Pogoda) nie rusza serwera.

`src/lib/news/sources.ts`:
- `type Leaning` i `LEANING_META` **znikają**.
- `DefaultSource.leaning` → `descriptor` z wartościami „Centrum" / „Lewica" / „Prawica" (spójnie z
  migracją, żeby nowy użytkownik dostał to samo co zmigrowany).

## 4. Kolor źródła — `src/lib/news/sourceColor.ts` (nowy, ~15 linii)

Decyzja właściciela: kolor **liczony z opisu**, ten sam opis zawsze daje ten sam kolor (AC-3).

- `sourceColor(descriptor: string): string` — zwraca **nazwę zmiennej CSS** z zamkniętej palety
  akcentów motywu: `--accent-blue | --accent-green | --accent-red | --accent-amber | --accent-purple`.
- Wybór przez prostą, stabilną sumę kodów znaków modulo długość palety, na tekście znormalizowanym
  **tym samym `fingerprintOf`** co reszta systemu (`lib/textKey.ts`) — dzięki temu „Pop-Science" i
  „pop science" dostają jeden kolor, a nie dwa.
- **Pusty opis → `--text-muted`** (AC-5): źródło bez opisu jest neutralne, a nie losowo kolorowe.
- Tylko zmienne CSS, zero hexów (C-30) — skórka nadpisuje paletę i kolory źródeł idą za nią.
- **Z testem jednostkowym**: stabilność (ten sam opis → ten sam kolor), niewrażliwość na wielkość
  liter i diakrytyki, pusty opis → kolor neutralny, wynik zawsze z palety.

## 5. RBAC / rejestr modułu (C-22)

**Bez zmian.** Żadnego nowego slugu, żadnych wpięć w `permissions.ts` / `modules.tsx` /
`ModuleSidebar`. Feature nie dodaje trasy — wszystko dzieje się wewnątrz `/wiadomosci` i `/pogoda`.

## 6. UI (C-30, C-31, C-32)

### 6.1 Nowy układ Wiadomości (`NewsPage.tsx`) — zgłoszenia 3 i 5

Dziś: `grid md:grid-cols-[240px_1fr]` z `TopicList` w lewej kolumnie + trzy tryby (`feed`/`hot`/
`settings`) przełączane przyciskami w nagłówku, bez powrotu na telefonie.

Po zmianie — **jeden pionowy stos**, pełna szerokość:

1. **Nagłówek modułu** — tytuł, „Odśwież", pasek stanu przebiegu (bez zmian).
2. **Pasek widoków** (poziomy, zawsze widoczny, ten sam na obu szerokościach): `Tematy` ·
   `Gorące tematy` · `Źródła`. To rozwiązuje AC-13/AC-14 — powrót to kliknięcie w „Tematy", zawsze
   obecne i wyraźnie zaznaczone jako aktywne. Dzisiejsze przyciski-przełączniki w nagłówku znikają
   (dublowałyby ten pasek).
3. **Pasek zakładek tematów** (tylko w widoku „Tematy") — poziomy, `overflow-x-auto` **we własnym
   kontenerze** (AC-16: przewija się on, nie strona), zakładka = pełna nazwa tematu + licznik
   nowych. Bez `truncate` — nazwa ma być czytelna w całości (AC-9); przy nadmiarze przewijamy pasek.
4. **Przełącznik treści tematu**: `Nowe wiadomości (N)` / `Linia czasu (M)` — dwa segmenty,
   domyślnie wiadomości (AC-10). Wybór trzymany w stanie strony, **nie resetowany przy zmianie
   tematu** (AC-11).
5. **Treść** — lista wiadomości albo linia czasu, pełna szerokość.

`TopicList` (kolumna z edycją/usuwaniem tematów) **nie znika** — zmienia postać: zakładki obsługują
wybór, a zarządzanie (dodaj/edytuj/usuń) przenosimy do paska zakładek jako przycisk „+" oraz akcje
przy aktywnym temacie. Minimalizm (C-53): to ten sam komponent po przebudowie, nie nowy byt.

Filtr źródeł (zakładki portali) zostaje tam, gdzie jest — pod przełącznikiem treści.

### 6.2 Opis źródła w UI — zgłoszenie 1

- `NewsSettings.tsx` — `<select>` → `<input type="text">` z `placeholder="np. pop-science, lewica"`
  i `maxLength={60}`; zapis jak dziś (`onBlur`/Enter → `updateSource`). To samo w formularzu dodawania.
- `NewsItemCard.tsx` — badge źródła: kolor z `sourceColor(descriptor)`, tekst = nazwa źródła; opis
  jako drugi, stonowany element obok (albo `title`, gdy pusty — AC-5).
- `NewsPage.tsx` — kropka przy zakładce źródła: `sourceColor`.
- `NewsTimeline.tsx` — kropka na osi: `sourceColor`.

### 6.3 Gorące tematy — zgłoszenie 2

`HotTopics.tsx`:
- `add(t)` **przestaje wołać `onAdded()`** (to `onAdded` robi dziś `setView("feed")` w rodzicu).
- Zamiast tego: komunikat „Dodano temat „X" do monitorowanych" (istniejący `showToast` — C-53) i
  **lokalne oznaczenie karty** jako monitorowanej (stan `addedFingerprints: Set<string>`), z
  przyciskiem zmienionym na nieaktywne „Monitorowany" (AC-7).
- Lista tematów w rodzicu odświeża się przez `router.refresh()` **bez** zmiany widoku.

### 6.4 Poziomy scroll — zgłoszenie 6

**Przyczyna znaleziona:** `NewsSettings.tsx:98` —
`<span className="flex-1 truncate …">{s.rssUrl}</span>`. Element `flex-1` ma domyślnie
`min-width: auto`, więc **nie może zwęzić się poniżej treści**; `truncate` (`overflow: hidden`) nigdy
nie dostaje szansy zadziałać, a długi adres RSS rozpycha wiersz i całą stronę. Objaw pasuje
dokładnie do zgłoszenia: „coś rozciąga stronę, ale nie widać co" — bo tekst jest **ucięty wizualnie
przez krawędź ekranu**, nie przez `truncate`.

Naprawa: `min-w-0` na tym elemencie (AC-16 — przyczyna, nie objaw). Dodatkowo przegląd trzech
widoków modułu pod tym samym wzorcem; **nie** dodajemy `overflow-x-hidden` na kontenerze strony.

### 6.5 Pogoda — zgłoszenie 4

`IdeasPanel.tsx` + `IdeaDetailSheet.tsx`:
- Przycisk `ChevronRight` („Pokaż szczegółowy plan") **znika** — klik w kartę robi to samo (AC-18).
  Zostają `Star` (zapisz) i `Ban` (nie proponuj), które robią co innego.
- `IdeaDetailSheet` przenosi się **z dołu panelu do wnętrza rozwiniętej pozycji**: renderowany
  bezpośrednio pod kartą klikniętej propozycji (AC-17). Stan `open` już dziś trzyma jedną
  propozycję, więc „tylko jedna rozwinięta" (AC-19) wychodzi bez dodatkowej logiki.
- Zamknięcie: istniejący przycisk zamykania w nagłówku sheeta + ponowne kliknięcie w tę samą kartę
  (AC-20).
- Karta rozwinięta dostaje wizualne oznaczenie (obramowanie akcentem), żeby było widać, co jest
  otwarte.

## 7. AI / integracje (C-23, C-40)

Bez nowych `AIAction`, ale **trzy miejsca muszą przejść na `descriptor`**, inaczej katalog opisuje
nieistniejące pole i `check:actions` zatrzyma build:

| Plik | Zmiana |
|---|---|
| `lib/ai/agentPrompt.ts` | `leaning?("left"\|"center"\|"right")` → `descriptor?` („krótki opis źródła własnymi słowami") w `create_news_source` i `update_news_source` |
| `lib/ai/actionContract.ts` | `sel("Profil źródła", NEWS_LEANING_OPTIONS)` → `f("Opis źródła")` (kontrolka `text`); `NEWS_LEANING_OPTIONS` i etykieta `leaning` usunięte |
| `lib/ai/executors/newsExecutor.ts` | walidacja z listy trzech wartości → `asStr(params.descriptor)` |
| `lib/ai/agentTools.ts` | `list_news_sources` zwraca `descriptor` zamiast `leaning` (opis narzędzia też) |

Manifesty pokrycia (`action-coverage.json`, `cost-badge-coverage.json`,
`content-memory-coverage.json`) — **bez zmian**: nie dochodzi żadna akcja ani wywołanie modelu.

## 8. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/migrations/0219_opis_zrodla_wiadomosci/migration.sql` | nowy | `descriptor` + przeniesienie danych + `DROP leaning` |
| `prisma/schema.prisma` | edycja | `NewsSource.descriptor` |
| `src/lib/news/sources.ts` | edycja | usunięcie `Leaning`/`LEANING_META`, opisy w `DEFAULT_SOURCES` |
| `src/lib/news/sourceColor.ts` + `.test.ts` | nowy | kolor z opisu, z palety zmiennych CSS |
| `src/actions/news.ts` | edycja | DTO i akcje na `descriptor` |
| `src/components/news/NewsPage.tsx` | edycja | nowy układ: pasek widoków, zakładki tematów, przełącznik treści |
| `src/components/news/NewsSettings.tsx` | edycja | pole tekstowe zamiast `select`; **`min-w-0`** (poziomy scroll) |
| `src/components/news/NewsItemCard.tsx` | edycja | badge z opisem i kolorem |
| `src/components/news/NewsTimeline.tsx` | edycja | kropka w kolorze z opisu |
| `src/components/news/HotTopics.tsx` | edycja | brak przejścia po „Monitoruj", potwierdzenie, oznaczenie karty |
| `src/components/weather/IdeasPanel.tsx` | edycja | usunięcie przycisku szczegółów, sheet w miejscu pozycji |
| `src/lib/ai/{agentPrompt,actionContract,agentTools}.ts`, `executors/newsExecutor.ts` | edycja | `leaning` → `descriptor` |
| `CLAUDE.md`, `doświadczenia.md` | edycja | opis modułu po zmianie; lekcja o `flex-1` bez `min-w-0` |

## 9. Bramki i weryfikacja (C-50)

Lokalnie, przeciw **lokalnemu** Postgresowi (C-13, nigdy prod):
`check:migrations` → `check:actions` → `check:ai-coverage` → `check:cost-badge` →
`check:content-memory` → `next lint --dir src` → `prisma generate` → `next build` → `npm run test:unit`.

Mapowanie AC → sposób sprawdzenia:

| AC | Jak weryfikujemy |
|---|---|
| AC-1, AC-2 | Lektura `NewsSettings`/`NewsItemCard`/`NewsPage`/`NewsTimeline` — brak `<select>`, obecny `descriptor` |
| AC-3 | Test jednostkowy `sourceColor`: stabilność i przynależność do palety |
| AC-4 | **Na żywej bazie**: wiersze `NewsSource` sprzed migracji dostają „Lewica"/„Centrum"/„Prawica"; `grep` na brak `leaning` w `src` |
| AC-5 | Test: pusty opis → kolor neutralny; lektura UI pod kątem pustego badge'a |
| AC-6, AC-7 | Lektura `HotTopics` — `add()` nie woła `onAdded`, jest `showToast` i oznaczenie karty |
| AC-8, AC-9 | Lektura `NewsPage` — brak `md:grid-cols-[240px_1fr]`, zakładki bez `truncate` |
| AC-10, AC-11 | Lektura `NewsPage` — domyślny segment „Nowe wiadomości"; stan widoku poza zależnością od `selectedId` |
| AC-12 | Brak wariantu `hidden md:*` dla nawigacji tematów — jeden mechanizm |
| AC-13, AC-14 | Pasek widoków obecny w każdym trybie, aktywny wyróżniony |
| AC-15, AC-16 | `grep` na `flex-1 truncate` bez `min-w-0` w module = brak; **brak** nowego `overflow-x-hidden` na kontenerze strony |
| AC-17..AC-20 | Lektura `IdeasPanel` — sheet w mapowaniu listy, brak przycisku `ChevronRight`, jeden `open` |

## 10. Ryzyka techniczne i plan wycofania

- **`DROP COLUMN "leaning"` jest nieodwracalny.** → Poprzedza go `UPDATE` przenoszący całą treść do
  `descriptor`; informacja nie ginie, ginie tylko forma. Rollback kodu bez rollbacku migracji **nie
  zadziała** (stary kod czyta `leaning`) — w razie potrzeby wycofujemy jedno i drugie, wg runbooka
  DevOps.
- **Kolor liczony z tekstu może dać dwóm źródłom ten sam odcień.** → Paleta ma 5 pozycji, źródeł jest
  kilka; kolor jest wsparciem, nie jedynym nośnikiem — nazwa źródła stoi obok.
- **Przebudowa `NewsPage` dotyka najgęstszego komponentu modułu.** → Zmieniamy wyłącznie układ i
  nawigację; pobieranie danych, stan przebiegu i karty zostają nietknięte.
- **Zakładki tematów mogą same stać się źródłem poziomego scrolla** (ironicznie, przy naprawie
  zgłoszenia 6). → `overflow-x-auto` **na kontenerze zakładek**, nie na stronie; weryfikacja AC-15
  obejmuje widok „Tematy".

## 11. Zgodność z konstytucją — checklista

- [x] **C-10, C-11, C-12** — ręczna migracja 0219, numer z `next:migration`, `descriptor` jako `String`
- [x] **C-13** — build i migracje wyłącznie przeciw lokalnemu Postgresowi
- [x] **C-20, C-21** — mutacje przez Server Actions z `revalidatePath`, guard `requireAuth` + `ownerId`
- [x] **C-22** — bez nowych slugów i tras
- [x] **C-23** — cztery miejsca warstwy AI zsynchronizowane z `descriptor`
- [x] **C-30** — kolor wyłącznie ze zmiennych CSS, zero hexów
- [x] **C-31** — jeden mechanizm nawigacji na obu szerokościach; brak poziomego scrolla
- [x] **C-32** — teksty po polsku, łącznie z opisami zmigrowanych źródeł
- [x] **C-51** — lekcja o `flex-1` bez `min-w-0` do `doświadczenia.md`
- [x] **C-53** — zero nowych zależności; jedyny nowy plik to 15-linijkowy helper koloru z testem
