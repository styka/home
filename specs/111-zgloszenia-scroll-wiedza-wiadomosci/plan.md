# Plan techniczny: Powrót do miejsca czytania, rosnąca wiedza o użytkowniku i uporządkowane Wiadomości

- **Spec:** ./spec.md (111-zgloszenia-scroll-wiedza-wiadomosci)
- **Status:** draft
- **Data:** 2026-08-27

## 0. Co rekonesans ustalił — przyczyny, nie objawy

Każde z pięciu zgłoszeń ma ustaloną przyczynę w kodzie. Plan naprawia przyczyny.

| # | Objaw | **Przyczyna (ustalona w kodzie)** |
|---|-------|-----------------------------------|
| 1 | Wstecz wraca na górę | Przewijaniem rządzi **własny kontener** w `ModuleView`, a nie okno. Przywracanie pozycji przez przeglądarkę i przez Next dotyczy okna, więc dla tego kontenera **nie istnieje**. Nic w repo nie zapisuje jego pozycji. |
| 2 | Wiedza nie rośnie | `user.facts` jest kolejkowane z **dokładnie jednego miejsca** — przycisku „Poszukaj hipotez" (`UserFactsSection.tsx:55`). Nic nie uruchamia go samo. Do tego handler czyta **trzy** sygnały (pomysły pogodowe, tematy wiadomości, ukryte gorące tematy) i przy `< 3` pozycjach **kończy bez wnioskowania** — u konta, które nie używa Pogody, próg bywa nieosiągalny. |
| 3 | Pusty wiersz akcji | `ViewBar.tsx` nakłada poniżej `md` **`[&>*]:flex-1` na WSZYSTKIE dzieci** strefy akcji. Ikona „Nowy temat", „Odśwież" i koło zębate dostają po **1/3 szerokości** niezależnie od treści — stąd „dwie ikony po bokach i jedna ikona z tekstem na środku". To wada **ramy**, nie modułu: dotyczy każdego widoku z akcjami. |
| 4 | „Średnie" dwa razy = dwa teksty | Dwie ścieżki streszczania mają **różny materiał wejściowy**: przebieg odświeżania streszcza **wsadowo** ze skrótu RSS (`newsRefresh.ts:429`, `it.summary.slice(0, 600)`), a `resummarizeItem` **dociąga pełny artykuł** (4000 znaków) dla jednej pozycji. Ten sam poziom, kilkakrotnie więcej materiału → dłuższy tekst. Instrukcja długości jest **zduplikowana w dwóch plikach**. Osobno: `resummarizeItem` **nigdy nie sprawdza, czy dany poziom już istnieje** (zawsze płatne wywołanie) i przy nieudanym pobraniu artykułu streszcza `item.summary`, czyli **poprzednie streszczenie**. |
| 4b | „Brak treści do streszczenia", a po zmianie poziomu treść się znajduje | Dokładnie ta sama różnica: wsad widzi wyłącznie skrót RSS, który bywa pusty; ponowienie widzi pełny artykuł. Przebieg **nie próbuje** sięgnąć po artykuł, gdy skrótu nie ma. |
| 5 | Lektor czyta stary tekst | **Dwa nośniki tej samej treści**: karta trzyma nowe streszczenie w `useState` (`NewsItemCard.tsx:36`), a lektor buduje bloki z propsów serwera (`NewsStream.tsx:123`, `text: i.summary`). Do tego `NewsReader.tsx:261` liczy `blocksKey` **wyłącznie z tytułów** — więc nawet gdyby nowy tekst dotarł, efekt startujący lektora by się nie obudził. |

## 1. Podejście

Pięć zgłoszeń, cztery obszary, jedna zasada wspólna: **usunąć drugi nośnik tej samej informacji**
(pozycja przewijania nigdzie nie zapisana, streszczenie w dwóch miejscach, długość streszczenia
w dwóch plikach) i **poszerzyć ramę zamiast robić wyjątek w module** (proporcje akcji to wada
`ViewBar`, więc naprawa idzie tam, a zyskuje na niej dwadzieścia widoków).

Wzorce do naśladowania, po kolei: `platform/nawigacja/historia.ts` + `useHistoriaNawigacji`
(czysta logika w platformie, pamięć sesji, brak pamięci = stan poprawny) dla przewijania;
`platform/retention/harmonogram.ts` (atomowe odebranie prawa do przebiegu warunkowym `UPDATE`
na `Config`) dla automatu wnioskowania; `NewsRefreshRun`/`NewsPref` dla nowej tabeli w Wiadomościach.

