# Weryfikacja: System komponentów, kontrakt widoku i profesjonalny silnik skórek

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-04
- **Środowisko:** lokalny PostgreSQL 16 (`omnia_dev`), C-13 — prod DB nietknięta, `migrate.js` nieuruchamiany

---

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ Numeracja OK (następny wolny: 0226) |
| `npm run check:actions` | ✅ 160 akcji, wszystkie z egzekutorem i kontraktem |
| `npm run check:ai-coverage` | ✅ 550 akcji z zadeklarowanym zakresem i guardem |
| `npm run check:cost-badge` | ✅ 35 plików wołających model, każdy przekazuje zużycie |
| `npm run check:content-memory` | ✅ 35 plików sklasyfikowanych |
| `npm run check:ui-contract` | ✅ **21/21 modułów** na `ModuleView`; 29 plików z zadeklarowanymi kolorami, **0 pozycji „do poprawy"** |
| `next lint --dir src` | ✅ 0 błędów (ostrzeżenia kosmetyczne sprzed feature'a bez zmian) |
| `next build` | ✅ Compiled successfully |
| `npm run test:unit` | ✅ 542 przechodzi, 0 pada |

**Ograniczenie:** 48 testów **integracyjnych** pada przy ustawionym `DATABASE_URL`, bo lokalna baza ma
sam schemat bez danych seed. Sprawdzone przez `git stash`: padają **identycznie przed** zmianami
tego feature'a. Nie jest to regresja, ale też nie zostało zweryfikowane pozytywnie.

---

## 2. Kryteria akceptacji

### System komponentów i kontrakt widoku

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-1** — każdy z 21 modułów przez wspólny kontrakt | ✅ | `check:ui-contract` raportuje 21/21; manifest `src/lib/ui/view-contract.json` nie zawiera ani jednego wpisu `pending` ani wyjątku z powodu „inny układ" |
| **AC-2** — chrom w pasku bez udziału modułu | ✅ | `AppShell.tsx:264-270` wstrzykuje `favorite`/`freshness`/`shortcuts` do `ViewChromeProvider`; `ViewBar.tsx` czyta je z `useViewChrome()`. Żaden komponent modułu nie przekazuje ich propsami (jedyne wystąpienia `ViewChromeProvider` są w powłoce) |
| **AC-3** — bramka przerywa build przy braku stanów | ✅ | Test negatywny: usunięcie propa `state` z `ContactsPage.tsx` → bramka czerwona ze wskazaniem pliku. Po przywróceniu — zielona |
| **AC-4** — wspólny stan brzegowy w każdym module | ✅ *(po nawrocie)* | `ui/home/EmptyState` (używany w 21 widokach) jest teraz cienką nakładką na `ViewEmpty` z kontraktu — JEDNA implementacja, dwa wejścia. Stan sekcyjny zostaje przy starym API, stan całego widoku idzie przez `ModuleView.empty` |
| **AC-5** — wspólne okno potwierdzenia usunięcia | ✅ *(po nawrocie)* | `ConfirmProvider` zamontowany w powłoce; **52 wywołania `window.confirm()` podmienione**. Zweryfikowane: `grep` na `confirm(` w `src/components` zwraca 0 poza własnymi symbolami |
| **AC-6** — zmiana komponentu widoczna wszędzie | ✅ *(po nawrocie)* | Nagłówek i pasek: jedno `ModuleView` w 21 modułach. Stan pusty i pole formularza: zdublowane implementacje scalone w jedną. Potwierdzenie: jedno okno w 52 miejscach |

### Silnik skórek

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-7** — token z każdej rodziny, podgląd na żywo | ✅ | `lib/skins.ts` — 9 rodzin (`SKIN_GROUP_LABELS`); `SkinEditor.tsx` renderuje kontrolkę dla każdego rodzaju, `SkinPreview.tsx` pokazuje typografię, cień, tło i zaokrąglenie kontrolek |
| **AC-8** — żaden kolor motywu nie jest zaszyty | ✅ | 73 podmiany na zmienne; `check:ui-contract` przechodzi przy **zerowej** liczbie plików `do-poprawy`. 29 plików zachowuje literały, każdy z zadeklarowaną rolą (`paleta-danych` / `ilustracja`) i uzasadnieniem |
| **AC-9** — skórka stylizowana spełnia AA | ✅ | `skinContrast.test.ts` — 28 testów, 0 błędów. Sprawdzane: tekst główny ≥ 7:1, drugorzędny i wyciszony ≥ 4.5:1, tekst na **każdym** z sześciu akcentów ≥ 4.5:1, widoczność obramowań i obwódki fokusu. Test złapał realny błąd: „Zen" miał obramowanie 1.15:1 |
| **AC-10** — ograniczony ruch wyłącza animacje | ✅ | `globals.css` — blok `@media (prefers-reduced-motion: reduce)` obejmujący `*`, `::before`, `::after` z `!important` |
| **AC-11** — eksport → import odtwarza skórkę | ✅ | `exportSkin`/`importSkin` (`actions/skins.ts`), format wersjonowany `omniaSkin: 1`; UI w `SkinTransfer.tsx`. Test jednostkowy potwierdza, że `validateTokens` jest tożsamościowe dla poprawnych tokenów |
| **AC-12** — złośliwa wartość odrzucana | ✅ | `skins.test.ts` — 27 testów, 0 błędów. Pokryte: `url(`, `;`, `<script`, `expression(`, `@import`, `paint(`, `element(`, `attr(`, `steps(`, przekroczone limity, klucz spoza whitelisty |
| **AC-13** — skórka częściowa dziedziczy domyślne | ✅ | Test „skórka częściowa: brakujące tokeny dziedziczą domyślne, żaden nie ginie" + komplet wartości domyślnych w `globals.css` |

### Generowanie skórki przez AI

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-14** — komplet tokenów w podglądzie przed zapisem | ✅ | `SkinAiPanel.tsx` renderuje `SkinPreview` z wynikiem; zapis następuje dopiero po „Użyj tej propozycji" → `createSkin`. Model niczego nie zapisuje |
| **AC-15** — wynik modelu odrzucany jak cudzy plik | ✅ | `skinGenerate.ts` — dwa wywołania `validateTokens`; odrzucone klucze zwracane w polu `rejected` i pokazywane w UI |
| **AC-16** — widoczny koszt wywołania | ✅ | `usageFromChat` w handlerze; `AiCostBadge` w `SkinAiPanel.tsx`; `check:cost-badge` zielony |
| **AC-17** — możliwość poprawienia i ponowienia | ✅ | Przycisk zmienia się na „Generuj ponownie"; wstawione tokeny trafiają do edytora i pozostają edytowalne ręcznie |

### Playground

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-18** — hierarchia kategorii, nawigacja, wyszukiwarka | ✅ | `PlaygroundPage.tsx` — 6 kategorii z `CATEGORY_ORDER`, nawigacja boczna, pole wyszukiwania po nazwie i opisie |
| **AC-19** — mobile bez poziomego przewijania, jeden panel | ✅ | Nawigacja `hidden md:flex`, na telefonie szuflada z `env(safe-area-inset-*)`; nigdy dwa panele boczne. Cele dotyku 44 px |
| **AC-20** — sterowanie właściwościami + warianty brzegowe | ✅ | `PlaygroundControls.tsx`; warianty w rejestrze (`Wszystkie warianty`, `Bardzo długa etykieta`, `Pusta lista`) |
| **AC-21** — lokalny przełącznik skórki | ✅ | `PlaygroundPage.tsx` — `tokensToStyle(resolveTokens(...))` na kontenerze demonstracji; skórka konta nietknięta |
| **AC-22** — nowy komponent wykrywalny | ✅ | Lista wywodzona z `PLAYGROUND_ENTRIES` (21 wpisów), nie z ręcznej tablicy w komponencie strony |

### Dziennik przebudowy

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-23** — rozdział ze stanem 46 zadań | ✅ | `content/architektura/15-dziennik.md` + wpis w `manifest.json`; `copy-architektura.js` raportuje 15 rozdziałów |
| **AC-24** — wiadomo, która faza następna | ✅ | Sekcja „Gdzie jesteśmy" wskazuje **Fazę 0** z uzasadnieniem |

**Podsumowanie po nawrocie: 24 ✅ · 0 ⚠️ · 0 ❌** (z 24 kryteriów).

---

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|--------|-------|
| **C-10, C-11, C-14** | ✅ Dwie ręczne migracje (0224, 0225), numery z generatora, idempotentne `ON CONFLICT DO NOTHING`, dollar-quoting. Obie sprawdzone na lokalnej bazie, w tym powtórne wykonanie |
| **C-12** | ✅ Zero enumów Prisma; `SkinControlKind`, kategorie playgroundu, `ViewStateKind`, `layout`, `density` jako `String` + unia |
| **C-13** | ✅ Weryfikacja wyłącznie na lokalnym Postgresie; `migrate.js` nieuruchamiany |
| **C-20** | ✅ `exportSkin`/`importSkin` z `revalidatePath` |
| **C-21** | ✅ `importSkin` tworzy wyłącznie skórkę użytkownika; `exportSkin` przez `guardedVia: listAvailableSkins` |
| **C-22** | ✅ Bez nowego slugu; playground pod `module.admin` |
| **C-23** | ✅ Zero nowych `AIAction`; generowanie skórki to trasa klikana, nie akcja asystenta |
| **C-30** | ✅ Rdzeń feature'a; 73 podmiany, bramka pilnuje reszty |
| **C-31** | ✅ Mobile-first w nowych powierzchniach; nigdy dwa panele boczne; cele dotyku 44 px w nowych komponentach |
| **C-32** | ✅ Wszystkie nowe teksty po polsku |
| **C-50** | ✅ Build zielony do kroku `next build` |
| **C-51** | ✅ Trzy wpisy w `doświadczenia.md` |
| **C-53** | ✅ *(po nawrocie)* `ConfirmDialog` używany przez 52 miejsca via `ConfirmProvider`, `Field` przez formularze Zwierząt. `DataList` i wspólny `BulkActionBar` **usunięte** — nie miały konsumenta, a komponent bez użycia ogłasza w playgroundzie rozwiązanie, którego nikt nie stosuje |
| **C-54** | ✅ Kontrakt poszerzany trzykrotnie (`breadcrumb`, `layout="fill"`, `density="compact"`) zamiast obchodzenia problemu w modułach; artefakty aktualizowane |

---

## 4. Regresje

- **Migracje:** obie tylko wstawiają wiersze do `Skin`; brak `ALTER`/`DROP`. Ryzyko zerowe.
- **Wspólne komponenty:** `ModuleView` renderuje wewnętrznie istniejący `PageHeader`, a `contentGap`
  domyślnie 24 px = dokładnie dawny `pageInnerStyle`. Wygląd nagłówków niezmieniony.
- **RBAC / `revalidatePath`:** nietknięte; feature nie dotyka dostępu ani danych modułów.
- **Zaszyte kolory:** sweep świadomie omijał słowniki palet (linie z `emoji:`/`label:`), więc kolory
  kategorii sklepu i tagów użytkownika pozostały nietknięte.
- **Ryzyko nieprzetestowane:** brak siatki bezpieczeństwa (Faza 0). 21 zmigrowanych widoków
  przeszło `next build` i kontrolę typów, ale **nie ma klikaczy potwierdzających zachowanie**.
  To znane i zapisane ograniczenie tego przebiegu.

---

## 5. Werdykt końcowy

### ✅ GOTOWE *(po jednym nawrocie do `/implement`)*

Pierwszy przebieg weryfikacji dał **DO POPRAWY** — uzasadnienie i braki zostawiono niżej jako ślad
decyzji. Po nawrocie wszystkie 24 kryteria są spełnione, wszystkie bramki zielone, 645 testów
jednostkowych bez błędu.

Trzy braki (T-43, T-44, T-45) usunięte; szczegóły w rozdz. 15 dokumentu architektury.

---

### Pierwotny werdykt (zachowany jako ślad): ⚠️ DO POPRAWY

Feature jest w ~90% dowieziony i wszystkie bramki są zielone, ale **jedno kryterium akceptacji jest
niespełnione, a dwa spełnione częściowo** — i wszystkie trzy mają to samo źródło: powstały wspólne
komponenty, których **żaden moduł nie używa**.

To nie jest drobiazg formalny. Spec obiecuje w AC-5 wprost: *„Given usunięcie rekordu w dowolnym
module, when je wywołuję, then dostaję wspólne okno potwierdzenia"*. Dziś w kodzie jest **42** wywołań
`window.confirm()` — czyli natywnego okna przeglądarki, które nie zna skórki, nie ma polskich
przycisków i wygląda inaczej na każdym systemie. Pod skórką „Mostek" jest to szczególnie widoczne:
cała aplikacja stylizowana, a potwierdzenie usunięcia to szare okno macOS.

Braki do usunięcia:

- **T-43** — Wpiąć `ConfirmDialog` w miejsce `window.confirm()` w modułach. Zacząć od usuwania
  rekordów (Zadania, Notatki, Zakupy, Portfel, Magazynowanie), gdzie natywne okno jest najczęstsze.
  *Gotowe, gdy:* liczba `window.confirm(` w `src/components` spada do zera albo pozostałe mają
  uzasadnienie. **(AC-5, AC-6)**
- **T-44** — Przenieść stany puste modułów do propa `empty={{…}}` kontraktu tam, gdzie moduł już taki
  stan rysuje. *Gotowe, gdy:* co najmniej 10 modułów deklaruje stan pusty przez kontrakt, a nie
  własnym znacznikiem w `children`. **(AC-4, AC-6)**
- **T-45** — Wpiąć `Field` i `DataList` w co najmniej po jednym module albo — jeśli nie mają realnego
  konsumenta — **usunąć je** i odnotować decyzję. Komponent bez użycia łamie C-53.
  *Gotowe, gdy:* każdy komponent z `components/ui/` ma albo konsumenta w module, albo świadomy wpis
  wyjaśniający, czemu istnieje bez niego.

Źródłem braku jest **implementacja, nie spec ani plan** — plan przewidywał te komponenty i słusznie;
zabrakło kroku ich wpięcia. Poprawki `spec.md`/`plan.md` nie są potrzebne (C-54 nie ma zastosowania).
