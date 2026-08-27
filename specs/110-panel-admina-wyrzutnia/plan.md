# Plan techniczny: Panel administratora jako pogrupowana wyrzutnia

- **Spec:** ./spec.md (110-panel-admina-wyrzutnia)
- **Status:** draft
- **Data:** 2026-08-27

## 1. Podejście

Zmiana wyłącznie w warstwie widoku i nawigacji: **zero migracji, zero Server Actions, zero nowych
uprawnień**. `/admin` przestaje być jedną kolumną — dostaje **rejestr narzędzi** (jedno źródło prawdy
dla grup, wyszukiwarki i bramki kompletności), a treść „na miejscu" (build, jedenaście liczników,
sesja) przenosi się na nową trasę `/admin/przeglad`.

Wzorcem jest **przebieg 109** (`/settings`), który rozwiązał ten sam problem: rejestr w `src/lib/`,
komponent spisu z wyszukiwarką, test jednostkowy na klucze podawane zmienną. Świadomie **nie**
kopiujemy tamtego wzorca w całości — patrz decyzja o reużyciu w §5.1.

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Żadnego nowego modelu, kolumny ani indeksu, więc **nie powstaje żadna
migracja** — `npm run next:migration` nie jest wołane, a `check:migrations` i `check:schema-drift`
nie mają nowego materiału. Rollback tej zmiany to wyłącznie rollback kodu.

## 3. Warstwa serwera (Server Actions — C-20)

**Bez nowych Server Actions i bez mutacji.** Jedyne zapytania to te, które dziś robi `/admin`:
jedenaście `prisma.*.count()`. Zmienia się **miejsce** ich wywołania — z `/admin` na
`/admin/przeglad` — a nie treść.

To jest właściwy zysk techniczny tej zmiany: dziś każde wejście do panelu (najczęściej po to, żeby
pójść dalej) czeka na policzenie użytkowników, zespołów, raportów, uprawnień, aktywności, pozycji
zakupowych, zadań, notatek, przepisów, zwierząt i pozycji magazynu. Po zmianie płaci za to tylko ten,
kto wchodzi po liczby.

`revalidatePath` nie dochodzi nigdzie nowe (brak mutacji). Model współwłasności (C-21) nie dotyczy —
liczniki są globalne i takie zostają.

## 4. RBAC / rejestr (C-22)

- **Bez nowego sluga.** Panel stoi na `module.admin`; `legacyPermissionForPath` mapuje
  `path.startsWith("/admin")`, więc `/admin/przeglad` dziedziczy to samo uprawnienie — **do
  potwierdzenia testem jednostkowym**, tak jak zrobiliśmy dla sekcji ustawień w 109.
- **Kontrola na trasie.** `/admin/page.tsx` robi dziś `hasPermission(session, PERMISSIONS.ADMIN)` →
  `redirect("/")`. **Nowa trasa `/admin/przeglad` musi mieć DOKŁADNIE tę samą kontrolę** — rozbicie
  jednej chronionej strony na dwie mnoży miejsca do obronienia, a pominięcie nie widać w interfejsie.
  Nie polegamy na tym, że „to pod `/admin`".
- **Rejestr modułów bez zmian** — panel nie jest modułem z `MODULES`, `ModuleSidebar` prowadzi do
  `/admin` jak dotąd.
- `check:route-gating` chodzi tylko po `src/modules/*`, więc panelu nie dotyczy — tym bardziej
  kontrola musi stać jawnie w kodzie trasy.

## 5. UI (C-30, C-31, C-32, C-33)

### 5.1 Reużycie z 109 — co bierzemy, a czego nie

Spec (§7) każe rozstrzygnąć to w planie, z kryterium „liczba warunków `if (wariant)`". Rozstrzygnięcie
po przeczytaniu obu stron:

