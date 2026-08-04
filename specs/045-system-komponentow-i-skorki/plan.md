# Plan techniczny: System komponentów, kontrakt widoku i profesjonalny silnik skórek

- **Spec:** ./spec.md (045-system-komponentow-i-skorki)
- **Status:** draft
- **Data:** 2026-08-04

> **Zasada planu:** to jest **JAK**. Plan pisze się pod istniejący kod — najpierw czytamy sąsiedni
> moduł i naśladujemy jego wzorzec (C-53), potem projektujemy.

---

## 1. Podejście

**Wzorcem nie jest moduł, tylko istniejąca warstwa wspólna `src/components/ui/home/`** — `PageHeader`
jest już używany w ~30 komponentach stron, a `EmptyState`/`LoadingState` w 25. Nie budujemy więc
systemu komponentów od zera: **podnosimy istniejący do rangi kontraktu widoku** i dociągamy do niego
resztę. To najmniejsza możliwa droga do celu (C-53) i jedyna, która nie tworzy trzeciego równoległego
wzorca nagłówka.

Trzy filary, w tej kolejności:

1. **`ModuleView` + `ViewBar`** — nowa rama widoku w `src/components/ui/view/`, wewnętrznie
   renderująca dotychczasowy `PageHeader` (żeby migracja modułu była podmianą opakowania, nie
   przepisaniem nagłówka). Elementy należące do powłoki (gwiazdka ulubionych, świeżość danych,
   ściągawka skrótów) wstrzykiwane **kontekstem z `AppShell`**, a nie propsami modułu — moduł o nich
   nie wie, co jest całą istotą kontraktu widoku (rozdz. 10.5).
2. **Silnik skórek** — `Skin.tokens` to już `String` z JSON-em, więc **rozszerzenie tokenów nie
   wymaga zmiany schematu**. Cała praca to nowe rodziny tokenów + ich sanityzacja w
   `src/lib/skins.ts` i konsumpcja w `globals.css`.
