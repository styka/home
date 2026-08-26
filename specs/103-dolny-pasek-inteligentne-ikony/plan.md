# Plan techniczny: Dolny pasek — inteligentne ikony, gwiazdka, historia, drzewiasty wachlarz

- **Spec:** ./spec.md (103-dolny-pasek-inteligentne-ikony)
- **Status:** done
- **Data:** 2026-08-26

## 1. Podejście

Budujemy **na tym, co postawił run 100**: `PasekKciuka` (geometria paska, lustrzenie wg ręki,
magiczna ikona na środku) i `WachlarzNawigacji` (gest przytrzymaj → przeciągnij → puść, dwa
poziomy). Trzy zmiany są konstrukcyjne, reszta jest ich konsekwencją:

1. **Pasek przestaje być listą modułów, a staje się listą POZYCJI o różnym rodzaju.** Dziś
   `PasekKciuka` dostaje `ModuleDef[]`; dostanie `PozycjaPaska[]` — `modul | dom | ulubione |
   historia` — a **skład paska liczy czysta funkcja** w korzeniu kompozycji (`src/lib/modules.tsx`),
   nie komponent. Powód jest ten sam, dla którego `resolveTabBar` już tam mieszka: ten sam skład
   czyta ekran ustawień i test jednostkowy, a reguła „ile miejsc zostaje na moduły" musi być
   **policzona raz**, nie powtórzona w dwóch miejscach.
2. **Wachlarz przestaje mieć jedno źródło.** Dziś poziom 1 to zawsze lista modułów. Uogólniamy do
   **ŹRÓDŁA** (`ZrodloWachlarza`): co pokazać na poziomie 1 i co robi krótkie tapnięcie. Moduły
   i „dom" używają źródła domyślnego (moduły, tap = nawigacja), gwiazdka — źródła „ulubione"
   (tap = zapisz/usuń), historia — źródła „historia" (tap = krok wstecz). **Reguła z run 100 zostaje
   nienaruszona:** przytrzymanie pozycji MODUŁU zawsze daje tę samą listę modułów (AC-21); nowe
   źródła dotyczą wyłącznie dwóch nowych kotwic, które modułami nie są.
3. **Drugi poziom przestaje zależeć wyłącznie od tego, co użytkownik zapisał.** Moduł deklaruje
   `szybkieCele` w **swojej jednej deklaracji** (`module.ts`, C-36 — żadnej równoległej listy
   w powłoce), a powłoka scala je z ulubionymi widokami tego modułu.

Wzorzec do naśladowania: `sideNav` w `ModuleDeclaration` (pole deklaracji czytane przez powłokę)
oraz `filterAccessibleFavorites(..., isPathLocked)` (platforma bierze wiedzę modułową parametrem).

**Akcje wyrażone adresem** (decyzja właściciela) dostają JEDNĄ konwencję zamiast parametru per
moduł: `?akcja=<nazwa>`, czytany przez wspólny hook. Bez konwencji powstałoby dwadzieścia
prywatnych parametrów, których nikt nie umiałby przewidzieć ani zapisać w ulubionych.

## 2. Model danych (Prisma)

**Bez zmian w schemacie — i bez migracji.** Sprawdzone świadomie, bo pierwszy odruch mówi inaczej:

- **skład paska** — jedzie na istniejącym `UserMenuPref.tabBar` (JSON `string[]`); kotwice są stałe,
  więc nie ma czego zapisywać,