- **Bierzemy funkcje porównywania fraz.** `bezOgonkow` i `pasujeDoFrazy` z
  `src/lib/ustawienia/sekcje.ts` są **czyste i nie wiedzą nic o ustawieniach** — wędrują do
  `src/lib/ui/szukanie.ts`, a rejestr ustawień je stamtąd importuje. Dwa konsumenty od pierwszego
  commita (C-35), zero nowych zależności, `ł` obsłużone tak jak było.
- **NIE uogólniamy `SpisUstawien`.** Panel potrzebuje **grup** (ustawienia mają płaską listę),
  odnośników **poza `/admin`** (`/services/moderation`), pozycji, która jest **przyciskiem, a nie
  odnośnikiem** (tryb wskazywania elementu), i ma tylko jeden wariant wyświetlania (ustawienia mają
  dwa: kafelki i listę boczną). Wspólny komponent musiałby rozgałęziać się w czterech miejscach —
  to jest dokładnie ten wspólny komponent, który jest gorszy od dwóch prostych (C-35 czytane
  w drugą stronę). Powstaje osobny `SpisNarzedziAdmina`.

### 5.2 Rejestr narzędzi

`src/lib/admin/narzedzia.ts` — jedno źródło dla grup, wyszukiwarki i bramki:

```ts
export type NarzedzieAdmina = {
  id: string;          // ASCII, = ostatni segment trasy pod /admin (klucz dla bramki)
  href: string;        // pełny adres; nie musi być pod /admin (moderacja usług)
  Ikona: LucideIcon;
  kluczNazwy: string;  // klucze w przestrzeni components.admin.SpisNarzedziAdmina
  kluczOpisu: string;
  kluczHasel: string;  // słowa dla wyszukiwarki
  akcja?: "wskazElement";  // pozycja-przycisk zamiast odnośnika
};
export type GrupaNarzedzi = { id: string; kluczNazwy: string; narzedzia: NarzedzieAdmina[] };
export const GRUPY_NARZEDZI: GrupaNarzedzi[] = [ … ];
export function wszystkieNarzedzia(): NarzedzieAdmina[]
```

Siedem grup, 24 pozycje + 1 akcja (podział ze speca §8):

| Grupa | Pozycje |
|---|---|
| Przegląd | `/admin/przeglad` **(nowa trasa)** |
| Dostęp i bezpieczeństwo | `access`, `audit` |
| Diagnostyka | `health`, `metrics`, `jobs`, `ai-calls` |
| AI i konfiguracja | `config`, **`llm` (dziś bez odnośnika)**, `ai-coverage`, `user-facts` |
| Treść i wygląd | `categories`, `skins`, `reports`, `zrodla-rss`, `/services/moderation` |
| Dokumentacja projektu | `docs`, `audyt`, `audyt-podsumowanie`, `architektura-docelowa`, `architecture`, `spec-pipeline` |
| Narzędzia dewelopera | `playground`, `e2e`, **`qa` (dziś bez odnośnika z panelu)**, akcja „zgłoś błąd" |

**Same klucze, zero literałów** (C-32). Bramka `check:i18n` nie widzi `t(zmienna)`, więc obecności
kluczy pilnuje **test jednostkowy** obok rejestru — dokładnie ten mechanizm, który w 109 wyłapał
brakujący klucz w próbie mutacyjnej.

### 5.3 Bramka kompletności — `scripts/check-admin-links.js`

AC-3 wymaga, żeby **każda** trasa `/admin/*` miała odnośnik. Lista przepisana ręcznie rozjedzie się
przy pierwszej nowej stronie — dokładnie tak, jak rozjechała się dzisiaj (`/admin/llm` bez odnośnika
z żadnego miejsca w aplikacji, `/admin/qa` tylko z modułu QA). Dlatego bramka, nie dyscyplina:

- czyta katalogi pierwszego poziomu w `src/app/admin/` mające `page.tsx`;
- czyta `id` z `GRUPY_NARZEDZI`;
- **w obie strony**: katalog bez wpisu = błąd („nowa strona panelu bez odnośnika"), wpis wskazujący
  na `/admin/<id>`, którego nie ma na dysku = błąd („martwy odnośnik");
- świadome wyjątki (gdyby kiedyś powstała strona celowo nielinkowana) w
  `src/lib/admin/linki-wyjatki.json` z powodem; martwy wyjątek też wywala build — wzorzec
  `gating-wyjatki.json`;
- wpięta w `build` obok pozostałych bramek.

Wzorem jest `check-route-gating.js`: dopasowujemy **fakt** (obecność `page.tsx` i wpisu), nie nazwę
w komentarzu.

### 5.4 Trasy i komponenty

- `src/app/admin/page.tsx` — **przepisanie**: sesja + uprawnienie, potem `ModuleView` (tytuł „Panel
  administratora", `state="ready"`) z `SpisNarzedziAdmina`. Znika karta buildu, jedenaście `count()`,
  sekcja konfiguracji, płaska lista i sekcja sesji. **Ręcznie rysowany `<h1>` znika** (C-33, AC-13).
- `src/app/admin/przeglad/page.tsx` — **nowa**: sesja + **własne** sprawdzenie uprawnienia, jedenaście
  `count()`, karta buildu, siatki liczników i karta sesji — treść przeniesiona **1:1**, opakowana
  w `ModuleView` z `breadcrumb` prowadzącym do `/admin`.
- `src/components/admin/SpisNarzedziAdmina.tsx` (klient) — pole szukania + grupy; filtr chowa grupę,
  z której nic nie zostało; brak trafień → stan pusty z wyjaśnieniem. Pozycja `akcja` renderuje
  `FeedbackTriggerButton` zamiast odnośnika. Kafelki: na telefonie jedna kolumna, od `sm` dwie; cele
  dotyku ≥ 44 px; kolory wyłącznie ze zmiennych (C-30, C-31).
- `src/components/admin/PowrotDoPanelu.tsx` — **wspólny odnośnik powrotu** („‹ Panel administratora").
  Dziś 12 stron panelu ma taki odnośnik napisany ręcznie (wszystkie z `fontSize: 12`), a **11 nie ma
  go wcale**: `access`, `ai-calls`, `ai-coverage`, `architektura-docelowa`, `audit`, `audyt`,
  `audyt-podsumowanie`, `health`, `jobs`, `llm`, `user-facts`. Komponent jedzie z konsumentami:
  wpinamy go w **11 brakujących** i podmieniamy **12 istniejących** (drop-in — ta sama treść i ten sam
  rozmiar), żeby nie zostały dwa wzorce tej samej rzeczy (C-35).
- `MetricCard` przenosi się razem z licznikami do trasy przeglądu.

**Czego NIE robimy:** nie wpinamy pozostałych 21 stron panelu w `ModuleView` (spec §5 „poza
zakresem"). Panel jest wyłączony z `check:ui-contract` (`NOT_MODULES` w bramce), więc to nie jest
dług wobec bramki, tylko świadomie odłożona robota; `/admin` i przegląd wchodzą do ramy, bo i tak są
przepisywane.

## 6. AI / integracje (C-23, C-40)

**Nie dotyczy.** Zero nowych `AIAction`, read-toolów, wpięć w kalendarz, powiadomienia i kosz.
`check:actions`, `check:ai-coverage`, `check:cost-badge` przechodzą bez nowego materiału.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/lib/ui/szukanie.ts` | nowy | `bezOgonkow` + `pasujeDoFrazy` wyjęte z rejestru ustawień; dwa konsumenty od razu |
| `src/lib/ustawienia/sekcje.ts` | edycja | re-eksport/import z `szukanie.ts` zamiast własnych kopii |
| `src/lib/admin/narzedzia.ts` | nowy | rejestr grup i narzędzi panelu — jedno źródło dla spisu, wyszukiwarki i bramki |
| `src/lib/admin/linki-wyjatki.json` | nowy | świadome wyjątki bramki kompletności (na start pusty) |
| `src/lib/admin/__tests__/narzedzia.test.ts` | nowy | klucze tekstów istnieją; unikalne `id`; każda pozycja ma adres |
| `scripts/check-admin-links.js` | nowy | bramka: każda trasa `/admin/*` ma odnośnik, każdy odnośnik ma trasę |
| `package.json` | edycja | `check:admin-links` + wpięcie w `build` |
| `src/components/admin/SpisNarzedziAdmina.tsx` | nowy | grupy + wyszukiwarka + stan pusty |
| `src/components/admin/PowrotDoPanelu.tsx` | nowy | wspólny odnośnik „‹ Panel administratora" |
| `src/app/admin/page.tsx` | przepisanie | wyrzutnia w ramie widoku (z 408 linii do kilkudziesięciu) |
| `src/app/admin/przeglad/page.tsx` | nowy | build + jedenaście liczników + sesja, przeniesione 1:1 |
| 11 stron panelu bez powrotu | edycja | wpięcie `PowrotDoPanelu` |
| 12 stron panelu z powrotem ręcznym | edycja | podmiana na `PowrotDoPanelu` |
| `messages/pl.json` | edycja | nazwy grup, nazwy/opisy/hasła 25 pozycji, teksty wyszukiwarki i przeglądu |
| `e2e/specs/110-panel-admina.spec.ts` | nowy | kryteria akceptacji tego przebiegu |
| `src/lib/ui/perf-baseline.json` | **może** edycja | tylko jeśli `check:perf` zaprotestuje — z powodem, nigdy po cichu |

## 8. Bramki i weryfikacja (C-50)

**Lokalnie** (C-13 — nigdy prod `DATABASE_URL`): lokalny Postgres z sandboxa (`omnia/omnia_dev`),
`.env.local` + eksport do powłoki, `npx prisma migrate deploy`. Weryfikujemy **do `next build`**;
`scripts/migrate.js` nie odpalamy.

Kolejność: `check:admin-links` → `check:i18n` → `check:ui-contract` → `check:test-types` →
`test:unit` → `next lint --dir src` → pełny `build` → klikacz (`scripts/e2e-web.sh`).

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1 | e2e: `/admin` ma ≥ 5 widocznych nagłówków grup; każda pozycja ma nazwę i opis (dwie linie tekstu) |
| AC-2 | e2e 1280 px: dla każdej grupy nagłówek i jej pierwsza pozycja są w tym samym oknie widoku |
| AC-3 | **`npm run check:admin-links`** (bramka, nie test) + e2e: `/admin` zawiera odnośniki `href="/admin/llm"` i `href="/admin/qa"` |
| AC-4 | e2e: kliknięcie losowej pozycji prowadzi wprost pod jej adres |
| AC-5 | test jednostkowy `legacyPermissionForPath("/admin/przeglad") === PERMISSIONS.ADMIN`; inspekcja kodu obu tras |
| AC-6 | e2e: „skorka" zawęża listę i prowadzi do `/admin/skins` |
| AC-7 | test jednostkowy `pasujeDoFrazy` + e2e: „zrodla" → `/admin/zrodla-rss`, „dostep" → `/admin/access` |
| AC-8 | e2e: fraza „qqq" → widoczny komunikat stanu pustego |
| AC-9 | e2e: `/admin` **nie zawiera** tekstu z karty buildu ani liczników |
| AC-10 | e2e: `/admin/przeglad` zawiera wszystkie 5 + 6 etykiet liczników, 5 pól buildu i 3 pola sesji — pętla po liście nazw, nie „na oko" |
| AC-11 | inspekcja kodu: `grep` na `prisma.*count(` w `src/app/admin/page.tsx` → zero trafień |
| AC-12 | e2e: pętla po wszystkich trasach `/admin/*` — każda ma widoczny odnośnik `href="/admin"` |
| AC-13 | e2e: `/admin` i przegląd mają dokładnie jeden `<h1>` w `main`, a przegląd ma okruszek |
| AC-14 | `grep` po hexach w nowych plikach |
| AC-15 | e2e 390 px: brak przewijania w poziomie; dolna krawędź treści nad dolnym paskiem |
| AC-16 | `check:i18n` + test jednostkowy kluczy rejestru |

## 9. Ryzyka techniczne i plan wycofania

- **Ryzyko: „przenieśliśmy" znaczy „zgubiliśmy".** Przy 25 pozycjach i trzech blokach przeglądu łatwo
  o cichy ubytek. → AC-3 pilnuje bramka (mechanicznie), AC-10 sprawdza e2e **pętlą po nazwach**, a nie
  jednym spojrzeniem.
- **Ryzyko: nowa trasa bez kontroli dostępu.** → jawne sprawdzenie w `przeglad/page.tsx` + test
  jednostkowy na mapowanie ścieżki.
- **Ryzyko: podmiana powrotu w 23 plikach coś przesunie.** Odnośniki są uniformne (wszystkie
  `fontSize: 12`), ale stoją w różnych miejscach układu. → podmieniamy **tylko markup odnośnika**,
  nie jego miejsce w drzewie; różnice w odstępach przechodzą propem, nie przepisaniem strony.
- **Ryzyko: bramka `check:admin-links` fałszywie alarmuje na podtrasach.** `/admin/qa/epic` i
  `/admin/qa/story` to podstrony narzędzia, nie osobne narzędzia. → bramka patrzy **wyłącznie na
  pierwszy poziom** katalogów pod `src/app/admin`.
- **Ryzyko: bramka przechodzi, bo niczego nie znajduje.** Pusta lista katalogów albo pusty rejestr
  dałyby zielone światło. → bramka **wywala się**, gdy znajdzie zero tras albo zero wpisów, i wypisuje
  policzone liczby (wzorzec z `check-perf-budget.js`).
- **Ryzyko: budżet wydajnościowy.** Nowa trasa podnosi sumę bajtów JS; pasmo ±5 %. → jeśli
  `check:perf` zaprotestuje, podnosimy próg **z powodem**.
- **Rollback:** wyłącznie kod (`git revert`), bez migracji i bez stanu bazy. Adres `/admin/przeglad`
  przestałby istnieć — dlatego rejestr i odnośniki wracają tym samym revertem.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14 (migracje)** — bez zmian w schemacie, żadnej migracji; napisane wprost w §2.
- [x] **C-20..C-25** — zero nowych akcji i mutacji; brak `AIAction` (C-23); kosz i audyt nie dotyczą;
      zakres danych bez zmian (C-21).
- [x] **C-22 (RBAC)** — istniejący `module.admin`; nowa trasa sprawdza uprawnienie **jawnie**,
      nie przez sąsiedztwo ścieżki; mapowanie potwierdzone testem.
- [x] **C-30 (motyw)** — wyłącznie zmienne CSS w nowym kodzie.
- [x] **C-31 (mobile-first)** — jedna kolumna na telefonie, cele dotyku ≥ 44 px, obszar gestów.
- [x] **C-32 (teksty)** — wszystko w `messages/pl.json`; klucze dynamiczne pokryte testem.
- [x] **C-33 (kontrakt widoku)** — `/admin` i przegląd w `ModuleView` ze `state`; rama **nie jest
      poszerzana**, bo istniejące warianty wystarczają.
- [x] **C-35 (komponent z konsumentem)** — `szukanie.ts` dostaje dwa konsumenty od razu;
      `PowrotDoPanelu` — dwadzieścia trzy; `SpisUstawien` świadomie **nie** jest uogólniany.
- [x] **C-36 (granice)** — panel to powierzchnia powłoki; rejestr trzyma adresy, nie importuje wnętrza
      modułów. `/services/moderation` wchodzi jako **adres**, nie jako import z modułu Usługi.
- [x] **C-51 (lekcje)** — wpis o osieroconej trasie `/admin/llm` i o tym, dlaczego kompletności
      pilnuje bramka, a nie lista.
- [x] **C-53 (minimalizm)** — zero nowych zależności; treść przeniesiona 1:1; wspólny komponent tylko
      tam, gdzie naprawdę jest wspólny.