3. **Playground** przepisany na rejestrze — lista komponentów **wywodzona z rejestru**, nie z ręcznej
   tablicy, żeby AC-18 („nowy komponent bez wpisu jest wykrywalny") był faktem, a nie obietnicą.

Migracja 21 modułów idzie **po tych filarach**, moduł po module, osobnymi commitami, bez zmiany
zachowania.

### Dlaczego kontekst, a nie renderowanie paska w `AppShell`

`AppShell` renderuje `<main>{children}</main>` i **nie zna tytułu modułu** — to jest dokładnie powód,
dla którego w 043 nie dało się umieścić gwiazdki w pasku widoku (komentarz w
`src/components/favorites/FavoriteStarButton.tsx` opisuje to wprost). Gdyby pasek rysował `AppShell`,
w ~20 modułach powstałyby **podwójne nagłówki**. Rozwiązanie: powłoka **udostępnia zawartość**
(`ViewChromeProvider`), a rysuje ją `ModuleView` osadzony w stronie modułu. Odwrócenie zależności
kosztuje jeden kontekst i usuwa dług.

---

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** `Skin.tokens String @default("{}")` przechowuje dowolną mapę
`{ "--zmienna": "wartość" }`, a `readActiveSkin` → `tokensToStyle` aplikuje ją inline na `<html>`.
Nowe rodziny tokenów to **wyłącznie** rozszerzenie whitelisty w `src/lib/skins.ts` — zero DDL.

### Migracja (C-10, C-11) — tylko seed skórek flagowych

- Numer (policzony z `prisma/migrations`, max = 0223): **`0224`**
- Katalog: `prisma/migrations/0224_skorki_flagowe/migration.sql`
- Treść: dwa idempotentne `INSERT INTO "Skin" … ON CONFLICT ("id") DO NOTHING` ze **stałymi id**
  (wzorem istniejącego `SYSTEM_DARK_SKIN_ID = "skin-system-dark"`), `isSystem = true`,
  `ownerId = NULL`, `ownerTeamId = NULL`, `tokens` = dollar-quoted JSON (`$tokens$…$tokens$`),
  `createdAt/updatedAt = CURRENT_TIMESTAMP`.
- Id skórek: `skin-system-mostek`, `skin-system-papier`.
- **`ON CONFLICT ("id") DO NOTHING`**, nie `DO UPDATE` — właściciel mógł skórkę systemową
  zmodyfikować, a migracja nie ma prawa cofnąć jego zmian. Poprawki tokenów w kolejnych przebiegach
  idą osobną, świadomą migracją.
- Statusy/rodzaje: brak nowych kolumn, więc **C-12 bez zastosowania** po stronie bazy; w TS wszystkie
  nowe rodzaje (`SkinTokenKind`, `PlaygroundCategory`, `ViewStateKind`) to `String` + unia (C-12).

---

## 3. Warstwa serwera (Server Actions — C-20)

Zmiany są **minimalne** — silnik skórek stoi na istniejących akcjach.

| Plik | Zmiana |
|------|--------|
| `src/actions/skins.ts` | Bez zmian w sygnaturach `createSkin`/`updateSkin`/`setActiveSkin`/`deleteSkin` — walidacja tokenów i tak przechodzi przez `validateTokens()`, które rozszerzamy. Dokładamy **dwie** funkcje: `exportSkin(id): Promise<string>` (JSON do pobrania) i `importSkin(json: string, name?): Promise<string>` (tworzy skórkę użytkownika z zwalidowanych tokenów). Obie kończą `revalidatePath("/settings")` + `revalidatePath("/admin/skins")`. |

- **Guard dostępu (C-21):** bez nowego guardu. `updateSkin`/`deleteSkin`/`duplicateSkin` już
  sprawdzają własność (`ownerId`/`ownerTeamId`, `isSystem` tylko dla admina) — `importSkin` tworzy
  **zawsze** skórkę użytkownika (`ownerId = session.user.id`, `isSystem = false`), więc nie otwiera
  nowej ścieżki podniesienia uprawnień. `exportSkin` przepuszcza tylko skórki, które użytkownik i tak
  widzi przez `listAvailableSkins()`.
- **Krytyczne dla bezpieczeństwa (AC-12):** `importSkin` **nigdy** nie ufa wejściu — przepuszcza je
  przez `validateTokens()`, które odrzuca klucz spoza whitelisty i wartość niezgodną z rodzajem.
  Nazwa skórki przycinana do rozsądnej długości i traktowana jak zwykły tekst (React ją escapuje).
- **Manifest pokrycia AI (bramka `check:ai-coverage`):** każda nowa akcja musi dostać wpis w
  `src/lib/ai/action-coverage.json` — klasyfikacja ekspozycji AI (`excluded`, powód: „ustawienie
  wyglądu, nie dane użytkownika") oraz `access: "owner"` z faktycznym guardem w ciele. **Bez tego
  build padnie.**

---

## 4. RBAC / rejestr modułu (C-22)

**Bez nowego slugu uprawnień.**

- Playground zostaje pod `/admin/playground`, czyli pod `module.admin` — bez zmian w
  `src/lib/permissions.ts`, `src/lib/modules.tsx`, `ModuleSidebar`.
- Edytor skórki działa tam, gdzie dziś: `/settings` (skórki użytkownika) i `/admin/skins` (systemowe).
- `ModuleView` **nie wprowadza** własnej kontroli dostępu — strony nadal robią to, co robiły. Stan
  „brak dostępu" w kontrakcie widoku jest **prezentacją**, nie bramką; realny guard zostaje w akcjach
  i stronach (C-21).

---

## 5. UI (C-30, C-31, C-32)

### 5.1. Kontrakt widoku — `src/components/ui/view/`

```
src/components/ui/view/
├─ ModuleView.tsx        rama: nagłówek + ViewBar + treść + stany brzegowe
├─ ViewBar.tsx           pasek widoku: filtry modułu | akcje modułu | chrom powłoki
├─ ViewChrome.tsx        kontekst: co powłoka wstrzykuje do paska
├─ ViewState.tsx         EmptyState / LoadingState / ErrorState / NoAccessState — jeden zestaw
└─ index.ts
```

**Kształt API** (moduł deklaruje, powłoka rysuje):

```tsx
<ModuleView
  icon={<ListTodo size={20} />}
  iconColor="var(--accent-blue)"
  title="Zadania"
  subtitle="Projekt: Dom"
  href="/tasks"
  filters={<TaskFilters … />}     // lewa strona paska widoku
  actions={<TaskActions … />}     // prawa strona paska widoku
  state={state}                   // "ready" | "empty" | "loading" | "error" | "no-access"
  empty={{ message: "Brak zadań", hint: "…", cta: { label: "Dodaj", onClick } }}
  resource={{ type: "tasks.project", id: projectId }}   // ZAREZERWOWANE — patrz 5.2
>
  {children}
</ModuleView>
```

- `state` + `empty`/`error` to **jedyny** sposób renderowania stanów brzegowych — realizuje AC-3/AC-4
  i daje bramce co sprawdzać.
- `ModuleView` wewnętrznie renderuje istniejący `PageHeader`, więc migracja modułu = zamiana
  `<PageHeader …/>` + ręcznego kontenera na `<ModuleView …>`. Wygląd nagłówka **się nie zmienia** —
  to warunek „zero zmian zachowania".

### 5.2. `resource` — świadomie zarezerwowany

Prop `resource` jest w typie **od początku**, ale w tym przebiegu **nic nie robi** (poza przekazaniem
do kontekstu). Powód: okno konfliktu, udostępnianie i obecność są poza zakresem (Faza 2/4), a
dołożenie ich później ma nie wymagać dotykania 21 modułów — dokładnie o to chodzi w rozdz. 10.5.
Odnotowane, żeby recenzja nie uznała tego za martwy kod.

### 5.3. Chrom powłoki w pasku widoku

`AppShell` renderuje `<ViewChromeProvider value={{ favoriteButton, freshness, shortcutsButton }}>`
wokół `<main>`. `ViewBar` czyta kontekst i renderuje to, co dostał; brak providera (np. w
playgroundzie) = pasek bez chromu, bez błędu.

Trzy elementy chromu:

| Element | Skąd | Uwaga |
|---------|------|-------|
| Gwiazdka „zapisz widok" | istniejący `FavoriteStarButton`, **nowy wariant `placement="viewbar-inline"`** | spłata długu z 043 — przycisk trafia tam, gdzie właściciel prosił |
| Wskaźnik świeżości danych | **nowy** `FreshnessIndicator` | `DataFreshness` dziś zwraca `null`; dokładamy lekki kontekst z czasem ostatniego odświeżenia i dyskretny wskaźnik („teraz" / „2 min temu"). **Nie zmieniamy interwału ani mechaniki odpytywania** — to zadanie Fazy 4, tu tylko uwidaczniamy stan. |
| Wejście do ściągawki skrótów | istniejący `ShortcutsCheatSheet` (otwierany `?`) | przycisk `?` w pasku — odkrywalność bez nowego mechanizmu |

**Pułapka do uniknięcia (rozdz. 10.3, lekcja z 042):** `FavoriteStarButton` czyta pełny adres z
`window.location`, **nie** przez `useSearchParams` — bo w komponencie powłoki wymusza to granicę
`Suspense` i degraduje renderowanie serwerowe. `ViewBar` jest komponentem powłokopodobnym; ta zasada
obowiązuje w nim tak samo.

### 5.4. Mobile (C-31)

- `ViewBar` na telefonie: filtry przewijają się poziomo **wewnątrz własnego kontenera**
  (`overflow-x: auto`), akcje i chrom zostają widoczne; strona nigdy nie przewija się w poziomie.
- Playground: nawigacja boczna `hidden md:flex`, na telefonie **szuflada** otwierana przyciskiem —
  **nigdy dwa panele boczne naraz** (C-31, AC-15).
- Nowe cele dotyku ≥ 44 px (rozdz. 10.7 podnosi poprzeczkę dla **nowych** komponentów; istniejących
  nie ruszamy, żeby nie mieszać refaktoru ze zmianą wyglądu).
- Respekt dla `env(safe-area-inset-*)` w szufladzie playgroundu.

### 5.5. Silnik skórek — nowe rodziny tokenów

Rozszerzamy `src/lib/skins.ts`. `SkinControlKind` (dziś `color | radius | density | scheme`) rośnie o:
`length`, `number`, `font`, `weight`, `tracking`, `shadow`, `background`, `duration`, `easing`,
`keyword` — wszystko jako **`String` + unia TS** (C-12).

| Rodzina | Tokeny | Kind |
|---------|--------|------|
| Typografia | `--font-family-base`, `--font-family-mono`, `--font-family-display`, `--font-weight-heading`, `--letter-spacing-base`, `--letter-spacing-heading`, `--text-transform-heading`, `--line-height-base` | `font` / `weight` / `tracking` / `keyword` / `number` |
| Gęstość i odstępy | `--space-unit`, `--control-height`, `--view-padding` | `length` |
| Zaokrąglenia | `--radius`, `--radius-lg` (są), + `--radius-pill`, `--radius-control` | `radius` |
| Obramowania | `--border-width`, `--border-style`, `--focus-ring-width` | `length` / `keyword` |
| Cienie i poświaty | `--shadow-surface`, `--shadow-elevated`, `--shadow-glow` | `shadow` |
| Tło | `--bg-image-base`, `--bg-image-surface` | `background` |
| Ruch | `--motion-duration`, `--motion-duration-slow`, `--motion-easing` | `duration` / `easing` |
| Chrom powłoki | `--sidebar-width` (jest), + `--chrome-bg`, `--chrome-border`, `--chrome-frame` | `length` / `color` / `keyword` |

**`--font-family-*` to keyword, nie dowolny tekst.** Użytkownik wybiera z zamkniętej listy stosów
(`system`, `mono`, `serif`, `condensed`, `rounded`), a `lib/skins.ts` mapuje keyword na konkretny stos
czcionek systemowych. Powód podwójny: **bezpieczeństwo** (dowolny `font-family` to wektor
wstrzyknięcia i najtrudniejszy do sanityzacji token) oraz **brak żądań zewnętrznych** — nie ładujemy
czcionek z sieci, więc skórka nie może spowolnić ani prześledzić użytkownika.

**Sanityzacja (AC-12) — rozszerzenie `sanitizeTokenValue`.** Dzisiejsza funkcja blokuje
`; { } < > ( ) " '` z wyjątkiem `rgb/rgba/hsl`. Nowe rodzaje potrzebują nawiasów (`linear-gradient`,
`cubic-bezier`, `color-mix`), więc zamiast luzować blokadę globalnie wprowadzamy **whitelistę funkcji
per rodzaj**:

- zawsze zabronione, niezależnie od rodzaju: `;`, `{`, `}`, `<`, `>`, `"`, `'`, `\`, `/*`, `url(`,
  `image(`, `expression`, `@`, `javascript:`;
- `background`: dozwolone wyłącznie `linear-gradient(`, `radial-gradient(`,
  `repeating-linear-gradient(`, `conic-gradient(`, `none` — plus znaki `[0-9a-zA-Z#%.,()\s-]`,
  limit 240 znaków (dzisiejszy limit 64 podnosimy **tylko** dla tego rodzaju);
- `shadow`: `[0-9a-zA-Z#%.,()\s-]`, dozwolone `rgba(`/`rgb(`/`color-mix(`/`inset`/`none`, limit 160;
- `easing`: keyword (`linear`,`ease`,`ease-in`,`ease-out`,`ease-in-out`) albo `cubic-bezier(` z
  czterema liczbami;
- `duration`: `^\d{1,4}(\.\d+)?m?s$`;
- `length`: dzisiejszy `SIZE_RE` rozszerzony o `rem`/`em`;
- `keyword`: wartość **musi** należeć do zadeklarowanej w kontrolce listy `options`.

Testy jednostkowe sanityzacji są zadaniem obowiązkowym — to jedyna bariera między importem skórki a
stylami całej aplikacji.

**Konsumpcja tokenów.** `src/app/globals.css` dostaje wartości domyślne dla wszystkich nowych zmiennych
(żeby skórka częściowa nigdy nie psuła układu — AC-13) oraz jeden blok:

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

To realizuje AC-10 **jednym warunkiem** (rozdz. 10.7), niezależnie od tego, co zadeklaruje skórka.

**Czego NIE robimy:** nie ruszamy sposobu dostarczania tokenów. Zostaje `style={tokensToStyle(...)}`
inline na `<html>` w `layout.tsx`. Tokeny **nigdy** nie trafiają jako tekstowe dziecko `<style>` —
React escapuje cudzysłowy tylko na serwerze, więc rozjazd hydratacji kładzie **całą** aplikację
(lekcja z 2026-08-02, rozdz. 10.3). Przy gradientach i cieniach pokusa jest realna — stąd zapis
wprost.

### 5.6. Skórki flagowe

| Skórka | Charakter | Rola |
|--------|-----------|------|
| **Mostek** (`skin-system-mostek`) | ciemna konsola sci-fi inspirowana estetyką LCARS: bursztyn + fiolet + błękit na bardzo ciemnym tle, zaokrąglenia pigułkowe, nagłówki wersalikami z rozstrzeleniem, dyskretna poświata na akcentach, dekoracyjne ramki narożne | dowód, że silnik unosi **mocny** charakter |
| **Papier** (`skin-system-papier`) | jasna, typograficzna: szeryfowe nagłówki, ciepła biel z subtelną teksturą (gradient CSS), miękkie cienie, minimalne zaokrąglenia | dowód drugiego bieguna — i test `--color-scheme: light` |

- **Grafika wyłącznie wektorowa/CSS.** Ramki narożne „Mostka" to komponent
  `src/components/ui/view/ChromeFrame.tsx` — inline SVG sterowany tokenem `--chrome-frame`
  (`none | corners`), renderowany przez `ModuleView`. Zero plików binarnych: skaluje się, waży tyle
  co nic i sam reaguje na skórkę.
- **Nienachalność jest wymogiem, nie deklaracją.** Obie skórki muszą przejść ręczną kontrolę
  kontrastu AA na parach tekst/tło i tekst-na-akcencie (AC-9). Skórka stylizowana **nigdy** nie staje
  się domyślna — domyślną zostaje „Dark".
- Nazwa własna „Star Trek" i cudze znaki towarowe **nie** pojawiają się w nazwach, opisach ani
  kodzie. Inspirujemy się estetyką, nie kopiujemy marki.

### 5.7. Playground — `/admin/playground` od zera

- **Rejestr:** `src/lib/ui/playground/registry.tsx` — tablica wpisów
  `{ id, name, category, summary, render, controls?, variants? }`. Kategorie (`String` + unia, C-12):
  `prymitywy` · `formularze` · `dane-i-listy` · `powloka-i-nawigacja` · `stany-brzegowe` ·
  `wzorce-widoku`.
- **Komponent:** `src/components/admin/playground/PlaygroundPage.tsx` (+ `PlaygroundNav`,
  `PlaygroundEntry`, `PropControls`, `CodeBlock`). Stary `ComponentPlayground.tsx` **usuwamy**.
- **Nawigacja:** boczna lista kategorii na desktopie (`hidden md:flex`), szuflada na telefonie,
  wyszukiwarka po nazwie i opisie, adres w URL (`?c=<id>`) — zgodnie z zasadą „stan widoku w adresie"
  (rozdz. 10.3, 043).
- **Sterowanie właściwościami na żywo** (AC-16): każdy wpis może zadeklarować `controls`
  (`text`/`select`/`boolean`/`number`), a demonstracja dostaje ich bieżące wartości.
- **Warianty brzegowe** obowiązkowe dla komponentów, które je mają (pusty, długi tekst, błąd) — nie
  tylko przypadek idealny.
- **Przełącznik skórki lokalny** (AC-17): playground opakowuje obszar demonstracji `<div>` z
  `style={tokensToStyle(resolveTokens(wybraneTokeny))}`. Tokeny są **dziedziczone kaskadą**, więc
  nadpisanie ich na kontenerze zmienia wygląd tylko wewnątrz — bez dotykania skórki konta. To ta sama
  mechanika co w `layout.tsx`, tylko o poziom niżej.

### 5.8. Teksty (C-32)

Wszystkie nowe etykiety, stany brzegowe, opisy kategorii i nazwy tokenów **po polsku**. Nazwy tokenów
CSS zostają po angielsku (to identyfikatory), ale ich etykiety w edytorze są polskie — tak jak dziś.

---

## 6. AI — generowanie skórki z opisu

> **Zmiana zakresu (C-54).** Właściciel 2026-08-04 włączył generowanie skórki przez AI do zakresu;
> pierwotnie było „poza zakresem". Spec i lista zadań przeliczone w dół.

**Zero nowych `AIAction` i zero read-tooli.** To nie jest funkcja asystenta czatowego, tylko operacja
odpalana **kliknięciem** w edytorze skórki — jak `kitchen/generate-recipe`, nie jak zdanie w czacie.
Katalog akcji asystenta zostaje nietknięty, więc `check:actions` nie ma tu nic do roboty.

### 6.1. Kształt

Naśladujemy **dokładnie** wzorzec `kitchen.generateRecipe` (cienka trasa + handler w `lib/jobs/handlers`):

- **Handler:** `src/lib/jobs/handlers/skinGenerate.ts` — `skinGenerateHandler({ prompt }, ctx)`.
- **Trasa:** `src/app/api/llm/skins/generate/route.ts` — sesja, `JobError` → status, nic więcej.
- **Operacja LLM:** `op: "generation"` (dłuższy tekst twórczy), `json: true`, `temperature ~0.7`
  (dobór palety to zadanie kreatywne, nie klasyfikacja). Model **z konfiguracji DB**, nigdy zaszyty
  w kodzie (C-40).

### 6.2. Prompt — jak nie dostać brzydkiej skórki

Prompt dostaje **pełny katalog tokenów wraz z ich rodzajami i dozwolonymi wartościami**, wygenerowany
z `ALL_CONTROLS`, a nie przepisany ręcznie — inaczej rozjechałby się przy pierwszym nowym tokenie.
Do tego trzy twarde wymagania, bo to one decydują, czy skórka jest „nienachalna":

1. **Kontrast.** Model ma obowiązek dobrać `--text-primary`/`--bg-base` z kontrastem ≥ 7:1, a
   `--text-secondary` ≥ 4.5:1, i dobrać `--on-accent` do jasności akcentu (biały tekst na bursztynie
   to ~1.8:1 — czyli przycisk nie do odczytania).
2. **Umiar.** Gradienty i poświaty tylko tam, gdzie służą hierarchii; żadnych animacji dłuższych niż
   300 ms; `--font-size-base` w przedziale 13–15 px.
3. **Kompletność.** Ma zwrócić komplet tokenów, nie trzy kolory — skórka częściowa jest legalna, ale
   z opisu „jak konsola statku" ma powstać motyw, a nie przemalowane tło.

### 6.3. Bezpieczeństwo — model to źródło obce

Wynik przechodzi przez **to samo** `validateTokens()` co import pliku. To nie jest ostrożność na
wyrost: model potrafi „pomocnie" zwrócić `url(...)` z obrazkiem tła albo `font-family` z nazwą
czcionki z sieci. Odrzucone klucze **wracają do UI** razem z resztą, tak jak przy imporcie.

Model **nie zapisuje i nie włącza** skórki. Zwraca propozycję, którą użytkownik widzi w podglądzie
i dopiero zapisuje istniejącą akcją `createSkin`. Automatyczna podmiana wyglądu aplikacji byłaby
zaskoczeniem, nie funkcją (zapisane wprost w „poza zakresem" speca).

### 6.4. Bramki, które to uruchamia

| Bramka | Co trzeba zrobić |
|--------|------------------|
| `check:cost-badge` | Handler **musi** przepuścić zużycie (`usageFromChat`) — inaczej build pada. Wskaźnik kosztu w edytorze to `AiCostBadge`, na tych samych zasadach widoczności co wszędzie (`visibleUsage`). |
| `check:content-memory` | Nowy plik wołający `chatComplete` wymaga wpisu w `content-memory-coverage.json`. Klasyfikacja: **`on-demand`** — pamięć treści zwracałaby stary motyw dla zmienionego opisu, a operację odpala kliknięcie. |
| `check:ai-coverage` | Handler nie jest Server Action, więc manifestu akcji nie dotyka. Wpisy dla `exportSkin`/`importSkin` (pkt 3) zostają. |

---

## 7. Bramka `check:ui-contract` — jak wymusić użycie

Wzorujemy się **dokładnie** na `check-cost-badge.js` (statyczny skan `src/` + manifest z powodami).
Rozdz. 10.4.2 nazywa to „naturalnym rozszerzeniem sprawdzonego wzorca" — i tak to robimy.

**Plik:** `scripts/check-ui-contract.js`, manifest: `src/lib/ui/view-contract.json`.

Skrypt sprawdza **trzy** rzeczy:

1. **Kontrakt widoku.** Manifest jest kluczowany **modułem**, nie nazwą pliku — konwencja `*Page.tsx`
   nie jest powszechna (Warsztaty mają `WorkshopsList.tsx`/`WorkshopDetail.tsx`, Magazynowanie ma
   kilkanaście podtras). Dla każdego katalogu modułu w `src/app/` manifest wymienia **pliki wejściowe
   widoku**; każdy z nich musi renderować `ModuleView` albo mieć powód (np. „widok osadzony, nagłówek
   należy do rodzica"). Katalog trasy w `src/app/` bez klucza w manifeście = błąd — dzięki temu nowy
   moduł nie prześlizgnie się obok bramki.
2. **Stany brzegowe.** Plik renderujący `ModuleView` musi przekazać `state` — brak = błąd ze
   wskazaniem pliku (AC-3).
3. **Zaszyte kolory (AC-8).** Skan `src/components/**/*.tsx` na literały `#rrggbb`. Dziś jest ich 430
   w 52 plikach, ale **znaczna część to dane, nie motyw** (palety wybierane przez użytkownika w
   `TagChip`, kolory tagów zadań, ilustracje w `TasksGuide`). Skrypt nie potrafi tego rozróżnić —
   więc, jak pozostałe bramki Omnii, **żąda świadomej decyzji**: plik jest albo czysty, albo ma wpis
   z jedną z kategorii `paleta-danych` / `ilustracja` / `do-poprawy` i powodem. Sweeping robimy przy
   migracji danego modułu; kategoria `do-poprawy` jest dozwolona, ale widoczna — i to ona jest listą
   długu na kolejne przebiegi.

**Wpięcie w `build`** (C-50): `… && node scripts/check-migrations.js && node scripts/check-ui-contract.js && next lint …`
plus skrót `"check:ui-contract"` w `package.json`.

**Kolejność ma znaczenie:** bramkę włączamy na twardo **dopiero po** migracji wszystkich 21 modułów.
Do tego czasu manifest ma wpisy przejściowe — inaczej build byłby czerwony przez cały czas trwania
migracji i przestałby cokolwiek znaczyć.

---

## 8. Rozdział-dziennik w dokumencie architektury

- **Nowy plik:** `worldofmag/content/architektura/15-dziennik.md`
- **Wpis w** `worldofmag/content/architektura/manifest.json` (tablica `chapters`, `number: "15"`,
  `part: "Wykonanie"`, tytuł „Dziennik przebudowy — co zrobiono").
- `scripts/copy-architektura.js` bakuje go automatycznie do `src/generated/architektura-book.ts`
  (już wpięte w `build`) — **zero zmian w skrypcie i w czytniku**.
- **Zawartość:** (a) tabela statusów wszystkich 46 zadań z rozdz. 14 (⬜ nietknięte / 🟡 w toku /
  ✅ zrobione) z krótką notatką, (b) wpisy przebiegów — dla każdego: numer specyfikacji, data, co
  zmieniono, co świadomie pominięto, (c) „następny krok" wskazujący jednoznacznie Fazę 0.
- Ten przebieg wpisuje: **zadanie 42 → ✅** (stany błędów i puste w każdym module — realizowane przez
  kontrakt widoku), **zadania 4–41, 43–46 → ⬜** z adnotacją „poza zakresem 045", oraz sekcję
  „poza checklistą: system komponentów i kontrakt widoku (rozdz. 10.4–10.5), silnik skórek,
  playground" — bo rozdz. 10.4/10.5 **nie mają numeru w checkliście**, a są wprost opisanym długiem.
  Ta luka w dokumencie źródłowym jest odnotowana w dzienniku jako spostrzeżenie.

---

## 9. Pliki do utworzenia / zmiany

### Nowe

| Plik | Po co |
|------|-------|
| `src/components/ui/view/ModuleView.tsx` | rama widoku — nagłówek, pasek, stany brzegowe |
| `src/components/ui/view/ViewBar.tsx` | pasek widoku: filtry \| akcje \| chrom powłoki |
| `src/components/ui/view/ViewChrome.tsx` | kontekst wstrzykiwany przez `AppShell` |
| `src/components/ui/view/ViewState.tsx` | `EmptyState`/`LoadingState`/`ErrorState`/`NoAccessState` — jeden zestaw |
| `src/components/ui/view/ChromeFrame.tsx` | dekoracyjne ramki narożne (inline SVG, token `--chrome-frame`) |
| `src/components/ui/view/index.ts` | eksporty |
| `src/components/ui/ConfirmDialog.tsx` | wspólne potwierdzenie (AC-5) — dziś modale ad-hoc |
| `src/components/ui/DataList.tsx` | lista z zaznaczaniem i skrótami (bez paginacji — Faza 3) |
| `src/components/ui/Field.tsx` | pole formularza: etykieta, podpowiedź, błąd |
| `src/components/ui/BulkActionBar.tsx` | pasek akcji zbiorczych (dziś tylko Zadania) |
| `src/components/shell/FreshnessIndicator.tsx` | widoczny wskaźnik świeżości danych |
| `src/components/admin/playground/PlaygroundPage.tsx` (+ `PlaygroundNav`, `PlaygroundEntry`, `PropControls`, `CodeBlock`) | playground od zera |
| `src/lib/ui/playground/registry.tsx` | rejestr komponentów — źródło listy (AC-18) |
| `src/lib/ui/view-contract.json` | manifest bramki kontraktu widoku |
| `src/lib/skins/flagship.ts` | tokeny skórek flagowych (źródło prawdy dla migracji seedującej) |
| `scripts/check-ui-contract.js` | bramka |
| `prisma/migrations/0224_skorki_flagowe/migration.sql` | seed dwóch skórek systemowych |
| `worldofmag/content/architektura/15-dziennik.md` | rozdział-dziennik |
| `src/lib/__tests__/skins.test.ts` | testy sanityzacji tokenów (AC-12) |

### Zmieniane

| Plik | Zmiana |
|------|--------|
| `src/lib/skins.ts` | nowe rodziny tokenów, `SkinControlKind`, whitelisty funkcji, `DEFAULT_DARK_TOKENS`, mapa stosów czcionek |
| `src/app/globals.css` | domyślne wartości nowych zmiennych + blok `prefers-reduced-motion` |
| `src/components/shell/AppShell.tsx` | `ViewChromeProvider` wokół `<main>`; usunięcie zaszytych `#ef4444` (2 miejsca) |
| `src/components/shell/DataFreshness.tsx` | publikacja czasu ostatniego odświeżenia do kontekstu (mechanika bez zmian) |
| `src/components/favorites/FavoriteStarButton.tsx` | nowy wariant `placement="viewbar-inline"` |
| `src/components/skins/SkinEditor.tsx` | sekcje rodzin tokenów, nowe kontrolki, import/eksport |
| `src/components/skins/SkinPreview.tsx` | podgląd pokazujący typografię, cienie, ruch — nie tylko kolory |
| `src/actions/skins.ts` | `exportSkin`, `importSkin` |
| `src/lib/ai/action-coverage.json` | wpisy dla dwóch nowych akcji |
| `src/app/admin/playground/page.tsx` | montaż nowego playgroundu |
| `src/components/admin/ComponentPlayground.tsx` | **usunięcie** |
| `src/components/ui/index.ts` | eksport nowych komponentów |
| `src/components/ui/home/index.ts` | re-eksport zgodnościowy (stare importy mają dalej działać w trakcie migracji) |
| `worldofmag/content/architektura/manifest.json` | wpis rozdziału 15 |
| `package.json` | `check:ui-contract` + wpięcie w `build` |
| **45 plików `src/components/*/*Page.tsx`** | migracja na `ModuleView` — **osobny commit na moduł** |
| `doświadczenia.md` | wpisy z lekcjami (C-51) |

---

## 10. Kolejność wykonania

Kolejność jest istotna — filary przed migracją, bramka na końcu.

1. **Fundament UI** — `ViewState`, `ModuleView`, `ViewBar`, `ViewChrome`, `ChromeFrame`; wpięcie
   `ViewChromeProvider` w `AppShell`; `FreshnessIndicator`.
2. **Komponenty wspólne** — `ConfirmDialog`, `DataList`, `Field`, `BulkActionBar`.
3. **Silnik skórek** — tokeny + sanityzacja + testy + `globals.css` + edytor + podgląd + import/eksport.
4. **Skórki flagowe** — `flagship.ts`, migracja 0224, kontrola kontrastu.
5. **Playground** — rejestr + strona + usunięcie starego.
6. **Migracja modułów** — od najprostszych (Kontakty, Kosz, Truck, QA, Raporty) do najbardziej
   rozbudowanych (Zadania, Zakupy, Magazynowanie, Wiadomości). **Osobny commit na moduł.**
7. **Bramka** `check:ui-contract` — włączenie na twardo + uzupełnienie manifestu.
8. **Dziennik** — rozdział 15 + manifest.
9. **`doświadczenia.md`** + zielony `npm run build` (do kroku `next build`).

---

## 11. Bramki i weryfikacja (C-50)

**Lokalnie (C-13 — nigdy prod DB):** lokalny Postgres 16 (`pg_ctlcluster 16 main start`), rola+baza
`omnia/omnia_dev`, `.env.local` **oraz** zmienne wyeksportowane do powłoki (`scripts/migrate.js` nie
czyta `.env.local`), `npx prisma migrate deploy`. Weryfikujemy **do kroku `next build`** — ostatni
krok `build` rusza produkcję.

Uruchamiamy: `npm run check:migrations`, `npm run check:actions`, `npm run check:ai-coverage`,
`npm run check:cost-badge`, `npm run check:content-memory`, `npm run check:ui-contract`,
`next lint --dir src`, `prisma generate`, `next build`.

### Mapowanie AC → weryfikacja

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1 | `check:ui-contract` przechodzi przy pustym manifeście wyjątków dla `*Page.tsx` |
| AC-2 | Przegląd wizualny 3 modułów + kod: `ViewBar` czyta chrom z kontekstu, moduły nie przekazują go propsami |
| AC-3 | Test negatywny bramki: tymczasowe usunięcie `state` z jednego pliku → bramka czerwona |
| AC-4 | Playground, kategoria „stany brzegowe" — cztery stany obok siebie; przegląd w 3 modułach |
| AC-5 | `grep` na modale usuwania → wszystkie przez `ConfirmDialog` |
| AC-6 | Zmiana odstępu w `ViewState` widoczna w każdym module (jedno źródło) |
| AC-7 | Edytor skórki — zmiana tokenu z każdej rodziny, podgląd reaguje |
| AC-8 | `check:ui-contract` (skan hex) + ręczny przegląd pod skórką „Mostek" |
| AC-9 | Ręczne wyliczenie kontrastu par tekst/tło i tekst-na-akcencie dla obu skórek flagowych; wynik zapisany w `verify.md` |
| AC-10 | Symulacja `prefers-reduced-motion: reduce` w narzędziach przeglądarki |
| AC-11 | Eksport → import na drugim koncie → porównanie JSON tokenów |
| AC-12 | Testy jednostkowe `skins.test.ts`: `url(`, `;`, `<script`, `expression`, przekroczone limity, klucz spoza whitelisty |
| AC-13 | Skórka z 3 tokenami → reszta dziedziczy domyślne, układ bez zmian |
| AC-14/15 | Przegląd playgroundu przy 375 px i 1440 px; brak poziomego przewijania strony |
| AC-16 | Sterowanie właściwościami w playgroundzie zmienia demonstrację na żywo |
| AC-17 | Przełącznik skórki w playgroundzie zmienia tylko obszar demonstracji |
| AC-18 | Nowy komponent bez wpisu w rejestrze → nie ma go w playgroundzie i widać to w bramce |
| AC-19/20 | `/admin/architektura-docelowa` pokazuje rozdział 15 ze statusem 46 zadań |

---

## 12. Ryzyka techniczne i plan wycofania

| Ryzyko | Mitygacja | Wycofanie |
|--------|-----------|-----------|
| **Migracja 45 plików stron psuje zachowanie** | osobny commit na moduł; `ModuleView` renderuje wewnątrz istniejący `PageHeader`, więc wygląd się nie zmienia; brak siatki bezpieczeństwa (Faza 0) kompensujemy ręcznym przejściem modułu po migracji | `git revert` commitu **jednego modułu** — reszta zostaje |
| **Rozjazd hydratacji przy nowych tokenach** | zero zmian w sposobie dostarczania (inline na `<html>`); zakaz `<style>{…}</style>` zapisany w planie i sprawdzany w recenzji | rewert zmian w `globals.css` + `layout.tsx` bez ruszania reszty |
| **Sanityzacja nowych tokenów zbyt luźna** — realna dziura bezpieczeństwa | whitelisty **per rodzaj**, nie luzowanie globalnej blokady; obowiązkowe testy jednostkowe przed użyciem w edytorze | rewert `lib/skins.ts`; stare skórki (same kolory) działają dalej |
| **Bramka `check:ui-contract` blokuje pracę w trakcie migracji** | włączamy na twardo **na końcu**, po migracji wszystkich modułów | usunięcie jednej linii z `build` |
| **Skórka flagowa nieczytelna pod jakimś kątem** | kontrola kontrastu AA jako warunek dowiezienia; skórka nigdy nie jest domyślna | zmiana tokenów osobną migracją; użytkownik zawsze może wrócić do „Dark" |
| **`ModuleView` za sztywny dla nietypowego widoku** (Wiadomości, Magazynowanie) | te dwa moduły migrujemy **jako sprawdzian**, zanim włączymy bramkę; jeśli kontrakt nie unosi — wracamy do `plan.md` i `spec.md` (C-54), nie obchodzimy problemu w kodzie | — |
| **Migracja 0224 nie ma czego cofać** (sam `INSERT`) | `ON CONFLICT DO NOTHING`, stałe id | `DELETE FROM "Skin" WHERE id IN (…)` — bezpieczne, bo `UserSkinPref.skinId` jest nullowalny |

---

## 13. Decyzje techniczne przyjęte samodzielnie (C-55, bez pytania właściciela)

1. **Zero zmian w schemacie Prisma** — `Skin.tokens` już unosi dowolne tokeny. Alternatywa (tabela
   tokenów) byłaby nadmiarowa (C-53).
2. **`--font-family-*` jako keyword z zamkniętej listy**, nie dowolny tekst — bezpieczeństwo i brak
   żądań zewnętrznych.
3. **`ModuleView` opakowuje istniejący `PageHeader`** zamiast go zastępować — migracja bez zmiany
   wyglądu.
4. **Chrom powłoki przez kontekst**, nie przez renderowanie paska w `AppShell` — inaczej podwójne
   nagłówki w ~20 modułach.
5. **Prop `resource` zarezerwowany, nieaktywny** — żeby Faza 2/4 nie musiała wracać do 21 modułów.
6. **`FreshnessIndicator` tylko uwidacznia** istniejący mechanizm — usunięcie odpytywania to Faza 4,
   nie ten przebieg.
7. **Bramka hex żąda decyzji zamiast zgadywać**, z kategorią `do-poprawy` jako jawną listą długu.
8. **Skórki flagowe: „Mostek" i „Papier"** — dwa przeciwne bieguny, żeby silnik był sprawdzony w obie
   strony, bez odwołań do cudzych znaków towarowych.

---

## 14. Zgodność z konstytucją — checklista

- [x] **C-10, C-11, C-14** — jedna ręczna migracja `0224_skorki_flagowe`, numer policzony
      (max 0223 + 1), seed idempotentny (`ON CONFLICT DO NOTHING`, dollar-quoting).
- [x] **C-12** — zero enumów Prisma; wszystkie nowe rodzaje (`SkinControlKind`, kategorie
      playgroundu, `state` widoku) jako `String` + unia TS.
- [x] **C-13** — weryfikacja na lokalnym Postgresie, do kroku `next build`; nigdy prod `DATABASE_URL`.
- [x] **C-20** — `exportSkin`/`importSkin` jako Server Actions z `revalidatePath`.
- [x] **C-21** — bez nowych guardów; `importSkin` tworzy wyłącznie skórkę użytkownika.
- [x] **C-22** — bez nowego slugu; playground zostaje pod `module.admin`.
- [x] **C-23** — brak nowych `AIAction`; wpisy w manifestach bramek uzupełnione.
- [x] **C-24, C-25** — trash i audyt bez zmian (feature nie dotyka danych ani RBAC).
- [x] **C-30** — silnik skórek **jest** realizacją tej reguły; bramka skanuje zaszyte kolory.
- [x] **C-31** — `ViewBar` i playground mobile-first, `hidden md:flex`, nigdy dwa panele boczne,
      cele dotyku ≥ 44 px w nowych komponentach, `env(safe-area-inset-*)`.
- [x] **C-32** — wszystkie nowe teksty po polsku.
- [x] **C-50** — nowa bramka wpięta w `build`; „gotowe" = zielony build.
- [x] **C-51** — wpisy do `doświadczenia.md` przy każdej nieoczywistej pułapce.
- [x] **C-53** — rozszerzamy istniejący `PageHeader`/`ui/home` zamiast budować drugi system; zero
      nowych zależności; `resource` świadomie zadeklarowany jako zarezerwowany, z uzasadnieniem.
- [x] **C-54** — jeśli `ModuleView` nie uniesie Wiadomości/Magazynowania, wracamy do `spec.md` i
      `plan.md`, a nie obchodzimy problemu w kodzie.
