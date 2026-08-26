# Plan techniczny: Ergonomia asystenta AI — chrom, sesje i tryb dokowania

- **Spec:** ./spec.md (106-ergonomia-asystenta)
- **Status:** draft
- **Data:** 2026-08-26

## 1. Podejście

Cała zmiana mieści się w **powłoce asystenta** — jednym komponencie (`AICommandSheet`), jednej
akcji preferencji, jednej akcji rozmów i jednej strukturalnej poprawce w `AppShell`. **Nie
wprowadzamy żadnego nowego wspólnego komponentu**: trzy z czterech zgłoszeń rozwiązują komponenty,
które Omnia już ma i które powstały dokładnie na te wady:

- **`AnchoredLayer`** (`components/ui/AnchoredLayer.tsx`, przebieg 080) — portal do `body`,
  automatyczne odbicie strony przy braku miejsca, ograniczenie `maxHeight` do okna, `Esc`
  i kliknięcie poza obszarem obsłużone raz. Jego komentarz wprost wymienia przypadek ze zgłoszenia 2
  (zaszyte `bottom: calc(100% + 6px)` = zawsze w górę, więc przy krawędzi panel wychodzi poza ekran).
  To jest wzorzec do naśladowania dla **menu poziomu pracy** i dla **nowego menu ⋮**.
- **`PrzelacznikSegmentowy`** (`components/ui/nav/`, przebieg 100) — segmenty z licznikami, segment
  z zerem **widoczny, ale wyłączony**. Właściciel w 100 odrzucił chowanie list pod ⋮ dokładnie
  z powodu, który wróciłby tutaj przy zakładkach robionych ręcznie. To wzorzec dla przełącznika
  **„Zapisane | Historia"**.
- **`confirmDialog`** (`ConfirmProvider`) — dla usuwania rozmowy (C-34).

Nowe są tylko: dwie kolumny w bazie, jedna akcja serwerowa, i **jedno przesunięcie w drzewie
`AppShell`**, dzięki któremu asystent może przykryć obszar treści, nie ruszając nawigacji.

## 2. Model danych (Prisma)