## 2. Model danych (Prisma)

### 2.1 `NewsItemSummary` — streszczenie per poziom (AC-18, AC-19, AC-20)

```prisma
model NewsItemSummary {
  id        String   @id @default(cuid())
  itemId    String
  // "short" | "medium" | "long" — String + union TS, nigdy enum (C-12).
  length    String
  text      String
  // Czy powstało z pełnej treści artykułu, czy tylko ze skrótu z kanału. Pokazuje, dlaczego
  // dwa poziomy tej samej pozycji mogą różnić się szczegółowością.
  fromArticle Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  item NewsItem @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@unique([itemId, length])
  @@index([itemId])
}
```

**Bez `workspaceId` i bez kolumn właściciela** — świadomie: `NewsItem` też ich nie ma, własność
płynie przez `topic.workspaceId`. Dodanie nullable `workspaceId` uruchomiłoby wymóg wyzwalacza
z `check:workspace-fill`, czyli mechanizm dla własności, której ta tabela nie niesie.
`NewsItem.summary` / `summaryLength` **zostają** i dalej znaczą „poziom aktualnie pokazywany" —
nie są drugim nośnikiem, tylko wskaźnikiem, który z zapamiętanych wierszy jest bieżący.

### 2.2 `AssistantPref` — automat wnioskowania (AC-5, AC-6, AC-9)

```prisma
  // 111: automatyczne wnioskowanie wiedzy o użytkowniku. Domyślnie WŁĄCZONE — właściciel prosił,
  // żeby wiedza przyrastała sama; automat domyślnie wyłączony nie spełniłby zgłoszenia.
  autoFacts      Boolean   @default(true)
  // Kiedy ostatnio przebieg się odbył (także gdy skończył się bez wołania modelu).
  factsLastRunAt DateTime?
  // Odcisk materiału z ostatniego przebiegu. Równy odcisk = nic nowego = nie wołamy modelu (AC-6).
  factsStamp     String?
```

### 2.3 Migracja (C-10, C-11, C-14, C-15)

- Numer z `npm run next:migration`: **0269**
- Katalog: `prisma/migrations/0269_streszczenia_per_poziom_i_automat_wiedzy/migration.sql`
- DDL, ręcznie pisany (**nie** wklejony z `migrate diff` — C-15), idempotentny:
  - `CREATE TABLE IF NOT EXISTS "NewsItemSummary" (…)` + `CREATE UNIQUE INDEX IF NOT EXISTS
    "NewsItemSummary_itemId_length_key"` + indeks na `itemId` + FK `ON DELETE CASCADE`.
  - **Przeniesienie stanu bieżącego**: `INSERT INTO "NewsItemSummary" … SELECT id, "summaryLength",
    "summary" … FROM "NewsItem" WHERE "summaryFailed" = false ON CONFLICT DO NOTHING` — bez tego
    pierwsze przełączenie poziomu po wdrożeniu zgubiłoby tekst, który użytkownik właśnie czyta.
  - `ALTER TABLE "AssistantPref" ADD COLUMN IF NOT EXISTS "autoFacts" BOOLEAN NOT NULL DEFAULT true`,
    `… "factsLastRunAt" TIMESTAMP(3)`, `… "factsStamp" TEXT`.
- Weryfikacja po napisaniu: `grep -E "^(DROP|ALTER TABLE .* DROP)" migration.sql` musi być pusty.

## 3. Warstwa serwera (Server Actions — C-20)

### 3.1 `src/modules/news/actions/news.ts`

- **`resummarizeItem(itemId, length, opts?: { force?: boolean })`** — przepisana:
  1. guard bez zmian (`czyMojRekord(item.topic, user.id)` — C-21, dostęp niezmieniony);
  2. **gdy nie `force`** i istnieje `NewsItemSummary[itemId, length]` → zwróć zapisany tekst,
     `usage: undefined`, **bez wywołania modelu** (AC-18);
  3. materiał źródłowy: `fetchArticle(item.url).text`, a gdy pusty — `item.article?.description`
     (surowy skrót z kanału z `NewsArticle`). **Nigdy `item.summary`** (AC-19);
  4. gdy nie ma żadnego materiału → `summaryFailed = true`, czytelny błąd, brak zapisu (AC-22);
  5. generacja przez wspólną instrukcję długości (§3.3), jedna korekta gdy wynik przekracza
     pułap o >50 % (AC-23);
  6. `upsert` do `NewsItemSummary` + `update` na `NewsItem` (`summary`, `summaryLength`,
     `summaryFailed: false`);
  7. `revalidatePath("/wiadomosci")`.
