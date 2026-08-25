# Plan techniczny: Ergonomia nawigacji — paski filtrów i pasek kciuka

- **Spec:** ./spec.md (100-ergonomia-nawigacji-i-pasek-kciuka)
- **Status:** draft
- **Data:** 2026-08-25

---

## 1. Podejście

Trzy zgłoszenia, **trzy niezależne warstwy zmian**, ale wszystkie realizują tę samą regułę: *pasek ma
mieć stałą wysokość i pokazywać stan wyboru*.

- **Wiadomości (A)** i **Zadania (B)** to zmiany czysto UI, **bez schematu i bez akcji serwera**.
  Wzorcem dla obu jest **`SourceFilter` z Wiadomości (083)** — jeden przycisk o stałej wysokości
  z licznikiem + `AnchoredLayer` z wielokrotnym wyborem. Dla (A) reużywamy tego samego prymitywu
  warstwy, ale w formie **przełącznika segmentowego** osadzonego w istniejącym `NaglowekSekcji`, żeby
  cała logika przyklejenia i zasłony została w **jednym** miejscu (C-33, lekcja 086/087).
- **Pasek kciuka (C, D)** to jedyna część ruszająca **schemat**: jedna kolumna `handedness`
  w `UserMenuPref`. Ta tabela to celowy wybór, nie skrót: `AppShell` **już** dostaje jej zawartość
  jako `menuPrefs` z `src/app/layout.tsx`, więc ręka dojedzie do powłoki **bez ani jednego nowego
  zapytania na stronę** — dokładnie ten sam argument, którym 080 uzasadniło `favoritesCollapsed`.
- Wachlarz nawigacji **nie tworzy nowej równoległej listy modułów** (C-36). Karmi się tym, co powłoka
  już ma w ręku: `resolveMenu(...)` (poziom 1 — moduły) i `favoriteViews` (poziom 2 — zapisane widoki
  danego modułu). Rozbudowa łańcucha `if (id === "shopping")` w `MobileModuleSubNav` jest **świadomie
  odrzucona** — to relikt sprzed 048/049 i dopisywanie się do niego byłoby regresją.

## 2. Model danych (Prisma)

- **Zmieniony model:**
  - `UserMenuPref` — nowa kolumna `handedness String @default("right")`.
    Wartości: `"right" | "left"` jako **union TypeScript** (`export type Reka = "right" | "left"`
    w `src/lib/modules.tsx`) — **żadnego enuma Prisma** (C-12).
- **Relacje / indeksy:** bez zmian. Kolumna nie jest filtrowana ani sortowana — indeks byłby kosztem
  bez korzyści.
- **Dlaczego nie osobna tabela preferencji:** ręka to jedna wartość skalarna czytana na **każdej**
  stronie razem z menu. Osobna tabela = drugie zapytanie w `layout.tsx` na każde żądanie.
- **Migracja (C-10, C-11):**
  - Numer z `npm run next:migration`: **`0260`**
  - Katalog: `prisma/migrations/0260_reka_dominujaca/migration.sql`
  - DDL (idempotentnie):
    ```sql
    ALTER TABLE "UserMenuPref" ADD COLUMN IF NOT EXISTS "handedness" TEXT NOT NULL DEFAULT 'right';
    ```
  - **`DEFAULT 'right'` jest wymagany**, nie kosmetyczny: kolumna jest `NOT NULL`, a tabela ma
    istniejące wiersze — bez domyślnika `ALTER` padnie na produkcji. Domyślnik zostaje też **na stałe**
    (nie `DROP DEFAULT` po backfillu), bo `defaultMenuPrefs()` i tak zwraca `"right"`, a rozjazd między
    domyślnikiem bazy a domyślnikiem kodu to klasyczne źródło „u nowego użytkownika jest inaczej".
  - Po dopisaniu DDL: `grep -E "^(DROP|ALTER TABLE .* DROP)" migration.sql` — plik ma zawierać
    **wyłącznie** ten jeden `ADD COLUMN` (C-15).

## 3. Warstwa serwera (Server Actions — C-20)

Bez nowego pliku akcji. Rozszerzamy istniejący:

- Plik: `src/actions/menuPrefs.ts`
  - `readMenuPrefs(userId)` — dołożyć `handedness` do zwracanego obiektu (z rzutowaniem na `Reka`
    i zejściem do `"right"` przy nieznanej wartości z bazy; kolumna jest `String`, więc walidacja
    należy do kodu — C-12).
  - `updateMenuPrefs(patch)` — dołożyć `handedness?: Reka` do sygnatury i do `upsert`. Funkcja **już**
    kończy się `revalidatePath` — sprawdzić, że rewalidowana jest ścieżka obejmująca całą powłokę
    (`/`, layout), bo ręka zmienia chrom na **każdej** stronie, nie tylko w ustawieniach; jeśli dziś
    rewaliduje wąsko, poszerzyć. Klient i tak robi `router.refresh()` (wzorzec z `MenuPrefsEditor`).
- **Guard dostępu (C-21):** bez zmian — `UserMenuPref` jest kluczowany `userId` z sesji; nie ma tu
  cudzych zasobów, więc nie ma czego autoryzować poza „jest sesja".
- **Własność:** `UserMenuPref` to **preferencja konta**, nie zasób w przestrzeni — nie dotyczy jej
  `workspaceId` ani `ownerId`/`ownerTeamId`. Nie dopisujemy tam własności (byłoby to poszerzenie
  modelu bez konsumenta).

## 4. RBAC / rejestr modułu (C-22)

- **Bez nowego sluga.** Wiadomości → `module.news`, Zadania → `module.tasks` (istniejące).
  Ustawienie ręki jest dostępne dla każdego zalogowanego, jak reszta personalizacji menu.
- **Bez zmian** w `src/lib/permissions.ts`, `src/lib/modules.tsx` (poza typem `MenuPrefs`),
  `src/lib/sharingResources.ts`, `src/lib/dashboardContributors.ts`.
- Wachlarz nawigacji **musi respektować blokady**: pozycje bierzemy z `resolveMenu(userPermissions,
  prefs)` (już filtruje po uprawnieniach), a ulubione — przez istniejące
  `filterAccessibleFavorites(..., isPathLocked)`. Nie budujemy własnego filtru.

## 5. UI (C-30, C-31, C-32)

### A. Wiadomości — przełącznik segmentowy (AC-1..AC-5)