- **ręka** — istniejąca kolumna `UserMenuPref.handedness` (run 100),
- **ulubione** — istniejący `FavoriteView` + akcje `addFavoriteView` / `removeFavoriteViewByPath`,
- **historia odwiedzonych stron** — **świadomie nietrwała** (spec, „poza zakresem"): żyje
  w `sessionStorage` przeglądarki. Tabela byłaby zapisem przy każdej zmianie adresu — czyli
  najczęstszą operacją w aplikacji — dla danych, które i tak tracą sens po zamknięciu karty.

Konsekwencja dla `check:migrations` i `check:schema-drift`: nic do zrobienia, obie bramki przechodzą
bez zmian. **Gdyby w trakcie implementacji okazało się, że kolumna jednak jest potrzebna** —
obowiązuje C-10/C-11 (ręczny plik migracji, numer z `npm run next:migration`) i C-12 (`String`
+ union, nigdy enum), a plan trzeba poprawić PRZED napisaniem kodu (C-54).

## 3. Warstwa serwera (Server Actions — C-20)

Nowych akcji **nie ma**. Używamy istniejących, bez zmiany ich sygnatur:

| Akcja | Plik | Do czego |
|---|---|---|
| `addFavoriteView` / `removeFavoriteViewByPath` | `src/actions/favoriteViews.ts` | tap na gwiazdce (AC-6/AC-7); obie kończą `revalidatePath(SHELL_PATH, "layout")` — powłoka rysuje ulubione, więc unieważnia się LAYOUT, nie strona |
| `updateMenuPrefs` | `src/actions/menuPrefs.ts` | skład paska i ręka (AC-24) |

Zmiana w `updateMenuPrefs` (jedyna po stronie serwera): `tabBar` jest przycinany do **nowego
limitu miejsc modułowych** i odsiewa `home` — Strona główna jest teraz **kotwicą**, więc jej wpis
w preferencjach dawałby dwie ikony domu w jednym pasku. Walidacja zostaje po stronie akcji (dziś już
tam jest `VALID_IDS` + `slice`), bo kolumna jest JSON-em i przyjmie cokolwiek.

Guard dostępu (C-21): bez zmian — `addFavoriteView`/`removeFavoriteViewByPath` stoją na
`requireAuth()` + `filtrMoichRekordow(user.id)`; nie dotykamy ich reguł własności.

## 4. RBAC / rejestr modułu (C-22)

- **Nowego sluga nie ma.** Feature konsumuje istniejące uprawnienia.
- **Trzy miejsca, w których nowy kod MUSI przejść przez filtr dostępu** (inaczej pasek staje się
  obejściem RBAC):
  1. pozycje modułowe paska — `resolveTabBar` (już filtruje `hasAccess`),
  2. kotwica **Dom** — `isPathLocked(permissions, "/")`; gdy zamknięta, kotwica znika, a jej miejsce
     przechodzi na moduły (AC-5 mówi tylko, że pasek ma działać — nie że ma pokazywać zamknięte
     drzwi),
  3. **historia** i **szybkie cele** — `filterAccessibleFavorites(..., isPathLocked)`, ta sama
     funkcja co dla ulubionych (AC-16, AC-22). Filtr działa **przy renderowaniu**, nie przy zapisie:
     uprawnienie może wrócić.
- `permissions.ts` / `modules.tsx` / `ModuleSidebar` — bez nowych wpięć modułowych.

## 5. UI (C-30, C-31, C-32)

### 5.1 Skład paska — czysta funkcja w korzeniu kompozycji

`src/lib/modules.tsx`:

```ts
export type PozycjaPaska =
  | { rodzaj: "modul"; modul: ModuleDef }
  | { rodzaj: "dom" }
  | { rodzaj: "ulubione" }
  | { rodzaj: "historia" };

/** Ile miejsc paska zostaje dla modułów po odjęciu kotwic. Wyliczone z 360 px — patrz komentarz. */
export const MAKS_MODULOW_W_PASKU = 2;

export function pozycjePaska(permissions: string[], prefs: MenuPrefs, domDostepny: boolean):
  { dalekie: PozycjaPaska[]; bliskie: PozycjaPaska[] };
```

- **`dalekie`** (strona przeciwna do kciuka): `dom` (jeśli dostępny) + moduły z `resolveTabBar`,
  przycięte do `MAKS_MODULOW_W_PASKU` (+1, gdy kotwica domu odpadła — miejsce ma nie stać puste).
- **`bliskie`** (pod kciukiem): `ulubione`, potem `historia` — **historia w samym rogu**, bo powrót
  jest najczęstszą czynnością nawigacyjną, a run 100 ustalił, że róg pod kciukiem należy do pozycji
  najważniejszej.
- Kolejność zgadza się z listą właściciela: `Dom | Sparkles | ulubione | historia`.

**Arytmetyka 360 px, zapisana tu, żeby nie trzeba jej było odtwarzać (AC-3):** szerokość paska
360 − 68 (stały kontener magicznej ikony) = 292 px na 5 pozycji. Strony są dwoma pojemnikami
`flex: 1` po 146 px: strona dalsza to 3 pozycje po ~48,6 px, bliższa 2 po 73 px. Każda ≥ 44 px, więc
**5 pozycji to sufit** — i stąd `MAKS_MODULOW_W_PASKU = 2`. Szósta pozycja zeszłaby do 41 px
i złamała C-31.

`DEFAULT_TAB_BAR` zmienia się z `["home","tasks","shopping"]` na `["tasks","shopping"]`
(dom jest kotwicą). `resolveTabBar` odsiewa `home` — tak jak `resolveMenu` odsiewa go od 087.

### 5.2 `PasekKciuka` — renderowanie pozycji

- Przyjmuje `dalekie`/`bliskie` zamiast `pozycje: ModuleDef[]`; geometrię (dwa pojemniki `flex: 1`,
  środek, lustrzenie, minimum 44 × 44 px, większa ikona bliżej kciuka) **zostawiamy bez zmian** —
  to jest dokładnie ten kod, który run 100 doprowadził do porządku.
- Komponent `Pozycja` zostaje na **poziomie modułu** (nie w ciele `PasekKciuka`) — inaczej wraca
  błąd z run 100: nowy typ komponentu przy każdym renderze odmontowuje przyciski i gubi
  `setPointerCapture`. To samo dotyczy nowych komponentów pozycji.
- Kotwice rysujemy tymi samymi środkami co moduły: ikona `lucide-react` + etykieta 10 px,
  kolory wyłącznie ze zmiennych (`--text-muted`, `--accent-amber` dla zapisanej gwiazdki).
- **Gwiazdka** pokazuje stan bieżącego adresu (pełna/pusta) — czyta go tak jak dziś
  `FavoriteStarButton`: `window.location.pathname + search` w efekcie, **nie** `useSearchParams`
  (ten w powłoce wymusza granicę Suspense i potrafi zepchnąć całą aplikację w CSR — lekcja z 042).
- **Historia** przy pustej liście jest wyszarzona i `aria-disabled`, a tap pokazuje toast „nie ma
  dokąd wracać" (AC-13) — nigdy pusta warstwa.

### 5.3 `WachlarzNawigacji` — źródła i drugi poziom

```ts
export interface ZrodloWachlarza {
  /** Poziom 1 dla tej pozycji. Domyślnie: moduły (reguła run 100 dla pozycji modułowych). */
  pozycje?: () => PozycjaWachlarza[];
  /** Co robi KRÓTKIE tapnięcie. Domyślnie: nawigacja pod `href`. */
  naTap?: () => void;
  /** Czy dokleić stałą, ostatnią pozycję „Ustawienia paska" (tylko źródło domyślne). */
  ustawienia?: boolean;
}
uchwyty(href: string, zrodlo?: ZrodloWachlarza): UchwytyGestu
```

- Sygnatura `uchwyty(href)` **zostaje zgodna wstecz** (drugi argument opcjonalny), więc
  `uchwytyLinku()` w nawigacji bocznej i dzisiejsze wywołania nie wymagają zmian (C-53).
- **Stała ostatnia pozycja „Ustawienia paska"** (AC-23) doklejana jest w źródle domyślnym, po
  modułach, z adresem `/settings#menu`. Nie zajmuje slotu w pasku — uzasadnienie w spec §8.
- **Poziom 2** (`glebiej(idModulu)`) przenosi się z `AppShell` do funkcji, która scala:
  `szybkieCele` modułu → potem ulubione widoki tego modułu; **dedupe po `href`** (AC-18),
  pierwszeństwo ma wpis użytkownika (jego etykieta jest jego decyzją). Całość przez
  `filterAccessibleFavorites`.
- Puszczenie palca poza podpowiedzią zamyka gest bez nawigacji — bez zmian.
- Animacja pod `prefers-reduced-motion` — bez zmian (AC-26).

### 5.4 Historia odwiedzonych stron

- **Czysta logika:** `src/platform/nawigacja/historia.ts` — typ `WpisHistorii { sciezka, etykieta,
  czas }`, funkcje `dopisz(lista, wpis, limit)` (scala powtórzenie tej samej ścieżki pod rząd —
  AC-15), `odczytaj()` / `zapisz()` opakowane w `try/catch` (prywatne okno, wyłączone dane witryn —
  brak pamięci to **poprawny stan**, nie błąd; ta sama reguła co dla `localStorage` w powłoce).
  Limit: **12 wpisów**. Platforma nie zna modułów — **etykietę dostaje gotową**, parametrem.
- **Rejestrator:** `src/components/shell/useHistoriaNawigacji.ts` — hook w powłoce reagujący na
  zmianę `pathname`; etykietę składa z rejestru modułów (nazwa modułu) i `suggestFavoriteLabel`
  (ostatni czytelny segment), a gdy adres jest zapisany w ulubionych — bierze **etykietę
  użytkownika**.
- **Kolejność w wachlarzu:** najświeższa (poprzednia strona) **pierwsza**, czyli najbliżej palca —
  `rozlozNaLuku` układa listę od początku łuku, który zaczyna się przy kciuku (AC-11).
- Bieżąca strona **nie jest** pozycją historii (nie ma sensu „wróć tu, gdzie jesteś").
- Tap = `router.back()` (AC-14). Świadomie systemowy krok wstecz, a nie `push` poprzedniej pozycji:
  inaczej stos historii przeglądarki rósłby przy każdym powrocie.

### 5.5 Gwiazdka jako inteligentna ikona

- Wspólny hook `src/components/favorites/useUlubioneBiezacego.ts`: zwraca `{ zapisany, przelacz }`.
  `przelacz` woła `addFavoriteView` / `removeFavoriteViewByPath` w `useTransition`, po czym
  `router.refresh()` (powłoka dostaje ulubione z serwera), a wynik melduje toastem
  z nazwą widoku (AC-6/AC-7). Błąd (adres nie do zapisania, limit 30) → toast błędu, stan bez
  zmian (AC-9).
- **Bez `confirmDialog`** — czynność jest odwracalna tym samym tapnięciem (C-34 czytane wprost:
  potwierdzenie należy się rzeczom nieodwracalnym).
- `FavoriteStarButton` **zostaje bez zmian** dla komputera (`placement="chrome"`); z górnego paska
  telefonu znika jego instancja (AC-10). Wariant `topbar` zostaje w typie tylko wtedy, gdy ma
  konsumenta — jeśli nie ma, **usuwamy go** (martwe API we wspólnym komponencie jest gorsze niż
  jego brak — C-35 czytane w drugą stronę).

### 5.6 Szybkie cele modułu

`src/platform/registry.ts`:

```ts
export interface SzybkiCelModulu {
  id: string;            // unikalny w obrębie modułu
  etykieta: string;      // po polsku (C-32); tekst deklaracji, nie JSX — poza zakresem check:i18n
  href: string;          // MUSI mieścić się w `routes` modułu (bramka, patrz §8)
  Icon?: LucideIcon;
}
```
Pole `szybkieCele?: SzybkiCelModulu[]` w `ModuleDeclaration`. **Nie jest leniwe** i to jest
świadome: to czyste dane + ikona, czyli dokładnie to, co deklaracja już wozi (`Icon`, `label`,
`color`). Leniwość dotyczy pól wciągających **komponenty albo Prismę** (`sideNav`, `ai`, `jobs`) —
tu nie ma czego wciągać.

Cele deklarujemy **we wszystkich modułach** (22), po 2–5 pozycji. Nawigacyjne (istniejące
podstrony, zero kodu w module) — np. Zakupy → Mapy sklepów / Kategorie / Produkty; Kuchnia →
Przepisy / Plan / Spiżarnia; Zadania → Dziś / Zaległe / Tagi; Magazynowanie → Szukaj / Etykiety /
Przepływ. Akcyjne (`?akcja=…`) tam, gdzie moduł ma na stronie głównej gotowy formularz dodawania.

### 5.7 Akcje wyrażone adresem — jedna konwencja

`src/lib/nawigacja/akcjaZAdresu.ts`:

```ts
/** Czy adres prosi o tę akcję; `zamknij()` czyści parametr, żeby nie wracała przy odświeżeniu. */
export function uzyjAkcjiZAdresu(nazwa: string): { aktywna: boolean; zamknij: () => void };
```
Czyta `?akcja=<nazwa>`, a `zamknij()` robi `router.replace` bez tego parametru — dzięki temu adres
z akcją jest **favouritowalny i działa z linku** (AC-20), a zamknięcie formularza nie zostawia
widoku „zawieszonego" w stanie otwartego okna (ryzyko wypisane w spec §9).

**Pierwsi konsumenci (C-35 — mechanizm dowozimy z wpięciem, nie „na przyszłość"):**
`akcja=nowy-projekt` w Zadaniach (AC-19), `akcja=nowa-notatka` w Notatkach, `akcja=nowa-lista`
w Zakupach, `akcja=nowy-nawyk` w Nawykach, `akcja=nowy-kontakt` w Kontaktach. W każdym z tych
widoków istnieje już stan `isAdding`/odpowiednik — hook tylko podaje jego wartość początkową
i sprząta adres przy zamknięciu.

### 5.8 Ustawienia paska

`src/components/settings/MenuPrefsEditor.tsx`: sekcja dolnego paska dostaje `id="menu"` (cel
`/settings#menu`), nowy limit `MAKS_MODULOW_W_PASKU` i **zdanie wyjaśniające, czego usunąć się nie
da** — dom, asystent, ulubione i historia są kotwicami (AC-24). `home` znika z listy modułów
możliwych do dodania.

### 5.9 Motyw, teksty, dostępność

- **C-30:** zero hexów — wszystko przez `var(--…)`; tekst na akcencie przez `--on-accent`.
- **C-32:** wszystkie nowe teksty UI przez `useTranslations` + `messages/pl.json`
  (`components.shell.PasekKciuka`, `components.shell.WachlarzNawigacji`, nowy
  `components.shell.HistoriaNawigacji`). `check:i18n` jest **regułą absolutną** od 097 —
  literał z polskimi znakami w komponencie wywala build.
- **C-31:** `env(safe-area-inset-bottom)` zostaje; `main` ma `pb-16` (magiczna ikona wystaje 14 px).
- **AC-27:** każda kotwica ma `aria-label` mówiący **co robi** („Zapisz ten widok w ulubionych" /
  „Ulubione widoki"), gwiazdka dodatkowo `aria-pressed`, aktywny moduł `aria-current="page"`.

## 6. AI / integracje

**Nie dotyczy.** Magiczna ikona zachowuje miejsce i zachowanie (`openAssistant()`), żadnej nowej
`AIAction` ani read-toola — `check:actions` i `check:ai-coverage` bez zmian.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/platform/registry.ts` | edycja | typ `SzybkiCelModulu` + pole `szybkieCele` w deklaracji |
| `src/lib/modules.tsx` | edycja | `PozycjaPaska`, `MAKS_MODULOW_W_PASKU`, `pozycjePaska()`, `DEFAULT_TAB_BAR` bez `home`, `resolveTabBar` odsiewa `home` |
| `src/lib/__tests__/modules.test.ts` | nowy/edycja | testy składu paska (3 kotwice + 2 moduły, brak domu, brak uprawnień) |
| `src/platform/nawigacja/historia.ts` | nowy | czysta logika listy historii + odczyt/zapis `sessionStorage` |
| `src/platform/nawigacja/__tests__/historia.test.ts` | nowy | dedupe, limit, brak pamięci |
| `src/components/shell/useHistoriaNawigacji.ts` | nowy | rejestrator zmian adresu w powłoce |
| `src/components/shell/PasekKciuka.tsx` | edycja | pozycje o czterech rodzajach zamiast listy modułów |
| `src/components/shell/WachlarzNawigacji.tsx` | edycja | `ZrodloWachlarza`, stała pozycja „Ustawienia paska", poziom 2 ze scalenia |
| `src/components/shell/AppShell.tsx` | edycja | wpięcie: gwiazdka znika z górnego paska, rejestrator historii, źródła i scalanie poziomu 2 |
| `src/components/favorites/useUlubioneBiezacego.ts` | nowy | wspólny przełącznik „zapisz/usuń bieżący widok" |
| `src/components/favorites/FavoriteStarButton.tsx` | edycja | usunięcie wariantu `topbar`, jeśli zostaje bez konsumenta |
| `src/lib/nawigacja/akcjaZAdresu.ts` | nowy | konwencja `?akcja=…` + sprzątanie adresu |
| `src/modules/*/module.ts` (22) | edycja | `szybkieCele` |
| `src/modules/tasks/ui/TasksHomePage.tsx` | edycja | konsument `akcja=nowy-projekt` (AC-19) |
| `src/modules/notes/ui/*`, `src/modules/shopping/ui/*`, `src/modules/habits/ui/*`, `src/modules/contacts/ui/*` | edycja | pozostali konsumenci `?akcja=` |
| `src/components/settings/MenuPrefsEditor.tsx` | edycja | nowy limit, kotwice nieusuwalne, `id="menu"` |
| `src/actions/menuPrefs.ts` | edycja | przycięcie `tabBar` do nowego limitu, odsianie `home` |
| `messages/pl.json` | edycja | nowe teksty |
| `scripts/check-module-registry.js` | edycja | 9. kontrola: `szybkieCele` w granicach `routes` modułu i każdy moduł je ma |
| `src/lib/ui/perf-baseline.json` | edycja | podniesienie progu po pomiarze (patrz §9) |
| `doświadczenia.md` | edycja | wpis wg C-51, jeśli po drodze wyjdzie nieoczywisty problem |

## 8. Bramki i weryfikacja (C-50)

**Lokalnie** (C-13 — nigdy prod `DATABASE_URL`): lokalny Postgres 16, `.env.local` na `127.0.0.1`,
`npx prisma migrate deploy` (nic nowego do zaaplikowania). Weryfikujemy **do kroku `next build`** —
`scripts/migrate.js` rusza prawdziwą bazę.

Kolejność: `npm run check:module-registry` → `check:boundaries` → `check:i18n` → `check:logs` →
`check:ui-contract` → `check:test-types` → `npm run test:unit` → `next lint` → `next build` →
`check:perf`.

**Nowa, 9. kontrola w `check-module-registry.js`** (uzasadnienie: bez niej `szybkieCele` gnije
bezgłośnie — adres przestaje istnieć, a wachlarz nadal go pokazuje):
1. każdy moduł deklaruje **co najmniej jeden** szybki cel (inaczej AC-17 przestaje być prawdą przy
   pierwszym nowym module),
2. każdy `href` mieści się w `routes` tego modułu — cel prowadzący poza moduł to albo literówka,
   albo obejście granicy (C-36).

**Mapowanie AC → weryfikacja:**

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1, AC-2, AC-4 | test jednostkowy `pozycjePaska` (skład i kolejność dla obu rąk) + klikacz na 360 px |
| AC-3 | klikacz: `boundingBox()` każdej pozycji paska przy `viewport 360×740` — każdy wymiar ≥ 44 |
| AC-5 | test jednostkowy: brak uprawnień → kotwice zostają, moduły puste |
| AC-6, AC-7, AC-9 | klikacz: tap gwiazdki → toast + stan `aria-pressed`; drugi tap wraca; adres zewnętrzny/limit → toast błędu, stan bez zmian |
| AC-8, AC-11, AC-12, AC-15 | klikacz gestu (`pointerdown` → `pointermove` → `pointerup`) + test jednostkowy `dopisz()` |
| AC-10 | klikacz: brak gwiazdki w górnym pasku telefonu, obecna w pasku dolnym |
| AC-13 | klikacz: świeża sesja → tap historii → toast, brak warstwy |
| AC-14 | klikacz: przejście A → B → tap historii → adres A |
| AC-16, AC-22 | test jednostkowy filtra + klikacz na koncie o zawężonych uprawnieniach |
| AC-17, AC-18 | test jednostkowy scalania (moduł bez ulubionych → cele; z ulubionymi → suma bez duplikatów) |
| AC-19, AC-20 | klikacz: wybór „Nowy projekt" z wachlarza **oraz** wejście wprost pod `/tasks?akcja=nowy-projekt` — ten sam widok |
| AC-21 | klikacz: przytrzymanie dwóch różnych pozycji modułowych → identyczna lista |
| AC-23, AC-24 | klikacz: ostatnia pozycja wachlarza → `/settings#menu`; kotwic nie da się usunąć w edytorze |
| AC-25 | `check:ui-contract` (brak hexów) + przegląd kodu |
| AC-26 | przegląd: reguła `prefers-reduced-motion` zostaje |
| AC-27 | klikacz: `aria-label` / `aria-pressed` / `aria-current` obecne |

Klikacze w tym sandboxie: `nohup bash scripts/e2e-web.sh > /tmp/e2e.log 2>&1 &`
(`docs/e2e/uruchamianie-e2e-claude.md`). **Nigdy `networkidle`** — aplikacja trzyma otwarty strumień
zdarzeń, więc ten warunek nie nastąpi (`check:e2e-waits`).

## 9. Ryzyka techniczne i plan wycofania

- **Regresja gestu z run 100.** Trzy pułapki są opisane w nagłówkach `PasekKciuka` /
  `WachlarzNawigacji` i nie wolno ich naruszyć: komponent pozycji **na poziomie modułu** (inaczej
  odmontowanie gubi `setPointerCapture`), przechwycenie wskaźnika **dopiero przy otwarciu**
  (inaczej ginie przewijanie), magiczna ikona w **geometrycznym** środku (dwa pojemniki `flex: 1`).
  → Nowe pozycje przechodzą tą samą ścieżką co modułowe; klikacz gestu zostaje.
- **Budżet wydajnościowy (`check:perf`).** Kod trafia do **powłoki**, czyli do KAŻDEJ trasy — wzrost
  ponad pasmo ±5 % wywali bramkę. To wzrost **świadomy**, nie szum: mierzymy po `next build`
  i podnosimy `src/lib/ui/perf-baseline.json` **wraz z uzasadnieniem w opisie zmiany**. Jeśli wzrost
  okaże się nieproporcjonalny (> ~15 kB), wracamy do planu: rejestrator historii idzie do osobnego
  pliku ładowanego dynamicznie.
- **`sessionStorage` bywa niedostępny** (prywatne okno, zablokowane dane witryn, zrzut miniatury).
  → Każdy odczyt i zapis w `try/catch`; brak pamięci = historia pusta, nie wyjątek.
- **`?akcja=` w ulubionych.** Zapisany adres z akcją odtworzy formularz przy każdym wejściu.
  → `zamknij()` czyści parametr przez `router.replace`; zachowanie jest takie samo jak dla każdego
  innego stanu widoku w adresie (084/087).
- **Ucięcie `tabBar` u istniejących użytkowników.** Kto ma dziś 5 ikon, zobaczy 2 + kotwice.
  → To jest treść zgłoszenia (pasek ma się zmienić), a preferencja nie jest kasowana — nadmiarowe
  identyfikatory zostają w JSON-ie do czasu następnego zapisu i wrócą, gdyby limit kiedyś urósł.
- **Rollback:** wyłącznie **kodowy** (brak migracji) — `git revert` scalenia do `develop`. Historia
  siedzi w przeglądarce, więc nie zostawia stanu do posprzątania; ulubione i preferencje menu są
  sprzed zmiany i pozostają zgodne.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — brak zmian w schemacie, więc brak migracji; warunek na wypadek zmiany zapisany
      w §2 (ręczny plik, numer z `next:migration`, `String` + union).
- [x] **C-20..C-25** — nowych akcji nie ma; jedyna zmiana w `updateMenuPrefs` zostaje po stronie
      serwera z `revalidatePath`; guardy własności nietknięte; RBAC filtrowany w trzech nowych
      miejscach (§4); AI/trash/audit nie dotyczy.
- [x] **C-30..C-32** — zmienne CSS, mobile-first z celami ≥ 44 px i `safe-area`, wszystkie teksty
      przez `t()`.
- [x] **C-33** — `ModuleView` nietknięty; zmiana dotyczy powłoki, nie ramy widoku.
- [x] **C-34** — przełączenie ulubionego bez potwierdzenia, bo jest odwracalne; zero
      `window.confirm`.
- [x] **C-35** — `szybkieCele` i `uzyjAkcjiZAdresu` dowożone **z konsumentami** (22 deklaracje,
      5 widoków akcyjnych); martwy wariant `topbar` gwiazdki usuwany, a nie zostawiany.
- [x] **C-36** — moduł deklaruje szybkie cele w SWOJEJ jednej deklaracji; powłoka nie sięga do jego
      wnętrza; platforma (`historia.ts`) dostaje etykiety parametrem i nie zna modułów.
- [x] **C-53** — zero nowych zależności; sygnatura `uchwyty()` zgodna wstecz; geometria paska
      i mechanika gestu z run 100 zostają nietknięte.