- Kontrakt zwrotu rośnie o `fromMemory: boolean` i `fromArticle: boolean` — UI musi umieć
  powiedzieć „to jest tekst, który już czytałeś", zamiast udawać świeżą generację.
- Sygnatura pozostaje jedną akcją; „Wygeneruj ponownie" to `force: true` (AC-20) — druga akcja
  o tym samym ciele byłaby drugim nośnikiem tej samej reguły.

### 3.2 `src/modules/news/jobs/newsRefresh.ts`

- `summarizeItems`: **przed** złożeniem partii wyznacz pozycje o **ubogim materiale**
  (skrót z kanału pusty albo < 200 znaków) i dla nich — z twardym limitem (do 12 na przebieg,
  sekwencyjnie, błąd pobrania nie przerywa etapu) — dociągnij pełny artykuł i użyj go jako
  materiału (AC-21). Pozostałe pozycje bez zmian: skrót z kanału (wciąż nie robimy
  kilkudziesięciu żądań HTTP na przebieg).
- Wynik każdej pozycji zapisujemy **także** do `NewsItemSummary` (poziom domyślny użytkownika),
  więc powrót do poziomu domyślnego jest darmowy (AC-18).
- Pusty albo skrajnie krótki wynik modelu liczy się jako **niepowodzenie pozycji**, a nie jako
  streszczenie — dziś `summaryFailed` ustawia się tylko przy awarii całej partii.

### 3.3 `src/modules/news/lib/dlugoscStreszczenia.ts` (nowy)

Jedna definicja poziomów dla obu ścieżek — dziś ta sama funkcja stoi w dwóch plikach i to jest
jedna z dwóch przyczyn zgłoszenia 4. Eksportuje `instrukcjaDlugosci(length)`, `maksSlow(length)`,
`czyZaDlugie(tekst, length)` i `LIMIT_MATERIALU` (wspólny pułap znaków materiału dla obu ścieżek —
bez tego sam rozmiar wsadu dalej różnicowałby wynik). Testowalne bez Prismy i bez modelu.

### 3.4 `src/actions/assistantPrefs.ts`

- `getAssistantPrefs` zwraca dodatkowo `autoFacts`.
- `setAutoFacts(enabled: boolean)` — `upsert` po `userId`, `revalidatePath("/settings/asystent")`
  (AC-9).

### 3.5 `src/platform/jobs/handlers/userFacts.ts`

- Payload zyskuje `{ force?: boolean }`. Ręczne „Poszukaj hipotez" woła z `force: true`
  (klik **jest** wyraźną prośbą); przebieg automatyczny bez `force`.
- **Odcisk materiału**: `odciskSygnalow(ownerId)` — liczby pozycji + najświeższe `updatedAt`
  z tabel sygnałowych, zlepione w jeden ciąg. Bez `force` i przy odcisku równym `factsStamp`
  handler kończy z `added: 0` **przed** wywołaniem modelu (AC-6) i tylko bumpuje `factsLastRunAt`.
- **Poszerzone sygnały (AC-4)** — wyłącznie METADANE, nigdy treść:
  `Habit` (nazwy + rytm), `TaskProject` i `ProjectGroup` (nazwy obszarów, **nie** treści zadań),
  `RecipeTag`/`Cookbook` (nazwy), `LanguageDeck` (jakich języków się uczy), `Workshop`
  (nazwa + profil), `UserActivity` (**których modułów faktycznie używa**) — plus trzy dotychczasowe.
  **Świadomie pominięte i wypisane w komentarzu:** treści notatek, `HealthEvent`,
  `MedicationSchedule`, `WalletElement`/`WalletEntry`, `Contact`, `ServiceMessage`, `AiMessage`
  (AC-8). Zakaz kategorii wrażliwych w `SYSTEM` zostaje bez zmian.
- Próg „za mało materiału" liczony **po wszystkich** sygnałach (≥ 5 pozycji łącznie), nie po trzech.
- Na koniec zapis `factsStamp` + `factsLastRunAt`.