- **Nowy wspólny komponent:** `src/components/ui/nav/PrzelacznikSegmentowy.tsx`
  — generyczny („zbiór wykluczających się list, każda z licznikiem"), API:
  `{ pozycje: { id, etykieta, licznik, wylaczona? }[], wybrana: string, onWybor: (id) => void }`.
  Ląduje w `components/ui/nav/` obok `GroupNavigator` (083) — **razem z pierwszym konsumentem**
  (C-35), którym są Wiadomości. Segment nieaktywny renderujemy jako `<button disabled>`
  z `aria-disabled`, **nie** pomijamy go (AC-4).
- **`src/modules/news/ui/sekcjeTematow.tsx` → `NaglowekSekcji`:** nowy **opcjonalny** prop
  `segmenty?: ReactNode`, który **zastępuje** grupę „tytuł + licznik". Uzasadnienie w komentarzu:
  przyklejony nagłówek jest jedynym miejscem, które nazywa to, na co patrzysz — a gdy sekcja ma trzy
  siostrzane listy, tą nazwą **jest** przełącznik. Trzymamy to w `NaglowekSekcji`, a nie obok, bo tu
  siedzi `top: var(--news-pasek-h)` i wysokość, od której zależy zasłona (AC-5, ryzyko z 086/087).
- **`src/modules/news/ui/HotTopics.tsx`:**
  - stan `showHidden`/`showMonitorowane` (dwa niezależne boole) zamieniamy na **jeden**
    `lista: "proponowane" | "monitorowane" | "odrzucone"` — trzy wykluczające się widoki, więc dwa
    boole pozwalały na stan „obie otwarte naraz", którego przełącznik nie umie pokazać;
  - `MenuProponowanych` **kasujemy w całości** (AC-3) razem z importami `MoreVertical`/`Eye`;
  - pasek `AiContentMeta`, karty propozycji, listy monitorowanych i odrzuconych renderujemy zależnie
    od `lista` — bez zmiany ich zawartości i akcji (żadnej regresji w `add`/`hide`/`unhide`/
    `przestanMonitorowac`).
- Kolory: wybrany segment na `var(--bg-elevated)` + `var(--text-primary)` + obramowanie
  `var(--accent-blue)`; nieaktywny `var(--text-muted)`. **Zero hexów** (C-30).

### B. Zadania — filtr tagów (AC-6..AC-10)

- **Nowy komponent modułu:** `src/modules/tasks/ui/FiltrTagow.tsx`.
  Świadomie **w module, nie w `components/ui`** — jedynym konsumentem są Zadania, a przynależność
  pliku ustala lista konsumentów, nie nazwa (C-36). Jeśli drugi moduł kiedyś tego zapragnie, wtedy
  będzie powód, żeby wynieść.
  Kształt 1:1 wg `SourceFilter`: przycisk `inline-flex … py-3` (cel dotyku, C-31) z ikoną `Tag`
  i etykietą `„Wszystkie"` / `„3 z 18"`, obok `AnchoredLayer side="dol" align="start" width={300}`
  z polem wyszukiwania, pozycją „Wszystkie tagi" i listą tagów z `TaskTagBadge`.
- **Chipy wybranych** stoją obok przycisku (AC-8): `TaskTagBadge` + „×", każdy zdejmuje swój tag.
  Rząd chipów ma **stałą wysokość** i `overflow-x-auto` — chipów jest tyle, ile WYBRANO (typowo 1–3),
  a nie tyle, ile istnieje; to jest różnica między dzisiejszym paskiem a docelowym.
- **`src/modules/tasks/ui/TaskFilters.tsx`:** blok `allTags.map(...)` zastąpiony przez `<FiltrTagow>`;
  prop `onTagToggle` zostaje bez zmian (ta sama semantyka AND w `TasksPage` — AC-7, AC-9).
  Dodatkowo: `color: isActive ? "#fff"` w liczniku zakładki statusu → `var(--on-accent)` (AC-10, C-30).
- `TasksPage` **bez zmian logicznych** — filtrowanie `selectedTagIds.every(...)` zostaje dokładnie
  takie, jakie jest. To jest warunek AC-7 i najtańszy sposób, żeby nie wywołać regresji.

### C+D. Pasek kciuka, ręka, magiczna ikona, wachlarz (AC-11..AC-22)

**Nośnik ręki — dwa kanały z jednego źródła, czytane raz:**

1. `src/app/layout.tsx` — `menuPrefs` jest już czytane; dokładamy `data-reka={menuPrefs.handedness}`
   na `<html>` (tam, gdzie 045 nakłada inline tokeny skórki). Daje to **lustrzenie czysto CSS-owe bez
   FOUC** dla rzeczy, które są tylko kwestią kolejności w rzędzie.
2. `AppShell` dostaje `menuPrefs` w propsie — `const reka = menuPrefs.handedness` — i przekazuje go
   tam, gdzie potrzebny jest JS (kolejność pozycji, strona pływających przycisków).

**Nowy komponent: `src/components/shell/PasekKciuka.tsx`** (zastępuje inline `<nav>` z `AppShell`).

- Układ: `[poz][poz] [✨] [poz][poz]` — magiczna ikona **zawsze na środku** (AC-13), pozycje modułów
  po bokach. Środek jest neutralny względem ręki i to jest zaleta: jedyny element, którego nigdy nie
  trzeba szukać, nie zmienia miejsca po przełączeniu ręki.
- Magiczna ikona: `52 px`, `border-radius: 50%`, `background: var(--accent-blue)`,
  `color: var(--on-accent)`, `translateY(-14px)` + pierścień `var(--bg-base)` — **wystaje ponad górną
  krawędź paska** (AC-13). Klik → `openAssistant()` z istniejącej magistrali
  `@/platform/ai/assistantBus` (nie duplikujemy montażu arkusza).
- **Ręka (AC-14):** kolejność pozycji odwracamy przy `reka === "left"`; pozycje **bliżej środka po
  stronie dominującej** dostają szerszy udział (`flex-grow` 1.35 vs 1) i większą ikonę (22 vs 20 px).
  **Twardy warunek:** `min-height: 44px` i `min-width: 44px` na każdej pozycji (C-31, AC-14) — różnica
  jest w NADMIARZE, nigdy w niedomiarze.
- `padding-bottom: env(safe-area-inset-bottom)` zostaje; `<main>` dostaje `pb-16` zamiast `pb-14`,
  żeby wystająca ikona nie zjadała ostatniego elementu listy (AC-19).

**Nowy komponent: `src/components/shell/WachlarzNawigacji.tsx`** (gest — AC-15..AC-18, AC-21).

- **Gest:** `onPointerDown` → `setPointerCapture` + timer 350 ms → otwarcie wachlarza. `pointermove`
  podświetla najbliższą podpowiedź (trafienie liczone po **odległości od środka podpowiedzi**, nie po
  `elementFromPoint` — palec zasłania cel i `hit-test` bywa pusty na krawędzi). `pointerup` na
  podświetlonej → `router.push`; poza → zamknięcie bez nawigacji (AC-16). `Escape` zamyka (AC-16).
  Ruch powyżej progu **przed** upływem 350 ms = przewijanie strony → anulujemy timer (inaczej gest
  kradłby scroll).
  `touch-action: none` i `user-select: none` **tylko** na pozycjach paska; `onContextMenu`
  `preventDefault` — bez tego Android pokazuje własne menu na przytrzymaniu (ryzyko ze speca).
- **Poziom 1** = moduły z `resolveMenu(...).enabled` (już przefiltrowane po uprawnieniach), rozłożone
  na **łuku o promieniu ~120 px wokół punktu startu**, wychylonym w stronę dominującej ręki — to jest
  cała treść „w zasięgu kciuka". Więcej niż 8 pozycji: łuk rozszerza się na drugi pierścień.
- **Poziom 2** = zapisane **ulubione widoki** tego modułu (`favoriteViews` przefiltrowane po prefiksie
  ścieżki i przez `filterAccessibleFavorites`). Otwiera się po **zatrzymaniu palca** na podpowiedzi
  (dwell ~400 ms) — bez puszczania (AC-15). Gdy modul nie ma zapisanych widoków, poziom 2 się nie
  otwiera i podpowiedź zachowuje się jak liść.
- **Animacja:** `@media (prefers-reduced-motion: reduce)` → `transition: none`, podpowiedzi pojawiają
  się od razu (AC-18). Animacja jest ozdobą gestu, nigdy jego warunkiem.
- Renderowane przez `createPortal` do `body` na warstwie **9994** — tuż pod `AnchoredLayer` (9995)
  i grubo pod trybem wskazywania elementu (9998/9999), zgodnie z ustaloną drabinką warstw.
- **Klient bez `AsyncLocalStorage` i bez pracy na module scope** (C — bramka `check:client-safe`).

**Zmiany w istniejących plikach powłoki:**

- `src/components/shell/AppShell.tsx` — `<nav>` dolnego paska → `<PasekKciuka reka=… tabBar=… />`;
  montaż `<WachlarzNawigacji>`; przekazanie `reka` do `FeedbackInspector` i `AICommandSheet`;
  `pb-14` → `pb-16` na `<main>`.
- `src/components/assistant/AICommandSheet.tsx` — FAB dostaje `md:` -only widoczność (na telefonie
  jego rolę przejmuje środek paska — AC-13) i **stronę wg ręki**: przy `left` pozycjonujemy
  `left: calc(var(--sidebar-width) + 1.25rem)` zamiast `right-5`, żeby na komputerze nie wjechał pod
  panel boczny (AC-20). Reszta komponentu bez zmian.
- `src/components/shell/FeedbackInspector.tsx` — `right-5` → strona wg ręki, tą samą regułą
  (AC-12). Zachowujemy istniejące piętrowanie `z-index` i wariant „nad modalem".
- `src/components/shell/ModuleSidebar.tsx` — rząd chromu konta (gwiazdka, tryb admina, dzwonek)
  ustawiany wg ręki (`flex-direction: row-reverse` sterowane `html[data-reka="left"]` — czysty CSS,
  AC-12/AC-22); pozycje nawigacji podpinane pod ten sam gest przytrzymania (AC-21).
- `src/components/settings/MenuPrefsEditor.tsx` — dwustanowy przełącznik „Dominująca ręka: Prawa /
  Lewa" z `aria-pressed`, zapis przez `updateMenuPrefs({ handedness })` + `router.refresh()`
  (wzorzec `persistTabBar` w tym samym pliku). Stoi tu, a nie w „Wygląd", bo to ustawienie **tego
  paska**, którym ta sekcja już rządzi (AC-11).

### Teksty (C-32)

Wszystkie nowe napisy do `messages/pl.json` pod namespace'ami wywiedzionymi ze ścieżki:
`components.ui.nav.PrzelacznikSegmentowy`, `modules.tasks.FiltrTagow`,
`components.shell.PasekKciuka`, `components.shell.WachlarzNawigacji`,
`components.settings.MenuPrefsEditor` (dopisanie), `modules.news.HotTopics` (klucze `proponowane`,
`monitorowane`, `odrzucone` **już istnieją** — reużywamy; usuwamy osierocony `wiecejDzialan`, jeśli
nic go już nie woła). **Zero literałów w JSX** — bramka `check:i18n` jest od 097 regułą bezwzględną.

## 6. AI / integracje (C-23, C-40)

**Nie dotyczy.** Żadnej nowej `AIAction`, żadnego read-toola, żadnego wywołania modelu — więc
`check:actions`, `check:ai-coverage`, `check:cost-badge` i `check:content-memory` nie mają tu nic
nowego do sprawdzenia. Zmienia się **miejsce i wygląd** wejścia do asystenta, nie jego działanie:
`AICommandSheet` pozostaje jedynym montażem, a środek paska woła istniejące `openAssistant()`.

Kalendarz / powiadomienia / kosz / audyt — nie dotyczy.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` | edycja | `UserMenuPref.handedness String @default("right")` |
| `prisma/migrations/0260_reka_dominujaca/migration.sql` | nowy | `ADD COLUMN IF NOT EXISTS` (C-10) |
| `src/lib/modules.tsx` | edycja | typ `Reka`, `MenuPrefs.handedness`, `defaultMenuPrefs()` |
| `src/actions/menuPrefs.ts` | edycja | odczyt/zapis ręki + `revalidatePath` (C-20) |
| `src/app/layout.tsx` | edycja | `data-reka` na `<html>` (lustrzenie CSS bez FOUC) |
| `src/components/settings/MenuPrefsEditor.tsx` | edycja | przełącznik ręki (AC-11) |
| `src/components/shell/PasekKciuka.tsx` | **nowy** | dolny pasek: środek = ✨, boki wg ręki (AC-13/14) |
| `src/components/shell/WachlarzNawigacji.tsx` | **nowy** | gest przytrzymaj→przeciągnij→puść (AC-15..18, 21) |
| `src/components/shell/AppShell.tsx` | edycja | wpięcie obu, przekazanie ręki, `pb-16` |
| `src/components/assistant/AICommandSheet.tsx` | edycja | FAB tylko `md:`, strona wg ręki (AC-13/20) |
| `src/components/shell/FeedbackInspector.tsx` | edycja | strona robaczka wg ręki (AC-12) |
| `src/components/shell/ModuleSidebar.tsx` | edycja | rząd chromu wg ręki + gest na pozycjach (AC-21/22) |
| `src/components/ui/nav/PrzelacznikSegmentowy.tsx` | **nowy** | wspólny przełącznik segmentowy (AC-1/2/4) |
| `src/modules/news/ui/sekcjeTematow.tsx` | edycja | prop `segmenty` w `NaglowekSekcji` (AC-5) |
| `src/modules/news/ui/HotTopics.tsx` | edycja | jeden stan `lista`, kasacja `MenuProponowanych` (AC-3) |
| `src/modules/tasks/ui/FiltrTagow.tsx` | **nowy** | przycisk + panel + chipy (AC-6..9) |
| `src/modules/tasks/ui/TaskFilters.tsx` | edycja | wpięcie filtru, usunięcie `#fff` (AC-10) |
| `messages/pl.json` | edycja | nowe teksty PL (C-32) |
| `doświadczenia.md` | edycja | lekcja (C-51) |
| `CLAUDE.md` | edycja | opis chromu (dolny pasek, magiczna ikona, ręka) przestaje być prawdziwy |

## 8. Bramki i weryfikacja (C-50)

**Lokalnie (C-13 — nigdy prod DB):** lokalny Postgres 16 (`pg_ctlcluster 16 main start`, rola/baza
`omnia/omnia_dev`), `.env.local` + **eksport** `DATABASE_URL`/`DIRECT_URL` do powłoki,
`npx prisma migrate deploy`. Weryfikujemy **do kroku `next build`** włącznie — `scripts/migrate.js`
NIE odpalamy.

Bramki, które ta zmiana realnie dotyka:
`check:migrations` (0260 unikalny) · `check:schema-drift` (schemat vs migracja) · `check:i18n`
(reguła bezwzględna) · `check:ui-contract` (żadnej nowej trasy, ale ruszamy komponenty pod
`src/components` — pilnować braku hexów) · `check:client-safe` · `check:logs` · `check:tailwind`
(nowe pliki są w już pokrytych katalogach — potwierdzić) · `check:owner-columns` (nie dotykamy
zapytań, ale gate skanuje) · `next lint` · `tsc -p tsconfig.test.json` · `next build` ·
`check:perf` (pasmo ±5 % — nowe komponenty powłoki wchodzą do **każdej** trasy, więc to jest bramka
z realnym ryzykiem; patrz §9).

### Mapowanie AC → sposób weryfikacji

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1, AC-3 | e2e/ręcznie na `/wiadomosci`: trzy segmenty widoczne; `grep MoreVertical` w `HotTopics.tsx` → brak |
| AC-2 | segment „Odrzucone" ma `aria-pressed="true"` i inne tło; lista pod nim = odrzucone |
| AC-4 | scenariusz z 0 odrzuconych: segment obecny, `disabled` |
| AC-5 | pomiar `getBoundingClientRect().height` przyklejonego nagłówka przy 360 px, przed i po |
| AC-6 | pomiar wysokości paska filtrów przy 3 i 18 tagach — **równe** |
| AC-7, AC-9 | test jednostkowy/ręczny filtru: ten sam zbiór zadań przed i po zmianie UI |
| AC-8 | „3 z 18" na przycisku; „×" na chipie zdejmuje jeden tag |
| AC-10 | `grep -n '#fff' src/modules/tasks/ui/TaskFilters.tsx` → brak |
| AC-11 | przełącznik w ustawieniach; po `router.refresh()` wartość trzyma się po przeładowaniu |
| AC-12, AC-20 | przy `left` gwiazdka/robaczek/FAB po lewej; na komputerze FAB nie wjeżdża pod panel |
| AC-13 | ✨ na środku paska, `translateY` ujemny; brak drugiego FAB-a poniżej `md` |
| AC-14 | zmierzone `getBoundingClientRect()` każdej pozycji: `height ≥ 44 && width ≥ 44` |
| AC-15..AC-18 | ręczny gest dotykiem i myszą + `Escape`; wariant `prefers-reduced-motion` |
| AC-19 | długa lista zadań przewinięta do końca — ostatni wiersz w całości widoczny |
| AC-21, AC-22 | ten sam gest na pozycji panelu bocznego; te same ikony po tej samej stronie |
| AC-23, AC-24 | `npm run build` do `next build` + `npm run check:i18n` |

## 9. Ryzyka techniczne i plan wycofania

- **`check:perf` (±5 %)** — `PasekKciuka` i `WachlarzNawigacji` wchodzą do bundla **każdej** trasy,
  bo montuje je powłoka. To najbardziej prawdopodobna przyczyna czerwonego builda w tej zmianie.
  → **Korekta z etapu `/implement` (C-54): `dynamic(..., { ssr: false })` na wachlarzu jest
  NIEMOŻLIWY i pierwotny zapis planu był tu błędny.** Wachlarz nie jest nakładką montowaną obok —
  jest **dostawcą kontekstu**, z którego czytają wyzwalacze w dwóch miejscach (dolny pasek i pozycje
  nawigacji bocznej). Dostawca opakowuje `children` całej powłoki, więc `ssr: false` oznaczałoby, że
  **żadna strona nie renderuje się na serwerze**. Rozdzielenie hooka od nakładki dałoby dwa moduły
  zamiast jednego problemu — a sam ciężar jest mały: ~350 wierszy, **zero zależności** (gest pisany
  na gołym `PointerEvent`), a warstwa podpowiedzi renderuje się dopiero po otwarciu.
  Mitygacja zostaje więc jedna i wystarczająca: brak nowych zależności. Jeśli pasmo ±5 % pęknie —
  podnieść próg w manifeście świadomie, w osobnym commicie z uzasadnieniem.
- **Gest kontra przewijanie** — `touch-action: none` na całym pasku zablokowałoby przewijanie palcem
  startującym na pasku. → Ustawiamy je **tylko** na pozycjach, a timer anulujemy przy ruchu powyżej
  progu przed upływem 350 ms.
- **`setPointerCapture` a `Link`** — przechwycony wskaźnik zmienia cel `pointerup`, więc nawigację
  wykonujemy **imperatywnie** (`router.push`) po zwolnieniu, a nie licząc na klik w `<a>`. Krótkie
  tapnięcie (AC-17) obsługujemy tą samą ścieżką: brak przekroczenia progu czasu → `push` na własny
  adres pozycji.
- **Rozjazd przyklejonych nagłówków w Wiadomościach** — zmiana zawartości `NaglowekSekcji` zmienia
  jego wysokość. → Zasłona zostaje wyrażona w CSS (`calc(var(--news-pasek-h, 0px) + …)`), a nie liczbą
  z efektu (C-33); AC-5 mierzy to wprost.
- **Migracja** — `ALTER TABLE … ADD COLUMN` z domyślnikiem na PostgreSQL 11+ nie przepisuje tabeli;
  operacja jest szybka i bez blokady zapisu na tak małej tabeli.
- **Rollback:** kod — `git revert` commita/merge'a; migracja — kolumna jest **addytywna
  i z domyślnikiem**, więc starszy kod ją po prostu ignoruje. **Nie cofamy migracji** przy cofaniu
  kodu (runbook devops: rollback kodu ≠ rollback migracji).

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-15** — ręczna migracja `0260`, numer z `next:migration`, `String` + union zamiast
      enuma, `DEFAULT` wymagany przy `NOT NULL` na niepustej tabeli, żadnego builda/migracji przeciw
      prod DB, plik migracji zawiera wyłącznie własne DDL.
- [x] **C-20..C-25** — zapis przez istniejącą Server Action z `revalidatePath`; brak nowych zasobów,
      więc brak nowego guarda, trasha i audytu; **brak nowej `AIAction`** (C-23 bez zastosowania).
- [x] **C-30..C-35** — wyłącznie zmienne CSS (i **usunięcie** istniejącego `#fff`), `env(safe-area-
      inset-bottom)`, cele dotyku ≥ 44 px, nigdy dwa panele boczne na telefonie, teksty przez `t()`,
      nowy wspólny komponent (`PrzelacznikSegmentowy`) dowieziony **z konsumentem**, rama widoku
      nietknięta poza dopuszczonym rozszerzeniem `NaglowekSekcji`.
- [x] **C-36** — wachlarz karmi się `resolveMenu` i `favoriteViews`, **nie** dopisuje modułów do
      żadnej równoległej listy; `FiltrTagow` mieszka w module, bo tam są jego konsumenci; powłoka nie
      importuje wnętrza żadnego modułu.
- [x] **C-53 (minimalizm)** — zero nowych zależności (gest na gołym `PointerEvent`), dwa nowe
      komponenty powłoki i jeden wspólny, reszta to edycje; `TasksPage` i logika filtrowania
      **nietknięte**; łańcuch `MobileModuleSubNav` świadomie **nie** rozbudowywany.
- [x] **C-50..C-52a** — „gotowe" = zielony `next build`; lekcja do `doświadczenia.md`; merge do
      `develop`, promocja `--ff-only` z tagiem `prod-100-ergonomia-nawigacji-i-pasek-kciuka`.
- [x] **C-54** — `spec.md` poprawiony w trakcie planowania (AC-11: ustawienie ręki mieszka w sekcji
      rządzącej menu i dolnym paskiem, nie w „Wyglądzie" — bo to ustawienie tego paska).