Dwie kolumny na istniejących tabelach. Bez nowych modeli i bez nowej tabeli — decyzja właściciela
(„osobna lista Zapisane") jest **sposobem pokazania** jednej flagi, nie nowym bytem (C-53).

- **`AiConversation`** — `saved Boolean @default(false)`
  „Czy rozmowa jest na liście Zapisane". Nazwa angielska, spójnie z sąsiadami w tej tabeli
  (`draft`, `summary`, `title`).
  Nowy indeks `@@index([userId, saved, updatedAt])` — obie listy czyta się osobnym zapytaniem po
  tych trzech kolumnach; istniejący `@@index([userId, updatedAt])` zostaje (czyta go
  `getAiConversation`/`appendAiMessage`).
- **`AssistantPref`** — `presentation String @default("window")`
  Sposób prezentacji asystenta na komputerze. **`String` + union TS** (C-12):
  `type AssistantPresentation = "window" | "content"`, typ przy `AssistantLevel`/`AssistantVoiceKind`
  w `src/lib/ai/assistantLevels.ts` (albo tam, gdzie te dwa dziś żyją — implementacja sprawdza).
  Wartość domyślna `"window"` **odtwarza dzisiejsze zachowanie** — nikt, kto nic nie ustawi, nie
  zobaczy zmiany (AC-13 w duchu, AC-18 wprost).

**Migracja (C-10, C-11):**
- Numer z `npm run next:migration`: **0267** (sprawdzony).
- Katalog: `prisma/migrations/0267_asystent_zapisane_i_prezentacja/migration.sql`
- DDL, idempotentnie:
  ```sql
  ALTER TABLE "AiConversation" ADD COLUMN IF NOT EXISTS "saved" BOOLEAN NOT NULL DEFAULT false;
  CREATE INDEX IF NOT EXISTS "AiConversation_userId_saved_updatedAt_idx"
    ON "AiConversation" ("userId", "saved", "updatedAt");
  ALTER TABLE "AssistantPref" ADD COLUMN IF NOT EXISTS "presentation" TEXT NOT NULL DEFAULT 'window';
  ```
  **Ręcznie pisany plik, nie wyjście `migrate diff`** (C-15): diff „doprowadza bazę do schematu"
  i zaproponowałby skasowanie tego, co żyje wyłącznie w surowym SQL-u (indeksy `pg_trgm`).
  Po napisaniu: `grep -E "^(DROP|ALTER TABLE .* DROP)" migration.sql` musi być puste.
- `schema.prisma` aktualizujemy **razem** z plikiem migracji — inaczej `check:schema-drift`
  (w `build`) wywali się na rozjeździe.
- Wsteczna zgodność (AC-13): `DEFAULT false` sprawia, że wszystkie istniejące rozmowy trafiają na
  listę **Historia**, a lista **Zapisane** startuje pusta. Nic nie znika.

## 3. Warstwa serwera (Server Actions — C-20)

**`src/actions/aiConversations.ts`**

- `listAiConversations()` — **zmiana kształtu zwrotki** na
  `{ zapisane: ConversationMeta[]; historia: ConversationMeta[] }`.
  Dwa zapytania, każde z **jawnym `take`** (bramka `check:pagination` jest od 096 regułą
  bezwzględną — każde `findMany` ma mieć ograniczenie):
  - `zapisane`: `where: { userId, saved: true }`, `orderBy: { updatedAt: "desc" }`, `take: 50`
  - `historia`: `where: { userId, saved: false }`, `orderBy: { updatedAt: "desc" }`, `take: 50`
  **Dlaczego dwa zapytania, a nie jedno z podziałem po stronie klienta:** dzisiejsze `take: 50`
  bierze 50 **najnowszych w ogóle**, więc rozmowa zapisana pół roku temu wypadłaby z wyniku —
  czyli dokładnie ta wada, którą feature usuwa. To jest sedno AC-8 i miary sukcesu ze speca.
  `ConversationMeta` zyskuje pole `saved: boolean` (przyda się przy oznaczaniu wiersza na liście).
  Konsumenci: przed zmianą `grep -rn "listAiConversations" src/` — dziś jedynym jest
  `AICommandSheet`; jeśli implementacja znajdzie inny, aktualizujemy go w tym samym kroku.
- **`setAiConversationSaved(id: string, saved: boolean): Promise<void>`** — nowa.
  Wzorzec **jeden do jednego** z sąsiadującym `renameAiConversation`:
  ```ts
  const user = await requireAuth();
  await prisma.aiConversation.updateMany({ where: { id, userId: user.id }, data: { saved } });
  revalidatePath("/");
  ```
  `updateMany` z `userId` w `where` **jest** guardem własności (wzorzec z `renameAiConversation`
  i `deleteAiConversation`): cudza rozmowa nie pasuje do filtra, więc operacja jest niewykonalna,
  a nie „wykonalna i sprawdzana osobno".

**`src/actions/assistantPrefs.ts`**

- `AssistantPrefsDTO` + `AssistantPrefsInput` + `DEFAULT` rosną o `presentation`.
- `updateAssistantPrefs` — dopisujemy gałąź walidującą wartość do unii (wzorzec istniejącej
  walidacji `level`/`voiceKind` w tym pliku): wartość spoza `("window" | "content")` jest
  **ignorowana**, nie zapisywana. `revalidatePath("/")` już tam jest.

**Własność danych (C-21):** obie tabele są per-użytkownik (`userId`), bez `ownerId`/`ownerTeamId`
i bez `workspaceId` — asystent nie ma własności zespołowej. Nie dokładamy jej i nie ruszamy
`platform/workspaces`. Bramka `check:owner-columns` (098) zostaje spełniona przez to, że nowe
zapytania nie sięgają po żadną kolumnę własnościową.

**Kontrola dostępu / manifesty (`check:ai-coverage`, `check:actions`):** `setAiConversationSaved`
to nowa Server Action, więc **wymaga wpisu w `src/lib/ai/action-coverage.json`**: klasyfikacja
ekspozycji AI = **`excluded`** z powodem („czynność człowieka w interfejsie — asystent nie zarządza
własną historią"), `access: "self"`, guard = filtr `userId` w `updateMany`. Wzorzec do skopiowania:
wpisy istniejących `renameAiConversation` / `deleteAiConversation` / `saveConversationDraft` w tym
samym manifeście. **Nie powstaje żadna nowa `AIAction`**, więc `check:actions` nie ma nowej pracy.

## 4. RBAC / rejestr modułu (C-22)

**Bez zmian.** Asystent to chrom powłoki dostępny dla każdej zalogowanej osoby — nie jest modułem,
nie ma trasy, nie ma slugu `module.*`, nie ma wpisu w `modules.tsx` ani w `ModuleSidebar`.
Jedyny warunek uprawnieniowy, jakiego dotykamy, to `isAdmin` przy `PrzelacznikTrybuAdmina`
przenoszonym do menu ⋮ — warunek zostaje **dosłownie ten sam** (`isAdmin` jest już propem
`AICommandSheet`), zmienia się wyłącznie miejsce rysowania. Poszerzenie czyjegokolwiek dostępu
„przy okazji" jest zakazane (C-17).

## 5. UI (C-30, C-31, C-32)

Wszystko dzieje się w `src/components/assistant/AICommandSheet.tsx` + jedna zmiana strukturalna
w `src/components/shell/AppShell.tsx`.

### 5.1 Górny pasek — pierwszy plan / drugi plan (AC-1…AC-4)

Dziś pasek trzyma osiem rzeczy w jednym rzędzie. Po zmianie:

| Strefa | Zawartość | Uwaga |
|---|---|---|
| lewa | ikona Sparkles, nazwa „Asystent AI", **znacznik `auto`** | `minWidth: 0` + `textOverflow: ellipsis` na nazwie — nazwa ustępuje pierwsza |
| prawa | **Nowa rozmowa**, **Historia**, **⋮**, **Dokowanie** (`lg:` wzwyż), **Zamknij** | stały porządek, nic się nie przestawia |

- **Znacznik `auto` zostaje w PASKU, nie w ⋮** — i to jest świadome. Lekcja z przebiegu 100:
  menu nie mówi ani co jest dostępne, ani co jest wybrane, więc pod ⋮ idą **wyłącznie czynności**,
  nigdy wskaźniki stanu. Tryb automatyczny wykonuje akcje bez pytania — nie może działać po cichu.
  Responsywność (AC-2): poniżej `sm` renderujemy samą ikonę ⚡ (`aria-label` + `title` niosą pełną
  treść), od `sm` wraca tekst „auto". Realizacja przez klasę Tailwinda `hidden sm:inline` na
  `<span>` z tekstem — **nie** przez warunek w JS na szerokość okna (to drugie miga po hydratacji).
- **Menu ⋮** = `AnchoredLayer` (`role="menu"`, `side="dol"`, `align="end"`), kotwiczone do własnego
  przycisku. Zawartość, w kolejności:
  1. **Akcje bieżącej rozmowy** (decyzja właściciela — tu, nie przy kompozytorze):
     „Zapisz rozmowę" / „Usuń z zapisanych" (etykieta zależna od stanu), „Zmień nazwę", „Usuń
     rozmowę". Wyłączone (`disabled`), gdy rozmowa jest pusta (`turns.length === 0` lub brak
     `conversationId`) — nie ma czego zapisywać ani nazywać (założenie ze speca).
  2. separator
  3. **Ustawienia asystenta** (`togglePanel("prefs")`), **Zgłoś problem** (`togglePanel("report")`),
     **Przełącznik trybu administratora** (`<PrzelacznikTrybuAdmina />`, tylko `isAdmin`).
  Pozycje z pkt. 3 wywołują dotychczasowe `togglePanel(...)` i **zamykają menu** — panele
  otwierają się tam, gdzie dotąd (w miejscu wątku), więc reszta zachowania jest nietknięta.
- **`Esc` (AC-4):** nic nie trzeba pisać — `AnchoredLayer` łapie `Escape` w fazie **capture**
  i robi `stopPropagation`, a własny handler asystenta wisi na `window` w fazie bąbelkowania.
  Menu zamknie się samo, arkusz zostanie otwarty. **To trzeba potwierdzić w `/verify`**, bo
  zależy od kolejności faz, a nie od naszego kodu.
- **Cele dotyku (C-31, AC-1):** `iconBtn` w tym pliku ma dziś `padding: 6` (≈28 px). Dla przycisków
  paska wprowadzamy wariant z `minWidth: 44, minHeight: 44, justifyContent: "center"`. Rachunek
  szerokości przy 360 px: lewa strefa ≈ 130 px (ikona + nazwa + ikona `auto`), prawa 4 × 44 = 176 px,
  wypełnienie `px-5` = 40 px → **346 px < 360 px**, a nazwa i tak ma ellipsis jako zabezpieczenie.
  Przycisk dokowania jest `lg:` wzwyż, więc w tym rachunku nie występuje.

### 5.2 Menu poziomu pracy (AC-5…AC-7)

Podmieniamy ręczny `position: absolute; bottom: calc(100% + 6px)` na **`AnchoredLayer`**
(`role="menu"`, `side="gora"`, `align="end"`, `width` ≈ 280), kotwiczony do przycisku poziomu.
Co to załatwia, punkt po punkcie:

- **AC-5** — portal do `body` znosi przycięcie przez przodka z `overflow: hidden` (arkusz asystenta
  ma `overflow: hidden` w stylu wprost) **i** wyjście poza obrys arkusza.
- **AC-6** — `obliczPozycje` odbija panel na drugą stronę przy braku miejsca i zwraca `maxHeight`;
  `AnchoredLayer` ustawia je razem z przewijaniem wewnętrznym. Przy oknie 600 px menu przewinie
  się w sobie, zamiast wyjść poza ekran.
- **AC-7** — **treść menu przenosimy bez zmian**: te same `ASSISTANT_LEVELS`, ten sam
  `changeLevel`, ta sama ikona `SlidersHorizontal` przy „Własnym", ten sam przełącznik
  auto-zatwierdzania na dole z tym samym `toggleAutoApprove`. Zmienia się **wyłącznie** pojemnik.
  Stan `showLevelMenu` zostaje (steruje propem `open`); gałąź `if (showLevelMenu)` w handlerze `Esc`
  asystenta **usuwamy**, bo `Esc` obsługuje teraz warstwa.

### 5.3 Zapisane / Historia (AC-8…AC-13)

- Szuflada historii (`headerPanel === "history"`) dostaje **nad listą** `PrzelacznikSegmentowy`
  z dwoma segmentami: `zapisane` („Zapisane", licznik) i `historia` („Historia", licznik).
  **Oba segmenty przekazują `wylaczona: false` jawnie.** Domyślnie komponent wyłącza segment
  o liczniku 0 (widoczny, ale nieklikalny) — i to jest dobra reguła dla list, których pustka
  niczego nie uczy. Tutaj jest odwrotnie: AC-11 wymaga, żeby pusta lista zapisanych **dała się
  otworzyć** i sama wyjaśniła, jak coś na nią trafia. Osoba, która nigdy nic nie zapisała, to
  dokładnie ta, która tego wyjaśnienia potrzebuje, więc zablokowanie jej wejścia zamykałoby
  jedyne miejsce z instrukcją. Segment zostaje więc widoczny **i** klikalny, a licznik `0`
  nadal mówi prawdę o zawartości.
- Domyślnie wybrany segment: **`historia`** (założenie ze speca — zachowuje dzisiejsze zachowanie
  dla kogoś, kto nic nie zapisał). Wybór trzymamy w `useState` w komponencie; **nie** utrwalamy go
  — to stan sesji, nie preferencja.
- **Stan pusty (AC-11):** dla listy zapisanych własny tekst wyjaśniający, jak zapisać rozmowę
  („Zapisz rozmowę z menu ⋮ w nagłówku"), dla historii zostaje dzisiejszy komunikat. Asystent nie
  jest widokiem modułu, więc **nie** przechodzi przez prop `state` w `ModuleView` (C-33 nie
  dotyczy — patrz §5.5) i rysuje ten stan tak, jak dziś rysuje `brakZapisanychRozmow`.
- Wiersz listy zostaje jak jest (tytuł, zmiana nazwy, usunięcie) i dostaje **ikonę zapisania**
  (`Bookmark` / `BookmarkX`) przełączającą `setAiConversationSaved` — AC-10 wymaga odwracalności,
  a odwracać wygodnie z tego miejsca, w którym się patrzy na listę. Po przełączeniu wiersz
  przenosi się między listami; źródło prawdy to **jedno pole `saved`**, więc liczniki nie mają jak
  się rozjechać (ryzyko ze speca).
- **Usuwanie przez `confirmDialog` (C-34, AC-12).** Dziś `removeConversation` kasuje **bez
  potwierdzenia** — to jest naruszenie C-34 zastane w kodzie i naprawiamy je przy okazji
  wystawienia tej akcji w menu ⋮ (ta sama akcja w dwóch miejscach nie może mieć dwóch zachowań):
  `if (!(await confirmDialog({ title: …, destructive: true }))) return;`.
- Po zapisaniu/odznaczeniu odświeżamy listy przez ponowne `listAiConversations()` — tą samą drogą,
  którą komponent odświeża je dziś.

### 5.4 Asystent w obszarze treści (AC-14…AC-20)

Warunek brzegowy z odpowiedzi właściciela: **„główna treść ma zostać tylko ukryta, więc nie
zmieniamy URL. Kontekst dla asystenta powinien być dostępny."** Stąd wynika sposób realizacji —
i stąd wynika, czego robić NIE wolno.

- **Nie ma nowej trasy, nie ma `router.push`, nie ma `pathname` innego niż moduł.** Asystent jest
  już zamontowany w powłoce na każdej stronie, więc kontekst bieżącej strony (AC-16) jest dostępny
  **dlatego, że nic nie nawigujemy** — nie trzeba go nigdzie przekazywać na nowo.
- **Treść jest PRZYKRYTA, nie odmontowana i nie `display: none`.** To najważniejsza decyzja
  techniczna tego planu:
  - odmontowanie kasuje stan modułu (AC-15 wprost tego zabrania),
  - `display: none` **niszczy pudełko układu**, a razem z nim pozycję przewijania kontenera —
    moduł wróciłby przewinięty na górę, czyli AC-15 padłoby po cichu, w sposób trudny do
    zauważenia w kodzie.
  Dlatego asystent w tym trybie renderuje się jako **warstwa `position: absolute; inset: 0`
  wewnątrz obszaru treści**. `<main>` zostaje w układzie, z nienaruszonym `scrollTop`.
- **Zmiana strukturalna w `AppShell`** (jedyna): `<main>` i `<AICommandSheet>` trafiają do wspólnego
  opakowania, które daje warstwie układ odniesienia:
  ```jsx
  <div className="relative flex flex-1 min-w-0">
    <main ref={mainRef} className="flex-1 overflow-hidden flex flex-col min-w-0 pb-16 md:pb-0">
      {children}
    </main>
    <AICommandSheet isAdmin={isAdmin} usdPlnRate={usdPlnRate} onPrzykrycie={setPrzykryte} />
  </div>
  ```
  Opakowanie przejmuje `flex-1 min-w-0` od `<main>`, więc układ (sidebar | treść) jest
  **równoważny**. Opakowanie **nie może** dostać `transform`, `filter` ani `contain` — to jedyne
  własności, które zmieniłyby układ odniesienia dla `position: fixed` i zepsuły tryb okna oraz
  arkusz na telefonie.
- **Warunki włączenia:** `presentation === "content"` **i** szeroki ekran. Szerokość czytamy
  hookiem `useIsWideScreen()` (`min-width: 1024px`), dopisanym obok istniejącego
  `useIsNarrowScreen` w `src/hooks/useVisualViewport.ts` — ten sam wzorzec `matchMedia`
  + `addEventListener("change")`. **AC-18:** poniżej `lg` warunek jest fałszywy, więc telefon
  i wąski ekran dostają dokładnie dzisiejszy arkusz, niezależnie od zapisanej preferencji.
- **Różnice panelu w trybie treści** względem trybu okna: brak przyciemnionego tła i brak
  `onClick` zamykającego na tle (nie ma tła), `position: absolute; inset: 0`, `borderRadius: 0`,
  `role="region"` + `aria-label` zamiast `role="dialog" aria-modal="true"` — bo to **nie jest**
  modal: nawigacja obok pozostaje używalna (AC-20) i wołanie tego dialogiem modalnym byłoby
  kłamstwem wobec czytnika ekranu.
- **Ukryta treść musi być NIEDOSTĘPNA, nie tylko niewidoczna** (ryzyko ze speca: uwięziony fokus,
  czytnik ekranu czytający spod spodu, skróty modułu łapiące klawisze). `AppShell` trzyma stan
  `przykryte` (ustawiany przez `onPrzykrycie` z asystenta: „jestem otwarty w trybie treści") i
  w efekcie ustawia na `mainRef.current` atrybuty **`inert`** oraz `aria-hidden="true"`, zdejmując
  je przy wyjściu. Atrybuty ustawiamy **przez `ref` w `useEffect`**, nie propem JSX: React 18 nie
  zna propa `inert` i zignorowałby go albo ostrzegł — to jest dokładnie rodzaj cichej porażki,
  którą `/verify` musi sprawdzić na żywym drzewie DOM, a nie w kodzie.
- **Przełącznik trybu** — ikona w prawej strefie paska, widoczna od `lg` (`hidden lg:flex`),
  `aria-pressed` (ten sam wzorzec co slot `settings` z 087: jeden przycisk wchodzi i wychodzi
  ze stanu). Zapis przez `updateAssistantPrefs({ presentation })`, odczyt razem z resztą
  preferencji przy otwarciu (AC-17 — preferencja jest na koncie, więc wraca na innym urządzeniu).
  **AC-19** trzyma się na dwóch, zawsze widocznych wyjściach: ten przełącznik **i** „Zamknij".
  Świadomie nie chowamy żadnego z nich pod ⋮.

### 5.5 Reguły przekrojowe

- **C-30 (motyw):** wszystkie nowe elementy biorą kolory ze zmiennych CSS (`--bg-surface`,
  `--border`, `--text-*`, `--accent-*`). Żadnych hexów — `check:ui-contract` sprawdza to w
  `src/components` (a właśnie tam pracujemy).
- **C-32 (teksty):** każdy nowy napis → `messages/pl.json`, przestrzeń
  `components.assistant.AICommandSheet` (komponent już czyta `useTranslations` z tej przestrzeni).
  Bramka `check:i18n` jest od 097 **regułą bezwzględną** i sprawdza dodatkowo, czy każde `t("klucz")`
  ma wpis — więc klucz bez wartości też wywali build. Dotyczy m.in.: „Więcej", „Zapisz rozmowę",
  „Usuń z zapisanych", „Zmień nazwę", „Usuń rozmowę", „Zapisane", „Historia", „Pokaż w obszarze
  treści", „Pokaż w oknie", stan pusty listy zapisanych, tekst potwierdzenia usunięcia.
- **C-33:** asystent **nie jest widokiem modułu** i nie rysuje `ModuleView` — dlatego nie dotyczy
  go prop `state` ani manifest `view-contract.json`. Tryb treści **niczego nie zmienia w ramie
  modułu**: `ModuleView` pod spodem renderuje się dalej tak samo, jest tylko przykryty. To jest
  test na to, czy zmiana nie łamie kontraktu widoku — gdyby wymagała zmian w `ModuleView`,
  byłaby zaprojektowana źle.
- **C-53:** zero nowych zależności, zero nowych wspólnych komponentów, jeden nowy hook (4 linie,
  obok bliźniaka w tym samym pliku), jedna nowa akcja serwerowa.

## 6. AI / integracje (C-23, C-40)

- **Brak nowych `AIAction`** i **brak nowych read-toolów.** Zapisanie rozmowy jest czynnością
  człowieka w interfejsie — asystent nie zarządza własną historią. `check:actions` nie ma nowej
  pracy; `check:ai-coverage` wymaga tylko wpisu manifestowego z §3.
- Routing modeli (C-40), koszty, streaming, lektor — **nietknięte**. Menu poziomu pracy zmienia
  pojemnik, nie działanie: `changeLevel` i `toggleAutoApprove` zostają dosłownie te same.
- Kalendarz / powiadomienia / kosz — nie dotyczy. Usunięcie rozmowy zachowuje dzisiejsze
  zachowanie (rozmowy asystenta nie idą do `TrashItem`); zmieniamy miejsce akcji i dokładamy
  potwierdzenie, nie skutek.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/migrations/0267_asystent_zapisane_i_prezentacja/migration.sql` | nowy | `AiConversation.saved` + indeks, `AssistantPref.presentation` (C-10) |
| `prisma/schema.prisma` | edycja | te same dwie kolumny + `@@index` — inaczej `check:schema-drift` |
| `src/actions/aiConversations.ts` | edycja | `listAiConversations` → `{ zapisane, historia }`, nowa `setAiConversationSaved` |
| `src/actions/assistantPrefs.ts` | edycja | `presentation` w DTO/input/domyślnych + walidacja unii |
| `src/lib/ai/action-coverage.json` | edycja | wpis dla `setAiConversationSaved` (`excluded` + `access: "self"`) |
| `src/components/assistant/AICommandSheet.tsx` | edycja | pasek + menu ⋮, `AnchoredLayer` pod menu poziomu, segmenty Zapisane/Historia, tryb treści, `confirmDialog` przy usuwaniu |
| `src/components/shell/AppShell.tsx` | edycja | opakowanie `relative` wokół `<main>` + asystenta, `inert`/`aria-hidden` na przykrytej treści |
| `src/hooks/useVisualViewport.ts` | edycja | `useIsWideScreen()` obok `useIsNarrowScreen()` |
| `messages/pl.json` | edycja | nowe teksty (C-32) |
| `doświadczenia.md` | edycja | lekcje: `display:none` gubi przewinięcie; `inert` przez `ref`, nie prop; `take: 50` na wspólnej liście chowa rekordy przypięte (C-51) |
| `worldofmag/CLAUDE.md` *(korzeń `worldofmag/`)* | edycja | tabela modułów / opis asystenta: dwie listy rozmów + tryb prezentacji |

## 8. Bramki i weryfikacja (C-50)

**Lokalnie (C-13 — nigdy prod `DATABASE_URL`):**
```bash
cd worldofmag
pg_ctlcluster 16 main start
export DATABASE_URL=postgresql://omnia:omnia@127.0.0.1:5432/omnia_dev DIRECT_URL=$DATABASE_URL
npx prisma migrate deploy          # zaaplikuj 0267 lokalnie
npm run check:migrations && npm run check:schema-drift && npm run check:pagination
npm run check:i18n && npm run check:ui-contract && npm run check:owner-columns
npm run check:client-safe && npm run check:logs && npm run check:ai-coverage
npx tsc --noEmit -p tsconfig.test.json && npx next lint --dir src && npx next build
```
Weryfikujemy **do kroku `next build`** włącznie — ostatni krok `npm run build` (`migrate.js`) rusza
prod DB, więc go lokalnie nie odpalamy (C-13, C-50).

**Mapowanie AC → sposób sprawdzenia:**

| AC | Jak sprawdzamy |
|---|---|
| AC-1, AC-2 | Klikacz Playwright przy 360 × 740: asystent otwarty, `autoApprove` włączony — porównanie prostokątów (`boundingBox`) wszystkich elementów paska: brak przecięć; każdy przycisk ≥ 44 × 44; `scrollWidth === clientWidth` na pasku. Znacznik `auto`: przy 360 px widoczna ikona, tekst `hidden`; przy ≥ 640 px tekst widoczny |
| AC-3 | Klikacz: otwórz ⋮ → widoczne pozycje ustawień, zgłoszenia i (dla admina) przełącznik trybu; kliknięcie „Ustawienia" otwiera dotychczasowy panel |
| AC-4 | Klikacz: ⋮ otwarte → `Escape` → menu zamknięte, arkusz **nadal** otwarty (`[data-omnia-overlay="assistant"]` obecny) |
| AC-5, AC-6 | Klikacz przy 1280 × 800 **i** 1280 × 600: otwórz poziom pracy → prostokąt panelu mieści się w oknie (`top ≥ 0`, `bottom ≤ innerHeight`); wszystkie cztery poziomy + przełącznik osiągalne (przewijanie wewnątrz panelu dozwolone) |
| AC-7 | Klikacz: wybór poziomu zmienia zaznaczenie i przeżywa ponowne otwarcie menu (zapis w `AssistantPref`) |
| AC-8, AC-10 | Klikacz: rozmowa z jedną turą → ⋮ → „Zapisz rozmowę" → historia → segment „Zapisane" zawiera ją; „Usuń z zapisanych" → wraca do „Historia" i **nie znika** z aplikacji. Trwałość: przeładowanie strony |
| AC-9 | Klikacz: dwa segmenty z licznikami; suma liczników = liczba rozmów; żadna rozmowa nie jest na obu listach |
| AC-11 | Klikacz: bez zapisanych rozmów segment „Zapisane" jest widoczny i wyłączony; po wymuszeniu wejścia — tekst wyjaśniający, nie pusty ekran |
| AC-12 | Klikacz: ⋮ → „Usuń rozmowę" → pojawia się `ConfirmDialog` (skórkowany, nie natywny); anulowanie zostawia rozmowę |
| AC-13 | Migracja na lokalnej bazie z istniejącymi rozmowami: po `migrate deploy` wszystkie mają `saved = false`; lista „Zapisane" pusta, „Historia" kompletna |
| AC-14 | Klikacz przy 1440 px: włącz tryb treści → `window.location.href` **bez zmian**; panel asystenta ma `getBoundingClientRect` równy obszarowi treści (nie pełnemu oknu) |
| AC-15 | Klikacz: moduł z długą listą → przewiń o N px → tryb treści → wyjście → `scrollTop` **ten sam**; tekst wpisany w polu modułu nadal jest |
| AC-16 | Klikacz: w trybie treści zapytanie kontekstowe → żądanie do agenta niesie tę samą ścieżkę co w trybie okna (podgląd `route` w ładunku) |
| AC-17 | Klikacz: włącz tryb treści → przeładowanie → nadal tryb treści (odczyt z `AssistantPref`) |
| AC-18 | Klikacz przy 360 px z zapisanym `presentation = "content"`: asystent otwiera się jako **arkusz**, nie jako warstwa treści |
| AC-19 | Klikacz: w trybie treści widoczne bez otwierania żadnego menu: przełącznik trybu **i** „Zamknij" |
| AC-20 | Klikacz: w trybie treści kliknięcie pozycji nawigacji modułów działa (zmiana trasy); dodatkowo `mainRef` ma `inert` i `aria-hidden`, a `document.activeElement` nie wchodzi do `<main>` przy `Tab` |
| AC-21 | Pełna lista bramek z bloku powyżej |

Klikacze uruchamiamy zgodnie z `docs/e2e/uruchamianie-e2e-claude.md`
(`nohup bash scripts/e2e-web.sh > /tmp/e2e.log 2>&1 &`), **bez `networkidle`** (`check:e2e-waits`).

## 9. Ryzyka techniczne i plan wycofania

| Ryzyko | Mitygacja |
|---|---|
| Opakowanie w `AppShell` zmienia układ w 20 modułach | Opakowanie przejmuje **dokładnie** klasy układu od `<main>` (`flex-1 min-w-0`) i nie dostaje `transform`/`filter`/`contain`. Sprawdzenie: zrzut szerokości `<main>` przed/po na jednym szerokim i jednym wąskim ekranie |
| `inert` niewspierany albo zignorowany przez React 18 | Ustawiamy **przez `ref` + `setAttribute`**, nie propem; `/verify` sprawdza atrybut na żywym DOM i próbę `Tab` do środka. Gdyby `inert` gdzieś nie działał, `aria-hidden` nadal odcina czytnik ekranu, a warstwa i tak przechwytuje wskaźnik |
| Zmiana kształtu `listAiConversations` psuje innego konsumenta | `grep -rn "listAiConversations" src/` **przed** zmianą; `tsc --noEmit` złapie resztę (zwrotka jest typowana) |
| Menu ⋮ chowa funkcje „za dobrze" | Wskaźniki stanu (znacznik `auto`) i wyjścia (dokowanie, zamknij) **zostają w pasku**; pod ⋮ idą wyłącznie czynności — reguła zapisana w §5.1 i sprawdzana w AC-3/AC-19 |
| `AnchoredLayer` (z-index 9995) vs arkusz asystenta (9990) | Warstwa jest **celowo** ponad asystentem — tak zaprojektowano ją w 080; w trybie treści panel asystenta jest niżej, więc tym bardziej |
| Rozjazd liczników Zapisane/Historia | Jedno pole `saved` jako jedyne źródło podziału; zapytania rozłączne (`saved: true` / `saved: false`) — rozmowa nie ma jak trafić na obie listy (AC-9) |

**Wycofanie:** zmiana jest w całości odwracalna na poziomie **kodu** — `git revert` commita
przywraca dotychczasowy pasek, menu i arkusz. Kolumny z migracji **zostają** (są `NOT NULL DEFAULT`,
więc nikomu nie przeszkadzają) — cofanie migracji na produkcji jest procedurą osobną i tutaj
niepotrzebną (por. `docs/devops/runbook-deploy-rollback.md`: rollback kodu ≠ rollback migracji).

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-15** — ręcznie pisana migracja `0267` (numer z `next:migration`), `String` + union
      zamiast enuma, `schema.prisma` zmieniany razem z plikiem, DDL nie z `migrate diff`,
      lokalna weryfikacja na lokalnym Postgresie (nigdy prod)
- [x] **C-20..C-25** — mutacje jako Server Actions z `revalidatePath`; guard własności przez
      `userId` w `updateMany` (wzorzec sąsiednich akcji); RBAC bez zmian; brak nowej `AIAction`;
      kosz i audyt nie dotyczą
- [x] **C-30..C-35** — kolory wyłącznie ze zmiennych CSS; cele dotyku ≥ 44 px i rachunek szerokości
      przy 360 px; teksty przez `t()` do `messages/pl.json`; potwierdzenie przez `confirmDialog`
      z `destructive: true`; **żadnego nowego wspólnego komponentu** — użyte trzy istniejące
- [x] **C-36** — pracujemy w powłoce i w `src/components/assistant`; nie sięgamy do wnętrza
      żadnego modułu i nie dopisujemy się do żadnej równoległej listy
- [x] **C-53 (minimalizm)** — sprawdzone świadomie: nowe są dwie kolumny, jedna akcja, jeden
      4-liniowy hook i jedno przesunięcie w drzewie `AppShell`. Trzy zgłoszenia realizują
      komponenty, które już istnieją i powstały dokładnie na te wady
