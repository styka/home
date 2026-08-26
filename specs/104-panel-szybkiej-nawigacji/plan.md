# Plan techniczny: Panel szybkiej nawigacji zamiast łukowego wachlarza

- **Spec:** ./spec.md (104-panel-szybkiej-nawigacji)
- **Status:** draft
- **Data:** 2026-08-26

## 1. Podejście

Trzy ruchy, w tej kolejności — bo drugi ma sens dopiero po pierwszym, a trzeci po drugim:

1. **Odbieramy gest ikonom paska.** `PasekKciuka` przestaje wołać `uchwyty(...)` dla pozycji
   modułowych i domu; zostaje zwykły `onClick` z `router.push`. Razem z gestem znika `touch-action:
   none` — inaczej pasek nadal zjadałby przewijanie rozpoczęte na ikonie (AC-4), a to jest właśnie
   ten rodzaj resztki, który zostaje po usuniętej funkcji i objawia się jako „coś tu nie działa".
2. **Dokładamy szóstą kotwicę** — szybką nawigację — i **poprawiamy błąd o jeden** w wyliczeniu
   sufitu pozycji (`MAKS_MODULOW_W_PASKU` zostaje 2, ale komentarz twierdzący, że sufit to pięć
   pozycji, jest nieprawdziwy: 292 px / 6 = 48,7 px ≥ 44 px).
3. **Zastępujemy łukowy wachlarz panelem** i **kasujemy** `WachlarzNawigacji` z całej aplikacji.

**Wzorzec do naśladowania jest w repo i nie trzeba go wymyślać:** `AnchoredLayer`
(`components/ui/AnchoredLayer.tsx`, 080) — portal do `body` (więc żaden przodek z `overflow: hidden`
go nie przytnie), **pion liczony z odbiciem** przy braku miejsca, `maxHeight` wyliczany do krawędzi
okna (to jest gotowe AC-17), zamykanie `Esc` i kliknięciem poza (AC-15), zwrot ogniskowania.
Konsumenci do podejrzenia: `FiltrTagow` (Zadania) i `SourceFilter` (Wiadomości) — oba to „jeden
przycisk + panel z wyszukiwarką", czyli dokładnie nasz przypadek.