**Decyzja o granicy (C-36), świadoma:** handler zostaje w `platform/`, gdzie już jest, i dalej
czyta tabele modułowe przez Prismę. Jego nagłówek uzasadnia to wprost („wnioskuje z działań we
**wszystkich** modułach naraz"), nie ma tu ani jednego importu `@/modules/*`, a wyprowadzanie
kolektora sygnałów do korzenia kompozycji dla jednego handlera byłoby refaktorem poza zakresem
zgłoszenia (C-53). Odnotowane, żeby recenzja widziała, że decyzja jest podjęta, a nie przeoczona.

### 3.6 `src/platform/wiedza/harmonogram.ts` (nowy) — automat (AC-5)

Odwzorowanie `platform/retention/harmonogram.ts`, bo problem jest ten sam (tyknięcie chodzi
w każdej instancji, przebieg ma się odbyć raz):

- `odbierzPrawoDoPrzemiatania(odstepMs = 1h)` — ten sam warunkowy `INSERT … ON CONFLICT DO UPDATE
  … WHERE "Config"."value" < granica` na kluczu `user_facts_last_sweep`. Wariant „odczytaj,
  porównaj, zapisz" przepuszcza dwie instancje naraz.
- `przemiecWiedzeJesliCzas()` — po odebraniu prawa: wybierz **do 20** kont z `autoFacts = true`
  i `factsLastRunAt` starszym niż doba (albo `NULL`), i dla każdego `enqueue("user.facts", {},
  { ownerId, dedupeKey: "user.facts:" + ownerId })`. Dedupe jest tu warunkiem poprawności:
  bez niego wolno chodzące zadanie dostałoby drugie zlecenie przy kolejnym tyknięciu.
- Wpięcie: `src/platform/jobs/worker.ts`, w interwale `okresowe`, obok retencji.
  `OMNIA_ROLE` obsługuje się samo — przemiatanie jedzie tam, gdzie sprzątanie.
- **Bez powiadomień** — hipoteza to nie zdarzenie (decyzja ze speca).

## 4. RBAC / rejestr modułu (C-22)

**Bez zmian.** Żadnego nowego sluga, żadnego nowego modułu, żadnych wpięć w `permissions.ts`,
`modules.tsx` ani `ModuleSidebar`. Wszystkie dotknięte powierzchnie mają już swoje uprawnienia
(`module.news`, `/settings`, `module.admin`). Dostęp do pozycji i tematu rozstrzygają istniejące
guardy — **nie poszerzamy niczyjego dostępu** (C-17/C-21).

## 5. UI (C-30, C-31, C-32, C-33)

### 5.1 Przywracanie przewijania — rama, nie moduł (AC-1..AC-3)

- **`src/platform/nawigacja/przewijanie.ts`** (nowy, czysta logika + pamięć sesji, wzorzec
  `historia.ts`): `zapamietaj(klucz, y)`, `odczytaj(klucz)`, `oznaczPowrot()`, `czyPowrot()`,
  limit ~20 wpisów. **Brak pamięci sesji jest stanem poprawnym**, nie błędem (okno prywatne,
  zablokowane dane witryn, zrzut miniatury) — AC-3.
- **`src/hooks/usePrzywroceniePrzewijania.ts`** (nowy, obok `useViewState`): przyjmuje `ref`
  kontenera i klucz (`pathname + search`).
  - **Zapis:** nasłuch `scroll` na kontenerze, dławiony `requestAnimationFrame`; dodatkowo zapis
    przy zmianie klucza, **zanim** przyjdzie nowa treść.
  - **Powrót wykrywamy przez `popstate`** — jeden nasłuch na okno, ustawia flagę zużywaną przez
    najbliższe przywrócenie. Bez tego przywracalibyśmy pozycję także przy wejściu z odnośnika,
    co łamie AC-2.
  - **Przywracanie:** po malowaniu, z krótkim oknem ponowień (kilka klatek, maks ~1 s), dopóki
    `scrollHeight` nie pozwoli ustawić żądanej pozycji — listy dociągane asynchronicznie nie mają
    swojej wysokości w pierwszej klatce. Po oknie odpuszczamy; skok jest gorszy niż brak skoku.
- **Wpięcie (C-35 — komponent razem z konsumentem):** kontener przewijania w `ModuleView`
  (wewnętrzny `div`, ten od `scrollRef`). Obejmuje to **wszystkie** widoki modułów **oraz `/admin`**
  (panel idzie przez `RamaPanelu` → `ModuleView`), czyli dokładnie miejsce ze zgłoszenia.
  Gdy moduł podał własny `scrollRef`, hook dostaje **ten sam** element — jeden kontener, jeden zapis.
- **Znane ograniczenie, zapisane wprost:** w `layout="fill"` przewija się treść modułu, nie rama,
  więc te widoki (Zadania, Notatki, Zakupy, Pogoda, Magazynowanie) dostaną przywracanie dopiero
  wtedy, gdy przewijanie panelu przejdzie przez ramę. Spec wyłączył to z zakresu.

### 5.2 Proporcje akcji w pasku — poprawka RAMY (AC-13, AC-16)

- `src/components/ui/view/ViewBar.tsx`: zamiast `[&>*]:flex-1` na wszystkich dzieciach —
  **rozciąganie na zgłoszenie**. Rama eksportuje stałą `KLASA_AKCJI_ROZCIAGLIWEJ`
  (`"omnia-akcja-rozciagliwa"`), reguła `.omnia-akcja-rozciagliwa { flex: 1 1 0%; }` poniżej `md`
  ląduje w `globals.css`; wszystko pozostałe dostaje `flex: none` i zajmuje swoje minimum.
  Ikony pomocy i ustawień, rysowane przez ramę, klasy nie dostają **nigdy**.
- To jest poszerzenie kontraktu, nie wyjątek w module (C-33): korzysta z niego każdy widok
  z akcjami, a nie tylko Wiadomości. Cele dotyku zostają ≥ 44 px (C-31).
- `NewsPage`: „Odśwież" dostaje klasę, „Nowy temat" i koło zębate nie. Etykieta „Nowy temat"
  zostaje ukryta poniżej `md` jak dziś (owner: „boczne ikony niech się nie rozciągają").

### 5.3 Zakładki i źródła w Wiadomościach (AC-10..AC-12, AC-17)

- `VIEW_TABS` = **Wiadomości** (`feed`) · **Gorące tematy** (`hot`) · **Oś czasu** (`timeline`).
- `ContentSwitch` **usunięty** wraz z kluczem `tresc` w adresie (AC-11).
- **Zgodność zapisanych widoków (ryzyko ze speca):** `viewSpec.widok` przyjmuje nadal `sources`
  (renderuje zarządzanie źródłami, tyle że nie jako zakładkę), a przy wejściu z **starym**
  `?tresc=timeline` widok normalizuje adres do `?widok=timeline`. Zapisane ulubione prowadzą tam,
  gdzie prowadziły; nikt nie ląduje na pustce.
- **Źródła w pasku nawigacji (AC-17):** panel `SourceFilter` zyskuje stopkę „Zarządzaj źródłami",
  która otwiera `NewsSettings` w `Modal`. Jedna kontrolka na jedno pojęcie („portale"), zarządzanie
  o jedno dotknięcie dalej — zamiast drugiego przycisku obok filtra, który mówiłby to samo słowo.
  Stopka modala respektuje `env(safe-area-inset-bottom)` (C-31, wzorzec 087).

### 5.4 Pasek stanu odświeżania (AC-14, AC-15)

`RefreshStatus`, gałąź `DONE`: jeden krótki wiersz — „Odświeżono: 27 sie, 23:35" — a liczby
(źródeł / nowych / pozycji / faktów) idą do `title` **i** do `aria-label`, więc informacja nie
ginie, tylko przestaje zajmować wiersz. Gałęzie „trwa" i „nie powiodło się" **bez zmian** (AC-15).
`AiCostBadge` zostaje w tym wierszu — jest jednocześnie meldunkiem na szynę kosztów.

### 5.5 Lektor i karta — jeden nośnik treści (AC-24..AC-26)

- `NewsStream` przejmuje stan streszczeń: `nadpisania: Record<itemId, { summary, length,
  summaryFailed }>`, aktualizowany zwrotką z karty.
- `NewsItemCard` staje się **sterowana**: dostaje `summary`/`length`/`summaryFailed` i
  `onZmianaStreszczenia`. Znika jej `useState` na streszczenie — to jest usunięcie drugiego nośnika.
- `readerBlocks` czyta `nadpisania[i.id]?.summary ?? i.summary`, a `nadpisania` wchodzi do
  zależności `useMemo` — nowy tekst dociera do lektora (AC-24).
- **`NewsReader.tsx:261`:** `blocksKey` liczony z tytułów **i treści** bloków. Dziś sam tytuł, więc
  zmiana samego tekstu nie budzi efektu startującego czytanie — to druga, niezależna połowa
  zgłoszenia 5 i bez niej AC-24 nie przechodzi.
- Podświetlanie czytanego zdania trafia w aktualny tekst samo z siebie: dopasowanie idzie po
  TREŚCI, a karta i lektor czytają teraz jeden tekst (AC-26).
- Karta zyskuje **„Wygeneruj ponownie"** (AC-20) — osobny, wyraźnie odróżniony od przełącznika
  poziomu — oraz **„Spróbuj ponownie"** przy `summaryFailed` (AC-22). Tekst wzięty z memory
  (`fromMemory`) pojawia się natychmiast i **bez** wskaźnika kosztu, bo nic nie kosztował.

### 5.6 Ustawienia asystenta (AC-9)

`/settings/asystent`, sekcja „Wiedza o Tobie": przełącznik „Sam szukaj hipotez z mojej aktywności"
nad przyciskiem „Poszukaj hipotez", z jednozdaniowym opisem, co system czyta, a czego nie czyta.

### 5.7 Teksty (C-32)

Wszystkie nowe teksty widoczne dla użytkownika → `messages/pl.json` pod przestrzenią wywiedzioną
ze ścieżki pliku, czytane przez `useTranslations`. Zero literałów w komponentach —
`npm run check:i18n` jest od 097 regułą bezwzględną, nie zapadką. Kolory wyłącznie zmiennymi CSS
(C-30); nowe przyciski nie wprowadzają hexów.

## 6. AI / integracje (C-23, C-40)

- **Żadnej nowej `AIAction`** i żadnego read-toola → `check:actions` nie ma nowej pracy (C-23).
- Routing modeli bez zmian, dalej per typ operacji (`generation` dla streszczeń, `reasoning` dla
  wnioskowania) — zero hardcodowanego dostawcy i modelu (C-40).
- `check:cost-badge`: `news.ts` i `newsRefresh.ts` już przekazują zużycie i tak zostaje.
  Ścieżka „z pamięci" zwraca `usage: undefined` — brak kosztu, bo koszt nie powstał.
- `check:content-memory`: klasyfikacja `news.ts` pozostaje **`on-demand`** (wywołanie dzieje się na
  klik), ale **uzasadnienie w manifeście trzeba przepisać** — dotychczasowe mówi „pamięć zwróciłaby
  nie to, o co użytkownik poprosił", a po tej zmianie pamięć jest **per poziom**, więc zwraca
  dokładnie to, o co poproszono. Uzasadnienie niezgodne z kodem to rozjazd artefaktu (C-54).
- Kalendarz / powiadomienia / trash: nie dotyczy.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` | edycja | `NewsItemSummary`, trzy pola w `AssistantPref`, relacja w `NewsItem` |
| `prisma/migrations/0269_streszczenia_per_poziom_i_automat_wiedzy/migration.sql` | nowy | DDL + przeniesienie bieżących streszczeń (C-10) |
| `src/platform/nawigacja/przewijanie.ts` | nowy | czysta logika pamięci pozycji przewijania |
| `src/platform/nawigacja/__tests__/przewijanie.test.ts` | nowy | limit, brak pamięci, klucz, flaga powrotu |
| `src/hooks/usePrzywroceniePrzewijania.ts` | nowy | zapis/odtworzenie na kontenerze ramy |
| `src/components/ui/view/ModuleView.tsx` | edycja | wpięcie hooka w kontener przewijania (C-35) |
| `src/components/ui/view/ViewBar.tsx` | edycja | rozciąganie akcji na zgłoszenie zamiast na wszystkie |
| `src/app/globals.css` | edycja | reguła `.omnia-akcja-rozciagliwa` poniżej `md` |
| `src/modules/news/lib/dlugoscStreszczenia.ts` | nowy | JEDNA definicja poziomów dla obu ścieżek |
| `src/modules/news/lib/__tests__/dlugoscStreszczenia.test.ts` | nowy | pułapy słów, wykrywanie zbyt długiego wyniku |
| `src/modules/news/actions/news.ts` | edycja | `resummarizeItem` z pamięcią per poziom, `force`, materiał źródłowy |
| `src/modules/news/jobs/newsRefresh.ts` | edycja | dociąganie artykułu przy ubogim skrócie, zapis per poziom, twardsze „nie udało się" |
| `src/modules/news/ui/NewsPage.tsx` | edycja | trzy zakładki, brak `ContentSwitch`, zgodność starych adresów, krótki pasek stanu, klasa rozciągania |
| `src/modules/news/ui/NewsStream.tsx` | edycja | nadpisania streszczeń = jeden nośnik dla karty i lektora |
| `src/modules/news/ui/NewsItemCard.tsx` | edycja | karta sterowana, „Wygeneruj ponownie", „Spróbuj ponownie" |
| `src/modules/news/ui/NewsReader.tsx` | edycja | `blocksKey` z treści, nie z samych tytułów |
| `src/modules/news/ui/SourceFilter.tsx` | edycja | stopka „Zarządzaj źródłami" |
| `src/platform/jobs/handlers/userFacts.ts` | edycja | szersze sygnały, odcisk materiału, `force` |
| `src/platform/wiedza/harmonogram.ts` | nowy | atomowe przemiatanie + kolejkowanie per konto |
| `src/platform/wiedza/__tests__/harmonogram.test.ts` | nowy | prawo do przebiegu odbierane raz |
| `src/platform/jobs/worker.ts` | edycja | wpięcie przemiatania w interwał okresowy |
| `src/actions/assistantPrefs.ts` | edycja | `autoFacts` w odczycie + `setAutoFacts` |
| `src/components/settings/UserFactsSection.tsx` | edycja | przełącznik automatu, `force: true` przy kliknięciu |
| `messages/pl.json` | edycja | wszystkie nowe teksty (C-32) |
| `src/lib/ai/content-memory-coverage.json` | edycja | uzasadnienie zgodne z nowym zachowaniem |
| `doświadczenia.md` | edycja | wpis o pięciu zgłoszeniach (C-51) |

## 8. Bramki i weryfikacja (C-50)

**Lokalnie, nigdy przeciw produkcji (C-13):** lokalny Postgres 16 (`pg_ctlcluster 16 main start`),
`.env.local` + eksport `DATABASE_URL`/`DIRECT_URL` na `127.0.0.1:5432`, `npx prisma migrate deploy`.
Weryfikacja **do kroku `next build`** — ostatni krok `npm run build` (`migrate.js`) rusza prod DB.

Bramki do przejścia: `check:migrations`, `check:schema-drift`, `check:actions`, `check:ai-coverage`,
`check:cost-badge`, `check:content-memory`, `check:ui-contract`, `check:boundaries`,
`check:module-registry`, `check:owner-columns`, `check:pagination` (nowe `findMany` w handlerze
sygnałów **muszą** mieć `take`), `check:logs`, `check:i18n`, `check:client-safe`, `check:tailwind`,
`tsc -p tsconfig.test.json`, `next lint`, `next build`, `check:perf`.

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1, AC-2 | Klikacz e2e: przewiń listę → wejdź w element → `goBack()` → `scrollTop` ≈ zapisany; osobno wejście z odnośnika → `scrollTop === 0`. **Bez `networkidle`** (`check:e2e-waits`) |
| AC-3 | Test jednostkowy `przewijanie.test.ts` z `sessionStorage` rzucającym przy dostępie |
| AC-4, AC-8 | Przegląd kodu handlera: lista czytanych tabel = lista ze specu; brak zapytań do notatek/zdrowia/finansów/kontaktów |
| AC-5 | Test `harmonogram.test.ts`: 5 równoległych wywołań → prawo odbiera dokładnie jedno |
| AC-6 | Test handlera: równy `factsStamp` i brak `force` → `added: 0` i **zero** wywołań modelu (atrapa) |
| AC-7 | Zachowanie niezmienione — regresja sprawdzona ręcznie na `/settings/asystent` |
| AC-9 | `autoFacts=false` → przemiatanie pomija konto (test na selektorze zapytania) |
| AC-10..AC-12 | Klikacz: trzy zakładki widoczne, brak przełącznika treści, wejście ze starym `?tresc=timeline` ląduje na osi czasu |
| AC-13 | Klikacz przy 360 px: szerokość „Odśwież" > suma szerokości obu ikon; ikony ≤ ~56 px |
| AC-14, AC-15 | Klikacz: po udanym przebiegu jeden wiersz z czasem, liczby w `title`; stan „trwa"/„błąd" nietknięty |
| AC-16 | Klikacz przy 360 px: `document.scrollWidth <= clientWidth`, każdy cel dotyku ≥ 44 px |
| AC-17 | Klikacz: panel filtra portali → „Zarządzaj źródłami" → lista źródeł |
| AC-18 | Test akcji: drugie wywołanie tego samego poziomu → identyczny tekst, atrapa modelu **nie** wołana |
| AC-19 | Test akcji: przy nieudanym pobraniu artykułu materiałem jest `NewsArticle.description`, **nigdy** `item.summary` |
| AC-20 | Test akcji: `force: true` woła model i nadpisuje zapamiętany wiersz |
| AC-21 | Test `newsRefresh`: pozycja z pustym skrótem → doszło pobranie artykułu; limit 12 respektowany |
| AC-22 | Klikacz: pozycja z `summaryFailed` pokazuje komunikat i działającą akcję ponowienia |
| AC-23 | Test `dlugoscStreszczenia`: pułapy słów; test akcji: wynik ponad pułap wywołuje jedną korektę |
| AC-24..AC-26 | Test jednostkowy `blocksKey` (zmiana treści przy tym samym tytule zmienia klucz) + klikacz: zmiana poziomu przy grającym lektorze |

## 9. Ryzyka techniczne i plan wycofania

- **Przywracanie walczy z resetem przewijania Nexta** → przywracamy w efekcie po malowaniu
  (`requestAnimationFrame`), czyli **po** resecie; okno ponowień zamyka się po ~1 s, więc najgorszy
  możliwy wynik to brak przywrócenia, nigdy skok w trakcie czytania.
- **Zapis pozycji przy każdym `scroll`** to najczęstsze zdarzenie w aplikacji → dławienie klatką
  i zapis do pamięci sesji (nie do bazy). Zero zapytań do serwera.
- **Migracja przenosi bieżące streszczenia** — gdyby `INSERT … SELECT` pominął pozycje, pierwsze
  przełączenie poziomu wygenerowałoby tekst od nowa (koszt, nie utrata). `ON CONFLICT DO NOTHING`
  czyni ją idempotentną.
- **Dociąganie artykułów w przebiegu** to nowe żądania HTTP → wyłącznie dla pozycji z ubogim
  skrótem, twardy limit 12 na przebieg, błąd pobrania nie przerywa etapu.
- **Automat generuje koszt bez decyzji użytkownika** → potrójne zabezpieczenie: wyłącznik (AC-9),
  odcisk materiału (AC-6), doba odstępu i partia maks. 20 kont na przemiecenie.
- **Przebudowa zakładek psuje ulubione** → stary klucz `tresc` normalizowany, `widok=sources` nadal
  obsługiwany. To jest w klikaczu, nie w obietnicy.
- **Wycofanie:** kod — rewert commitów feature'a; ta zmiana jest **addytywna w bazie**
  (nowa tabela, trzy nowe kolumny z domyślnymi), więc stary kod działa na nowym schemacie i sam
  rewert kodu wystarcza. Migracji nie cofamy (runbook `docs/devops/runbook-deploy-rollback.md`).

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-15** — ręczny plik migracji `0269`, numer z `next:migration`, `String`+union zamiast
      enuma, DDL pisany ręcznie (nie z `migrate diff`), weryfikacja tylko na lokalnym Postgresie.
- [x] **C-17, C-21** — guardy dostępu bez zmian; **niczyj dostęp się nie poszerza**, więc tabela
      prawdy nie jest potrzebna (i to jest odnotowane, a nie pominięte).
- [x] **C-20** — każda mutacja to Server Action z `revalidatePath` na końcu.
- [x] **C-22** — bez nowego sluga i bez nowych wpięć rejestru.
- [x] **C-23, C-40** — zero nowych `AIAction`; routing modeli dalej z bazy.
- [x] **C-30, C-31, C-32** — kolory tylko zmiennymi CSS, 360 px bez poziomego przewijania, cele
      dotyku ≥ 44 px, `safe-area-inset-bottom` w stopce modala, teksty w `messages/pl.json`.
- [x] **C-33, C-35** — proporcje akcji naprawiane w **ramie** (poszerzenie kontraktu), przywracanie
      przewijania dowiezione **razem z konsumentem** (`ModuleView`), stany brzegowe dalej przez `state`.
- [x] **C-34** — nowe akcje nie usuwają danych, więc nie wprowadzają potwierdzeń; istniejące
      `confirmDialog` nietknięte.
- [x] **C-36** — nowy kod platformy nie importuje `@/modules/*`; decyzja o pozostawieniu
      `userFacts.ts` w platformie jest **jawnie uzasadniona** w §3.5, a nie przemilczana.
- [x] **C-51** — wpis do `doświadczenia.md` razem z poprawką.
- [x] **C-52, C-52a** — merge do `develop`, promocja `--ff-only` + tag `prod-111-*`.
- [x] **C-53** — minimalizm sprawdzony świadomie: brak nowych zależności, brak refaktoru granic
      modułów „przy okazji", jedna akcja zamiast dwóch, jedna definicja długości zamiast dwóch.