Panel jest **jednym komponentem z dwoma sekcjami** („Ostatnie" + moduły), a nie dwoma panelami:
właściciel wybrał wariant, w którym cała szybka nawigacja mieszka w jednym miejscu.

## 2. Model danych (Prisma)

**Bez zmian w schemacie i bez migracji** — tak samo jak w run 103 i z tych samych powodów:

- skład paska → istniejący `UserMenuPref.tabBar` (nowa kotwica jest **stała**, nie konfigurowalna),
- ręka → istniejący `UserMenuPref.handedness`,
- cele modułów → deklaracje `szybkieCele` z run 103 (22 moduły, dane w kodzie),
- historia → `sessionStorage` (`platform/nawigacja/historia.ts`).

`check:migrations` i `check:schema-drift` mają przejść **bez nowego katalogu migracji**; sprawdzamy
to na starcie, żeby zielone na końcu nie było zasługą stanu zastanego (C-10..C-13).

## 3. Warstwa serwera (Server Actions — C-20)

**Nowych akcji nie ma.** Panel wyłącznie **czyta** to, co powłoka i tak dostaje z serwera
(`favoriteViews`, `menuPrefs`, uprawnienia) i nawiguje. Jedyna zmiana po stronie serwera to tekst
opisu w `updateMenuPrefs`/`MenuPrefsEditor` — bez zmiany zachowania, więc `revalidatePath` i guardy
zostają nietknięte.

## 4. RBAC / rejestr modułu (C-22)

- **Nowego sluga nie ma.**
- **Trzy powierzchnie panelu** muszą przejść przez ten sam filtr, co reszta powłoki, inaczej panel
  staje się obejściem RBAC:
  1. lista modułów → `resolveMenu(userPermissions, menuPrefs).enabled` (już przefiltrowana),
  2. cele modułu → `celeGlebiej(...)` z run 103, który w środku woła
     `filterAccessibleFavorites(…, isPathLocked)`,
  3. sekcja „Ostatnie" → ten sam `filterAccessibleFavorites`, stosowany **przy odczycie**.
- Kotwica domu nadal zależy od `isPathLocked("/")`.

## 5. UI (C-30, C-31, C-32)

### 5.1 Skład paska — szósta kotwica i poprawka arytmetyki

`src/lib/modules.tsx`:

```ts
export type PozycjaPaska =
  | { rodzaj: "modul"; modul: ModuleDef }
  | { rodzaj: "dom" }
  | { rodzaj: "ulubione" }
  | { rodzaj: "nawigacja" }   // ← nowa
  | { rodzaj: "historia" };
```

`pozycjePaska` zwraca `bliskie = [{ulubione}, {nawigacja}, {historia}]` — kolejność „od środka na
zewnątrz", więc po lustrzeniu (`stronyPaska`) historia ląduje w rogu pod kciukiem, a między nią
a gwiazdką staje nawigacja. Dokładnie to, o co poprosił właściciel.

**Poprawka komentarza (C-54):** dotychczasowy tekst przy `MAKS_MODULOW_W_PASKU` twierdzi, że szósta
pozycja zeszłaby do ~41 px. To jest pomyłka o jeden — 41,7 px wypada dopiero przy **siedmiu**
pozycjach. Komentarz dostaje prawdziwe liczby (6 × 48,7 px) i wprost zapisane, gdzie jest realny
sufit. Wartość `MAKS_MODULOW_W_PASKU = 2` **nie zmienia się**: szóste miejsce idzie na kotwicę, nie
na trzeci moduł (decyzja odnotowana w specu §8).

### 5.2 `PasekKciuka` — koniec gestu na modułach

- `PozycjaModulu` i kotwica „dom": zwykły `<button onClick={() => router.push(href)}>`, **bez**
  `uchwyty(...)`, **bez** `touchAction: "none"`, **bez** `onContextMenu`.
- Komponenty pozycji zostają na **poziomie modułu** — powód z run 100 (nowy typ komponentu przy
  każdym renderze odmontowuje przyciski) przestaje dotyczyć gestu, ale nadal dotyczy ogniskowania
  i stanu, więc nie ma powodu tego cofać.
- Podpisy zostają (AC-8): jeden krótki wyraz, `overflow: hidden` + `textOverflow: ellipsis` +
  `whiteSpace: nowrap`, żeby przy 49 px nie zawinęły się do drugiego wiersza i nie rozepchnęły paska.

### 5.3 Panel szybkiej nawigacji — nowy komponent

`src/components/shell/PanelNawigacji.tsx` (klient), otwierany z kotwicy „nawigacja":

- Rysowany przez `AnchoredLayer` z `side="gora"`, `align="srodek"`, `role="dialog"`, szerokość
  `min(360px, 100vw - 16px)`. Wysokość ogranicza sam `AnchoredLayer` (`maxHeight` do krawędzi okna),
  a lista dostaje `overflowY: auto` — razem daje to AC-17 bez liczenia czegokolwiek ręcznie.
- **Zawartość, w kolejności:**
  1. **pole wyszukiwania** (autofocus), 
  2. **„Ostatnie"** — do 5 pozycji historii, **pomijane gdy puste**,
  3. **„Ulubione"** — zapisane widoki użytkownika, **pomijane gdy puste**. Sekcja jest tu, bo
     skasowanie wachlarza zabrało gwiazdce jej listę (run 103 AC-8), a lista musi mieć wejście;
     gwiazdka zachowuje swoją czynność (tap = zapisz/odpisz bieżący widok), więc traci tylko gest.
  4. **lista modułów** — wiersz na moduł: ikona w kolorze modułu + nazwa + strzałka rozwinięcia
     (`aria-expanded`); tapnięcie **rozwija cele pod spodem** (AC-11), tapnięcie w nazwę modułu
     w wierszu nagłówka przechodzi do modułu.
- **Wyszukiwanie** filtruje **moduły i cele naraz** (AC-13): przy niepustej frazie lista spłaszcza
  się do wyników `„<Moduł> — <Cel>"`, więc widać przynależność. Dopasowanie bez uwzględniania
  wielkości liter i **bez znaków diakrytycznych** (`localeCompare`/`normalize("NFD")`), bo „zalegle"
  ma znaleźć „Zaległe" — inaczej wyszukiwarka działa tylko dla osób piszących z ogonkami.
- Wybór pozycji: `onClose()` + `router.push(href)`.
- **Rozwinięty moduł to stan lokalny panelu**, kasowany przy zamknięciu — panel ma się otwierać
  zawsze tak samo, a nie pamiętać, co ktoś rozwinął tydzień temu.

### 5.4 „Wstecz"

- Tapnięcie → `router.back()` (AC-18); przy pustej historii → toast „nie ma dokąd wracać" (AC-19).
- **Zero gestu** (AC-20) — pełna lista mieszka w panelu jako sekcja „Ostatnie".

### 5.5 Usunięcie łukowego wachlarza

- Kasujemy `src/components/shell/WachlarzNawigacji.tsx` w całości.
- `AppShell`: znika `<WachlarzNawigacji>` opakowujące powłokę oraz propsy `pozycje`/`glebiej`/
  `ustawieniaPaska`/`reka` do niego.
- `ModuleSidebar`: znika `uchwytyLinku()` — pozycje wracają do bycia zwykłymi `<Link>` (AC-22).
- Ginie też `PozycjaWachlarza` jako typ eksportowany z tamtego pliku; panel ma własny, prostszy
  kształt pozycji (`CelGlebiej` z `lib/nawigacja/celeModulu.ts` już go opisuje).
- **„Ustawienia paska" nie znikają razem z wachlarzem** — przenoszą się do panelu jako ostatnia
  pozycja (stopka panelu), bo to było jedyne ich wejście z paska.

### 5.6 Motyw, teksty, dostępność

- **C-30:** kolory wyłącznie ze zmiennych; kolor modułu bierzemy z `ModuleDef.color`.
- **C-32:** nowe teksty w `messages/pl.json` pod `components.shell.PanelNawigacji`.
- **C-31:** panel respektuje dolny bezpieczny margines; cele dotyku w liście ≥ 44 px wysokości.
- **AC-24:** panel `role="dialog"` + `aria-label`; wiersz modułu `aria-expanded`; kotwica
  `aria-haspopup="dialog"` i `aria-expanded`.

## 6. AI / integracje

**Nie dotyczy.** Magiczna ikona bez zmian, zero nowych `AIAction` — `check:actions` bez ruchu.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/lib/modules.tsx` | edycja | `PozycjaPaska` + `nawigacja`; `pozycjePaska` zwraca trzy kotwice bliskie; poprawka komentarza o sufit |
| `src/lib/__tests__/pasekKciuka.test.ts` | edycja | sześć pozycji, kolejność ulubione → nawigacja → historia, lustrzenie obu rąk |
| `src/components/shell/PanelNawigacji.tsx` | **nowy** | panel: wyszukiwarka + „Ostatnie" + moduły rozwijane w miejscu + ustawienia paska |
| `src/lib/nawigacja/szukajCelow.ts` | **nowy** | czyste filtrowanie modułów i celów po frazie (bez diakrytyków) — testowalne bez Reacta |
| `src/lib/nawigacja/__tests__/szukajCelow.test.ts` | **nowy** | dopasowanie bez ogonków, przynależność wyniku do modułu, pusty wynik |
| `src/components/shell/PasekKciuka.tsx` | edycja | koniec gestu na modułach i domu; nowa kotwica; podpisy przycinane |
| `src/components/shell/PasekKciukaPolaczony.tsx` | edycja | wpięcie panelu (stan otwarcia), dane dla niego |
| `src/components/shell/AppShell.tsx` | edycja | usunięcie `WachlarzNawigacji` z drzewa i jego danych |
| `src/components/shell/ModuleSidebar.tsx` | edycja | usunięcie `uchwytyLinku()` — zwykłe `<Link>` |
| `src/components/shell/WachlarzNawigacji.tsx` | **usunięcie** | zastąpiony panelem (C-35 w drugą stronę) |
| `src/components/settings/MenuPrefsEditor.tsx` | edycja | opis kotwic o jedną więcej |
| `messages/pl.json` | edycja | teksty panelu i nowej kotwicy |
| `e2e/specs/dolny-pasek-kotwice.spec.ts` | edycja | AC-1..AC-4, AC-5/AC-6 (sześć pozycji), AC-9..AC-15, AC-20, AC-21 |
| `e2e/specs/ergonomia-nawigacji.spec.ts` | edycja | testy gestu z run 100 dotyczące wachlarza — usunięte razem z mechanizmem |
| `doświadczenia.md` | edycja | wpis wg C-51, jeśli wyjdzie nieoczywisty problem |

## 8. Bramki i weryfikacja (C-50)

Lokalnie, na **lokalnym** Postgresie (C-13 — nigdy prod), do kroku `next build` włącznie.
Kolejność: `check:migrations` → `check:schema-drift` → `check:module-registry` → `check:boundaries`
→ `check:i18n` → `check:ui-contract` → `check:logs` → `check:test-types` → `test:unit` →
`next lint` → `next build` → `check:perf`.

**Uwaga do `check:perf`:** usuwamy `WachlarzNawigacji` (425 linii) i dokładamy panel — bilans
powinien wyjść neutralnie lub na plus. Bramka ma pasmo ±5 % **w obie strony**, więc **spadek też ją
wywali**; jeśli spadnie poniżej pasma, próg trzeba obniżyć (i to jest właściwy kierunek — zapadka
istnieje po to, żeby postęp został zapisany).

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1..AC-3 | klikacz: tap i długie przytrzymanie na ikonie modułu / domu → nawigacja, `role="dialog"` nieobecny |
| AC-4 | klikacz: brak `touch-action: none` na pozycjach paska (odczyt stylu) |
| AC-5..AC-7 | test jednostkowy `pozycjePaska`/`stronyPaska` + klikacz mierzący środki sześciu pozycji |
| AC-8 | klikacz: wysokość paska niezmieniona, `white-space: nowrap` na podpisie |
| AC-9..AC-12 | klikacz: tap kotwicy → panel; rozwinięcie modułu; wybór celu → adres |
| AC-13 | test jednostkowy `szukajCelow` + klikacz wpisujący frazę bez ogonków |
| AC-14 | klikacz: po odwiedzeniu dwóch stron sekcja „Ostatnie" zawiera poprzednią |
| AC-14a/AC-14b | klikacz: zapisany widok widoczny w sekcji „Ulubione"; przy pustych źródłach brak nagłówków |
| AC-15 | klikacz: `Esc` i klik poza panelem zamykają bez nawigacji |
| AC-16 | test jednostkowy filtra + przegląd trzech powierzchni |
| AC-17 | klikacz: wysokość panelu ≤ wysokość okna, lista ma własne przewijanie |
| AC-18..AC-20 | klikacz: krok wstecz, komunikat przy pustej historii, brak warstwy po przytrzymaniu |
| AC-21 | `grep` na całym drzewie: brak `WachlarzNawigacji` i brak pliku + klikacz na telefonie i komputerze |
| AC-22 | klikacz: pozycje panelu bocznego nawigują kliknięciem |
| AC-23 | klikacz: edytor menu nadal daje dwa miejsca modułowe |
| AC-24 | klikacz: `aria-haspopup`, `aria-expanded`, `role="dialog"` |
| AC-25 | `check:ui-contract` + przegląd |

Klikacze: `nohup bash scripts/e2e-web.sh --project=desktop <specy> > /tmp/e2e.log 2>&1 &`.
**Nigdy `networkidle`** (`check:e2e-waits`). Znane, **zastane** niepowodzenia (Wiadomości/lektor
przy braku sieci; rywalizacja `favorites.spec` ↔ `view-state.spec` o wspólne konto) są udowodnione
na commicie bazowym w run 103 — nie traktujemy ich jako regresji tej zmiany.

## 9. Ryzyka techniczne i plan wycofania

- **Usunięcie wachlarza dotyka nawigacji bocznej na komputerze** (`uchwytyLinku`). → AC-22
  i klikacze panelu bocznego; zmiana jest odejmowaniem, nie przepisywaniem: `<Link>` wraca do
  zachowania sprzed run 100.
- **`AnchoredLayer` był dotąd używany wewnątrz treści, nie przy pasku przyklejonym do dołu.** Panel
  otwiera się w górę od kotwicy stojącej nad `env(safe-area-inset-bottom)`. → `side="gora"` z
  odbiciem i `maxHeight` liczonym przez komponent; sprawdzone klikaczem przy 360 × 640 (niski ekran).
- **Panel z 22 modułami i rozwiniętymi celami przerośnie ekran.** → `overflowY: auto` na liście
  + przycięta sekcja „Ostatnie" (5 pozycji).
- **Wyszukiwarka na telefonie podnosi klawiaturę i zasłania panel.** → Panel kotwiczy się do paska
  i ma `maxHeight` liczony z aktualnej wysokości okna; `AnchoredLayer` przelicza pozycję na
  `resize`, a klawiatura zmienia rozmiar okna wizualnego. Sprawdzić klikaczem z fokusem w polu.
- **Spadek poniżej pasma `check:perf`** — patrz §8; obniżamy próg, nie tłumimy bramki.
- **Rollback:** wyłącznie kodowy (`git revert`), brak migracji i brak stanu do posprzątania.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — brak zmian schematu, brak migracji; potwierdzone bramką na starcie.
- [x] **C-20..C-25** — zero nowych akcji; RBAC filtrowany w trzech powierzchniach panelu;
      AI/trash/audit nie dotyczy.
- [x] **C-30..C-32** — zmienne CSS, cele dotyku ≥ 44 px, safe-area, wszystkie teksty przez `t()`.
- [x] **C-33** — `ModuleView` nietknięty; zmiana dotyczy powłoki.
- [x] **C-34** — brak nowych potwierdzeń; zero `window.confirm`.
- [x] **C-35 czytane w OBIE strony** — nowy panel dowożony z konsumentem, a zastąpiony mechanizm
      **usuwany**, nie zostawiany „na wszelki wypadek".
- [x] **C-36** — panel mieszka w powłoce i dostaje wiedzę modułową parametrem; `platform/nawigacja`
      nadal nie zna modułów.
- [x] **C-53** — zero nowych zależności; panel na istniejącym `AnchoredLayer`, nie na własnej warstwie.
- [x] **C-54** — błędny komentarz o sufit pozycji z run 103 poprawiany w kodzie, a spec 103 dostaje
      przypis, że jego AC-3 zastąpiło AC-6 z tego przebiegu.
